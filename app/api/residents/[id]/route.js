import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin, requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');

  // +63xxxxxxxxxx or 63xxxxxxxxxx
  if (digits.length === 12 && digits.startsWith('63')) {
    return `0${digits.slice(2)}`;
  }

  // xxxxxxxxxx (10 digits) -> 0xxxxxxxxxx
  if (digits.length === 10) {
    return `0${digits}`;
  }

  // If extra digits, keep the most likely PH mobile (last 11)
  if (digits.length > 11) {
    return digits.slice(-11);
  }

  return digits;
}

function contactCandidates(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return [];

  const set = new Set();

  // Normalize to local 0xxxxxxxxxx if possible
  const local = normalizeContactNumber(digits);
  if (local) set.add(local);

  // Add common intl variants that might be stored in account_requests
  if (local && local.length === 11 && local.startsWith('0')) {
    const intl = `63${local.slice(1)}`;
    set.add(intl);
    set.add(`+${intl}`);
  }

  // If already 63xxxxxxxxxx, also include 0xxxxxxxxxx
  if (digits.length === 12 && digits.startsWith('63')) {
    set.add(`0${digits.slice(2)}`);
    set.add(`+${digits}`);
  }

  // Raw digits as-is (in case it was stored without normalization)
  set.add(digits);

  return Array.from(set).filter(Boolean);
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function getMissingColumn(message, tableName) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(
    new RegExp(`Could not find the '([^']+)' column of '${tableName}' in the schema cache`, 'i'),
  );
  if (match?.[1]) return match[1];

  // Postgres error surfaced via PostgREST
  match = msg.match(
    new RegExp(`column\s+(?:public\\.)?${tableName}\\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist`, 'i'),
  );
  if (match?.[1]) return match[1];

  match = msg.match(
    new RegExp(
      `column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\\.)?${tableName}"\s+does\s+not\s+exist`,
      'i',
    ),
  );
  if (match?.[1]) return match[1];

  return null;
}

async function fetchSingleWithRetry(db, table, filters, columns, requiredColumns = new Set()) {
  let lastError = null;
  const cols = [...columns];

  for (let attempt = 0; attempt < cols.length; attempt++) {
    let q = db.from(table).select(cols.join(', '));
    for (const [key, value] of Object.entries(filters || {})) {
      q = q.eq(key, value);
    }

    const { data, error } = await q.single();
    if (!error) return { data, error: null };

    lastError = error;

    if (error.code === 'PGRST116') {
      return { data: null, error };
    }

    const missing = getMissingColumn(error.message, table);
    if (!missing) break;

    if (requiredColumns.has(missing)) {
      const e = new Error(
        `Database is missing ${table}.${missing} (or schema cache is stale). Run the latest SQL schema and reload PostgREST:\n\nNOTIFY pgrst, 'reload schema';`,
      );
      e.code = 'SCHEMA_MISSING_REQUIRED';
      throw e;
    }

    const idx = cols.indexOf(missing);
    if (idx === -1) break;
    cols.splice(idx, 1);
  }

  throw lastError;
}

async function fetchSignupWithRetry(db, { accountRequestId, contactNumber }) {
  const columns = [
    'id',
    'status',
    'created_at',
    'processed_by',
    'processed_at',
    'notes',
    'first_name',
    'middle_name',
    'last_name',
    'birthday',
    'age',
    'birthplace',
    'sex',
    'citizenship',
    'civil_status',
    'contact_number',
    'house_no',
    'purok',
    'street',
    'barangay',
    'city',
    'is_pwd',
    'is_senior_citizen',
    'is_solo_parent',
    'valid_id_url',
  ];

  const required = new Set(['id', 'contact_number', 'status']);

  const run = async (cols) => {
    if (accountRequestId) {
      return db.from('account_requests').select(cols.join(', ')).eq('id', accountRequestId).maybeSingle();
    }

    if (!contactNumber) {
      return { data: null, error: null };
    }

    const candidates = contactCandidates(contactNumber);

    // Primary: exact match against common stored formats
    let q = db.from('account_requests').select(cols.join(', '));
    if (candidates.length > 1) {
      q = q.in('contact_number', candidates);
    } else {
      q = q.eq('contact_number', candidates[0] || contactNumber);
    }

    const primary = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!primary?.error && primary?.data) return primary;

    // Fallback: older rows may store contact with spaces/dashes, so do a fuzzy search and normalize in code.
    const normalized = normalizeContactNumber(contactNumber);
    if (!normalized || normalized.length < 10) return primary;

    const tail = normalized.slice(-9); // reduce collisions while still matching formatted strings
    const fuzzy = await db
      .from('account_requests')
      .select(cols.join(', '))
      .ilike('contact_number', `%${tail}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fuzzy?.error || !Array.isArray(fuzzy?.data) || !fuzzy.data.length) return primary;

    const match = fuzzy.data.find((row) => normalizeContactNumber(row?.contact_number) === normalized);
    return { data: match || null, error: null };
  };

  let lastError = null;
  const cols = [...columns];
  for (let attempt = 0; attempt < cols.length; attempt++) {
    const { data, error } = await run(cols);
    if (!error) return { data: data || null, error: null };

    lastError = error;
    if (error.code === 'PGRST116') return { data: null, error: null };

    const missing = getMissingColumn(error.message, 'account_requests');
    if (!missing) break;

    if (required.has(missing)) {
      const e = new Error(
        `Database is missing account_requests.${missing} (or schema cache is stale). Run the latest SQL schema and reload PostgREST:\n\nNOTIFY pgrst, 'reload schema';`,
      );
      e.code = 'SCHEMA_MISSING_REQUIRED';
      throw e;
    }

    const idx = cols.indexOf(missing);
    if (idx === -1) break;
    cols.splice(idx, 1);
  }

  // If account_requests is not available, just return null; do not block profile viewing.
  console.warn('Fetch signup info failed:', lastError?.message || lastError);
  return { data: null, error: null };
}

export async function GET(request, { params }) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  const isAdmin = auth?.profile?.role === 'Admin';

  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: residentId } = await params;
    if (!residentId) {
      return NextResponse.json({ data: null, error: 'Resident ID is required.' }, { status: 400 });
    }

    const residentColumns = [
      'id',
      'control_number',
      'first_name',
      'middle_name',
      'last_name',
      'birthday',
      'age',
      'birthplace',
      'sex',
      'citizenship',
      'civil_status',
      'contact_number',
      'house_no',
      'purok',
      'street',
      'barangay',
      'city',
      'is_pwd',
      'is_senior_citizen',
      'is_solo_parent',
      'status',
      'created_at',
      'updated_at',
    ];

    // Require these columns to exist in schema cache so the Admin UI can show full details.
    // (Values may still be NULL, but the column must be selectable.)
    const required = new Set([
      'id',
      'control_number',
      'first_name',
      'last_name',
      'birthplace',
      'sex',
      'citizenship',
      'civil_status',
    ]);

    let { data: resident, error: residentError } = await fetchSingleWithRetry(
      db,
      'residents',
      { id: residentId },
      residentColumns,
      required,
    );

    if (residentError) {
      if (residentError.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
      }
      throw residentError;
    }

    let accountRequestId = null;
    try {
      const { data: arRow, error: arError } = await db
        .from('residents')
        .select('account_request_id')
        .eq('id', residentId)
        .maybeSingle();

      if (!arError && arRow?.account_request_id) {
        accountRequestId = arRow.account_request_id;
      }
    } catch (e) {
      const msg = String(e?.message || e || '').toLowerCase();
      const missing = msg.includes('account_request_id') && (msg.includes('does not exist') || msg.includes('schema cache'));
      if (!missing) {
        console.warn('Fetch residents.account_request_id failed (continuing):', e?.message || e);
      }
    }

    const signup = await fetchSignupWithRetry(db, {
      accountRequestId,
      contactNumber: resident?.contact_number || null,
    });

    const signupData = signup.data;

    // Reflect sign-up fields into resident data (for display) when resident fields are blank.
    const reflected = { ...resident };
    const backfill = {};

    if (signupData) {
      const keys = [
        'birthday',
        'age',
        'birthplace',
        'sex',
        'citizenship',
        'civil_status',
        'house_no',
        'purok',
        'street',
        'barangay',
        'city',
      ];

      for (const k of keys) {
        if (isBlank(reflected[k]) && !isBlank(signupData[k])) {
          reflected[k] = signupData[k];
          backfill[k] = signupData[k];
        }
      }

      for (const k of ['is_pwd', 'is_senior_citizen', 'is_solo_parent']) {
        if (reflected[k] == null && signupData[k] != null) {
          reflected[k] = !!signupData[k];
          backfill[k] = !!signupData[k];
        }
      }

      if (!accountRequestId && signupData?.id) {
        backfill.account_request_id = signupData.id;
      }
    }

    // Best-effort: persist missing fields to residents so future views are accurate.
    // Only fills blanks; never overwrites existing resident data.
    if (Object.keys(backfill).length) {
      let payload = { ...backfill };
      let lastErr = null;
      const cols = Object.keys(payload);

      for (let attempt = 0; attempt < cols.length; attempt++) {
        const { error } = await db.from('residents').update(payload).eq('id', residentId);
        if (!error) break;

        lastErr = error;
        const missing = getMissingColumn(error.message, 'residents');
        if (!missing || !(missing in payload)) break;

        const next = { ...payload };
        delete next[missing];
        payload = next;

        if (!Object.keys(payload).length) break;
      }

      if (lastErr) {
        const msg = String(lastErr?.message || '').toLowerCase();
        const missing = msg.includes('does not exist') || msg.includes('schema cache');
        if (!missing) {
          console.warn('Backfill residents from signup failed (continuing):', lastErr?.message || lastErr);
        }
      }
    }

    const reflectedAccountRequestId = accountRequestId || signupData?.id || null;

    return NextResponse.json(
      {
        data: {
          resident: { ...reflected, account_request_id: reflectedAccountRequestId },
          signup: isAdmin ? signupData : null,
        },
        error: null,
      },
    );
  } catch (err) {
    console.error('Fetch resident details error:', err);
    return NextResponse.json(
      { data: null, error: err?.message || 'Failed to fetch resident details.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: residentId } = await params;
    if (!residentId) {
      return NextResponse.json({ data: null, error: 'Resident ID is required.' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    // Fetch existing minimal info for uniqueness checks.
    // Some older Supabase schemas may not have residents.account_request_id yet.
    let existing = null;
    let existingErr = null;

    {
      const res = await db
        .from('residents')
        .select('id, contact_number, account_request_id')
        .eq('id', residentId)
        .maybeSingle();

      existing = res.data;
      existingErr = res.error;

      const missing = getMissingColumn(existingErr?.message, 'residents');
      if (missing === 'account_request_id') {
        const fallback = await db
          .from('residents')
          .select('id, contact_number')
          .eq('id', residentId)
          .maybeSingle();

        existing = fallback.data;
        existingErr = fallback.error;
      }
    }

    if (existingErr || !existing) {
      return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
    }

    const existingAccountRequestId = existing?.account_request_id || null;

    const first_name = String(body?.first_name ?? body?.firstName ?? '').trim();
    const middle_nameRaw = body?.middle_name ?? body?.middleName ?? null;
    const last_name = String(body?.last_name ?? body?.lastName ?? '').trim();

    const contact_number = normalizeContactNumber(body?.contact_number ?? body?.contactNumber ?? existing.contact_number);

    const birthday = body?.birthday ?? null;
    const birthplace = body?.birthplace ?? null;
    const sex = body?.sex ?? null;
    const citizenship = body?.citizenship ?? null;
    const civil_status = body?.civil_status ?? body?.civilStatus ?? null;

    const house_no = body?.house_no ?? body?.houseNo ?? null;
    const purok = body?.purok ?? null;
    const street = body?.street ?? null;
    const barangay = body?.barangay ?? null;
    const city = body?.city ?? null;

    const is_pwd = !!(body?.is_pwd ?? body?.isPwd);
    const is_senior_citizen = !!(body?.is_senior_citizen ?? body?.isSeniorCitizen);
    const is_solo_parent = !!(body?.is_solo_parent ?? body?.isSoloParent);

    const status = body?.status ?? null;

    if (!first_name || !last_name) {
      return NextResponse.json({ data: null, error: 'First name and last name are required.' }, { status: 400 });
    }

    if (!contact_number || contact_number.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    const sectorCount = [is_pwd, is_senior_citizen, is_solo_parent].filter(Boolean).length;
    if (sectorCount > 1) {
      return NextResponse.json(
        { data: null, error: 'Only one sector classification can be selected.' },
        { status: 400 },
      );
    }

    // Uniqueness guard if contact number changes
    if (contact_number && contact_number !== existing.contact_number) {
      const { data: dupResident, error: dupErr } = await db
        .from('residents')
        .select('id')
        .eq('contact_number', contact_number)
        .neq('id', residentId)
        .limit(1)
        .maybeSingle();

      if (dupErr && dupErr.code !== 'PGRST116') throw dupErr;
      if (dupResident) {
        return NextResponse.json(
          { data: null, error: 'This contact number is already registered and cannot be used again.' },
          { status: 409 },
        );
      }

      // Also guard against any other signup request using it (contact is unique there too)
      const { data: dupReq, error: dupReqErr } = await db
        .from('account_requests')
        .select('id')
        .eq('contact_number', contact_number)
        .limit(1)
        .maybeSingle();

      if (dupReqErr && dupReqErr.code !== 'PGRST116') {
        // If table/columns are missing, ignore and rely on residents uniqueness.
        const msg = String(dupReqErr?.message || '').toLowerCase();
        const missingTable = msg.includes('account_requests') && (msg.includes('does not exist') || msg.includes('schema cache'));
        if (!missingTable) throw dupReqErr;
      }

      if (dupReq && dupReq.id && existingAccountRequestId && dupReq.id !== existingAccountRequestId) {
        return NextResponse.json(
          { data: null, error: 'This contact number is already used by a sign-up request and cannot be reused.' },
          { status: 409 },
        );
      }

      if (dupReq && dupReq.id && !existingAccountRequestId) {
        return NextResponse.json(
          { data: null, error: 'This contact number is already used by a sign-up request and cannot be reused.' },
          { status: 409 },
        );
      }
    }

    const middle_name = middle_nameRaw == null ? null : String(middle_nameRaw).trim() || null;

    const updates = {
      first_name,
      middle_name,
      last_name,
      birthday,
      birthplace,
      sex,
      citizenship,
      civil_status,
      contact_number,
      house_no,
      purok,
      street,
      barangay,
      city,
      is_pwd,
      is_senior_citizen,
      is_solo_parent,
      ...(status ? { status } : {}),
    };

    // Update with a small retry to tolerate outdated schema caches.
    // IMPORTANT: if the admin provided a value for certain fields, do NOT silently drop them.
    const required = new Set(['first_name', 'last_name', 'contact_number']);
    const nonDroppableIfProvided = new Set([
      'birthplace',
      'sex',
      'citizenship',
      'civil_status',
    ]);

    const selectColumns = [
      'id',
      'account_request_id',
      'control_number',
      'first_name',
      'middle_name',
      'last_name',
      'birthday',
      'age',
      'birthplace',
      'sex',
      'citizenship',
      'civil_status',
      'contact_number',
      'house_no',
      'purok',
      'street',
      'barangay',
      'city',
      'valid_id_url',
      'is_pwd',
      'is_senior_citizen',
      'is_solo_parent',
      'status',
      'created_at',
      'updated_at',
    ];

    let payload = { ...updates };
    let selectCols = [...selectColumns];
    let lastError = null;

    const maxAttempts = Object.keys(payload).length + selectCols.length;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data, error } = await db
        .from('residents')
        .update(payload)
        .eq('id', residentId)
        .select(selectCols.join(', '))
        .single();

      if (!error) {
        let accountRequestId = data?.account_request_id || existingAccountRequestId;

        // Best-effort: if admin completes missing info on the resident profile,
        // backfill the linked signup request so Signup Details shows the exact details.
        // If residents.account_request_id isn't available, fall back to latest request by contact number.
        if (!accountRequestId && data?.contact_number) {
          try {
            const candidates = contactCandidates(data.contact_number);
            let q = db.from('account_requests').select('id, contact_number, created_at');
            if (candidates.length > 1) q = q.in('contact_number', candidates);
            else q = q.eq('contact_number', candidates[0] || data.contact_number);

            const { data: arMatch } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (arMatch?.id) accountRequestId = arMatch.id;
          } catch {
            // ignore
          }
        }

        if (accountRequestId) {
          try {
            const { data: ar } = await db
              .from('account_requests')
              .select(
                [
                  'id',
                  'first_name',
                  'middle_name',
                  'last_name',
                  'birthday',
                  'age',
                  'birthplace',
                  'sex',
                  'citizenship',
                  'civil_status',
                  'contact_number',
                  'house_no',
                  'purok',
                  'barangay',
                  'city',
                  'valid_id_url',
                ].join(', '),
              )
              .eq('id', accountRequestId)
              .maybeSingle();

            const backfill = {};
            for (const f of [
              'first_name',
              'middle_name',
              'last_name',
              'birthday',
              'age',
              'birthplace',
              'sex',
              'citizenship',
              'civil_status',
              'contact_number',
              'house_no',
              'purok',
              'barangay',
              'city',
              'valid_id_url',
            ]) {
              if (isBlank(ar?.[f]) && !isBlank(data?.[f])) backfill[f] = data[f];
            }

            if (Object.keys(backfill).length) {
              await db.from('account_requests').update(backfill).eq('id', accountRequestId);
            }
          } catch {
            // ignore: account_requests may be unavailable in older schemas
          }
        }

        return NextResponse.json({ data, error: null });
      }

      lastError = error;
      const missing = getMissingColumn(error.message, 'residents');
      if (!missing) break;

      if (required.has(missing)) {
        return NextResponse.json(
          {
            data: null,
            error:
              `Database is missing residents.${missing} (or schema cache is stale). Run the latest SQL schema and reload PostgREST:\n\n` +
              `NOTIFY pgrst, 'reload schema';`,
          },
          { status: 500 },
        );
      }

      let changed = false;

      if (missing in payload) {
        // If the admin provided a value for this field, do NOT silently drop it.
        if (nonDroppableIfProvided.has(missing) && !isBlank(payload[missing])) {
          return NextResponse.json(
            {
              data: null,
              error:
                `Cannot save ${missing} because residents.${missing} is not available in the PostgREST schema cache. ` +
                `Run in Supabase SQL Editor:\n\nNOTIFY pgrst, 'reload schema';\n\nThen try saving again.`,
            },
            { status: 500 },
          );
        }

        const next = { ...payload };
        delete next[missing];
        payload = next;
        changed = true;
      }

      const selectIdx = selectCols.indexOf(missing);
      if (selectIdx !== -1) {
        selectCols.splice(selectIdx, 1);
        changed = true;
      }

      if (!changed) break;
      if (!selectCols.length) break;
    }

    throw lastError;
  } catch (err) {
    console.error('Update resident profile error:', err);
    const msg = String(err?.message || 'Failed to update beneficiary profile.');
    const lower = msg.toLowerCase();

    if (lower.includes('duplicate key value violates unique constraint')) {
      return NextResponse.json(
        { data: null, error: 'This contact number is already registered and cannot be used again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
