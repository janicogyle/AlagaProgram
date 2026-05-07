import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { createOrUpdateResident } from '@/lib/residents';

export const runtime = 'nodejs';

function getMissingAccountRequestsColumn(message) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(/Could not find the '([^']+)' column of 'account_requests' in the schema cache/i);
  if (match?.[1]) return match[1];

  // Postgres error surfaced via PostgREST
  match = msg.match(/column\s+account_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"account_requests"\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  return null;
}

async function fetchAccountRequestWithRetry(db, requestId) {
  const required = new Set([
    'id',
    'status',
    'first_name',
    'last_name',
    'contact_number',
    'house_no',
    'purok',
  ]);

  const columns = [
    'id',
    'status',
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
    'valid_id_urls',
    'notes',
    'processed_by',
    'processed_at',
    'created_at',
    'updated_at',
    'password_hash',
  ];

  let lastError = null;
  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await db
      .from('account_requests')
      .select(columns.join(', '))
      .eq('id', requestId)
      .single();

    if (!error) return { data, error: null };

    lastError = error;

    if (error.code === 'PGRST116') {
      return { data: null, error };
    }

    const missing = getMissingAccountRequestsColumn(error.message);
    if (!missing) break;

    if (required.has(missing)) {
      const e = new Error(
        `Database is missing account_requests.${missing} (or schema cache is stale). ` +
          `Run the latest database schema script (database-schema.sql / setup-step4.sql) and then reload PostgREST:\n\n` +
          `NOTIFY pgrst, 'reload schema';`,
      );
      e.code = 'SCHEMA_MISSING_REQUIRED';
      throw e;
    }

    const idx = columns.indexOf(missing);
    if (idx === -1) break;
    columns.splice(idx, 1);
  }

  throw lastError;
}

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function mergeIfBlank(base, fallback, fields) {
  const merged = { ...(base || {}) };
  for (const f of fields) {
    if (isBlank(merged[f]) && !isBlank(fallback?.[f])) {
      merged[f] = fallback[f];
    }
  }
  return merged;
}

function parseValidIdUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    } catch {
      const single = value.trim();
      return single ? [single] : [];
    }
  }
  return [];
}

export async function GET(request, { params }) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: requestId } = await params;
    if (!requestId) {
      return NextResponse.json({ data: null, error: 'Request ID is required.' }, { status: 400 });
    }

    const { data: accountRequest, error: fetchError } = await fetchAccountRequestWithRetry(db, requestId);

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'Account request not found.' }, { status: 404 });
      }
      throw fetchError;
    }

    let merged = accountRequest;

    const normalizedStatus = accountRequest?.status === 'Rejected' ? 'Archived' : accountRequest?.status;
    if (normalizedStatus === 'Approved') {
      try {
        const residentSelectWithLink = [
          'account_request_id',
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ].join(', ');

        const residentSelectNoLink = [
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ].join(', ');

        let resident = null;
        let hasLinkColumn = true;

        // Preferred linkage (if residents.account_request_id exists)
        try {
          const { data: byRequestId, error: linkErr } = await db
            .from('residents')
            .select(residentSelectWithLink)
            .eq('account_request_id', requestId)
            .limit(1)
            .maybeSingle();

          if (linkErr) throw linkErr;
          resident = byRequestId || null;
        } catch (e) {
          const missing = String(e?.message || '').toLowerCase().includes('account_request_id');
          if (!missing) throw e;
          hasLinkColumn = false;
        }

        // Fallback linkage for older schemas: match by contact_number
        if (!resident && accountRequest?.contact_number) {
          const { data: byContact } = await db
            .from('residents')
            .select(hasLinkColumn ? residentSelectWithLink : residentSelectNoLink)
            .eq('contact_number', accountRequest.contact_number)
            .limit(1)
            .maybeSingle();

          resident = byContact || null;
        }

        // Best-effort: link it for future lookups (only if link column exists)
        if (hasLinkColumn) {
          try {
            if (resident && !resident.account_request_id) {
              await db
                .from('residents')
                .update({ account_request_id: requestId })
                .eq('contact_number', accountRequest.contact_number);
            }
          } catch {
            // best-effort only
          }
        }

        merged = mergeIfBlank(merged, resident, [
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ]);

        // Best-effort: backfill missing signup fields from the resident profile so the modal shows complete info.
        try {
          const backfill = {};
          for (const f of [
            'birthday',
            'age',
            'birthplace',
            'sex',
            'citizenship',
            'civil_status',
            'house_no',
            'purok',
            'barangay',
            'city',
            'valid_id_url',
            'valid_id_urls',
          ]) {
            if (isBlank(accountRequest?.[f]) && !isBlank(resident?.[f])) backfill[f] = resident[f];
          }

          if (Object.keys(backfill).length) {
            await db.from('account_requests').update(backfill).eq('id', requestId);
          }
        } catch {
          // best-effort only
        }
      } catch {
        // If residents table/column is unavailable, do not fail the details view.
      }
    }

    return NextResponse.json({ data: merged, error: null });
  } catch (error) {
    console.error('Fetch account request error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch account request.' },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: requestId } = await params;

    if (!requestId) {
      return NextResponse.json({ 
        data: null, 
        error: 'Request ID is required.' 
      }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ 
        data: null, 
        error: 'Invalid request body.' 
      }, { status: 400 });
    }

    const { action, processedBy, notes } = body;
    const normalizedAction = action === 'reject' ? 'archive' : action;

    if (!normalizedAction || !['approve', 'archive', 'unarchive'].includes(normalizedAction)) {
      return NextResponse.json(
        {
          data: null,
          error: 'Invalid action. Must be "approve", "archive", or "unarchive".',
        },
        { status: 400 },
      );
    }

    const { data: accountRequest, error: fetchError } = await fetchAccountRequestWithRetry(db, requestId);

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          {
            data: null,
            error: 'Account request not found.',
          },
          { status: 404 },
        );
      }
      throw fetchError;
    }

    const currentStatus = accountRequest.status === 'Rejected' ? 'Archived' : accountRequest.status;

    const requiresPending = normalizedAction === 'approve' || normalizedAction === 'archive';
    const requiresArchived = normalizedAction === 'unarchive';

    if (requiresPending && currentStatus !== 'Pending') {
      return NextResponse.json(
        {
          data: null,
          error: `This request cannot be ${normalizedAction}d because it is ${String(currentStatus).toLowerCase()}.`,
        },
        { status: 409 },
      );
    }

    if (requiresArchived && currentStatus !== 'Archived') {
      return NextResponse.json(
        {
          data: null,
          error: `Only archived requests can be unarchived. Current status: ${currentStatus}.`,
        },
        { status: 409 },
      );
    }

    if (normalizedAction === 'approve') {
      try {
        // Generate sequential control number for the new resident (YYYY-###)
        const year = new Date().getFullYear();
        let controlNumber = `${year}-001`;

        try {
          const { data: lastRow, error: lastError } = await db
            .from('residents')
            .select('control_number')
            .like('control_number', `${year}-%`)
            .order('control_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastError) {
            const last = String(lastRow?.control_number || '').trim();
            const match = last.match(new RegExp(`^${year}-(\\d{3})$`));
            const nextSeq = match ? Number(match[1]) + 1 : 1;
            if (Number.isFinite(nextSeq) && nextSeq > 0) {
              controlNumber = `${year}-${String(nextSeq).padStart(3, '0')}`;
            }
          }
        } catch {
          // fallback stays at YYYY-001
        }

        const contactNumber = accountRequest.contact_number;

        // Enforce uniqueness: do not allow a contact number to be used more than once
        try {
          const { data: existingResident, error: existingResidentError } = await db
            .from('residents')
            .select('id')
            .eq('contact_number', contactNumber)
            .limit(1)
            .maybeSingle();

          if (!existingResidentError && existingResident) {
            return NextResponse.json(
              { data: null, error: 'This contact number is already registered and cannot be used again.' },
              { status: 409 },
            );
          }
        } catch {
          // If residents table isn't readable here, rely on DB uniqueness (if present)
        }

        await createOrUpdateResident({
          control_number: controlNumber,
          account_request_id: requestId,
          first_name: accountRequest.first_name,
          middle_name: accountRequest.middle_name,
          last_name: accountRequest.last_name,
          birthday: accountRequest.birthday,
          age: accountRequest.age,
          birthplace: accountRequest.birthplace,
          sex: accountRequest.sex,
          citizenship: accountRequest.citizenship,
          civil_status: accountRequest.civil_status,
          contact_number: contactNumber,
          house_no: accountRequest.house_no,
          purok: accountRequest.purok,
          street: accountRequest.street,
          barangay: accountRequest.barangay || 'Sta. Rita',
          city: accountRequest.city || 'Olongapo City',
          valid_id_url: accountRequest.valid_id_url || parseValidIdUrls(accountRequest.valid_id_urls)[0] || null,
          is_pwd: accountRequest.is_pwd,
          is_senior_citizen: accountRequest.is_senior_citizen,
          is_solo_parent: accountRequest.is_solo_parent,
          status: 'Active',
          password_hash: accountRequest.password_hash || null,
        });
      } catch (residentError) {
        console.error('Failed to create resident:', residentError);

        const message = String(residentError?.message || 'Unknown error');
        if (message.toLowerCase().includes('duplicate key value violates unique constraint')) {
          return NextResponse.json(
            { data: null, error: 'This contact number is already registered and cannot be used again.' },
            { status: 409 },
          );
        }
        if (
          message.includes("password_hash") &&
          message.includes("residents") &&
          message.includes("schema cache")
        ) {
          return NextResponse.json(
            {
              data: null,
              error:
                "Database is missing residents.password_hash. Run in Supabase SQL Editor:\n\n" +
                "ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS password_hash text;\n" +
                "NOTIFY pgrst, 'reload schema';",
            },
            { status: 500 },
          );
        }

        const missingResidentsColumnMatch = message.match(
          /Could not find the '([^']+)' column of 'residents' in the schema cache/i,
        );
        if (missingResidentsColumnMatch) {
          const col = missingResidentsColumnMatch[1];
          const isSafeIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
          return NextResponse.json(
            {
              data: null,
              error:
                `Database is missing residents.${col}. Run in Supabase SQL Editor:\n\n` +
                (isSafeIdent
                  ? `ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS ${col} text;\n`
                  : "ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS <column_name> text;\n") +
                "NOTIFY pgrst, 'reload schema';",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            data: null,
            error: 'Failed to create resident account: ' + message,
          },
          { status: 500 },
        );
      }

      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Approved',
          processed_by: processedBy || 'Admin',
          processed_at: new Date().toISOString(),
          password_hash: null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at')
        .single();

      if (error) throw error;

      return NextResponse.json({ 
        data, 
        error: null, 
        message: 'Account request approved and resident account created successfully.' 
      });
    } else if (normalizedAction === 'archive') {
      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Archived',
          processed_by: processedBy || 'Admin',
          processed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at, notes')
        .single();

      if (error) throw error;

      return NextResponse.json({
        data,
        error: null,
        message: 'Account request archived.',
      });
    } else if (normalizedAction === 'unarchive') {
      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Pending',
          processed_by: null,
          processed_at: null,
          notes: notes || null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at, notes')
        .single();

      if (error) throw error;

      return NextResponse.json({
        data,
        error: null,
        message: 'Account request unarchived.',
      });
    }
  } catch (error) {
    console.error('Process account request error:', error);
    return NextResponse.json({ 
      data: null, 
      error: error.message || 'Failed to process account request.' 
    }, { status: 500 });
  }
}
