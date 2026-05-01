import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwords.server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

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

function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function parseValidIdUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
    const single = value.trim();
    return single ? [single] : [];
  }
  return [];
}

function getMissingAccountRequestsColumn(message) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(/Could not find the '([^']+)' column of 'account_requests' in the schema cache/i);
  if (match?.[1]) return match[1];

  // Postgres error surfaced via PostgREST
  match = msg.match(/column\s+account_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  // Another common Postgres phrasing
  match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"account_requests"\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  return null;
}

async function insertAccountRequestWithRetry(db, payload) {
  const requiredColumns = new Set([
    'first_name',
    'last_name',
    'birthday',
    'contact_number',
    'house_no',
    'purok',
    // Personal info required by the sign-up flow.
    'birthplace',
    'sex',
    'citizenship',
    'civil_status',
    // These have defaults, but the columns must exist.
    'barangay',
    'city',
    // Stored when sector classification requires verification.
    'valid_id_url',
    // Do not silently drop password_hash; approval/login flow depends on it.
    'password_hash',
  ]);

  let current = payload;
  const stripped = [];
  const maxSteps = Math.max(10, Object.keys(payload || {}).length + 2);

  for (let step = 0; step < maxSteps; step++) {
    const { data, error } = await db
      .from('account_requests')
      .insert(current)
      .select('id, status, created_at')
      .single();

    if (!error) return { data, stripped };

    const missing = getMissingAccountRequestsColumn(error.message);
    if (!missing) throw error;

    if (requiredColumns.has(missing)) {
      const msg =
        `Database is missing account_requests.${missing} (or schema cache is stale). ` +
        `Run the latest database schema script (database-schema.sql / setup-step4.sql) and then reload PostgREST:\n\n` +
        `NOTIFY pgrst, 'reload schema';`;
      const e = new Error(msg);
      e.code = 'SCHEMA_MISSING_REQUIRED';
      throw e;
    }

    if (!(missing in current)) {
      const e = new Error(
        `Schema cache is stale for account_requests.${missing}. Run in Supabase SQL Editor:\n\n` +
          `NOTIFY pgrst, 'reload schema';`,
      );
      e.code = 'SCHEMA_CACHE_STALE';
      throw e;
    }

    const next = { ...current };
    delete next[missing];
    current = next;
    stripped.push(missing);
  }

  const msg =
    `Database schema appears outdated (missing columns like: ${stripped.join(', ') || 'unknown'}). ` +
    `Please run the latest database schema script (database-schema.sql / setup-step4.sql) and then reload PostgREST:\n\n` +
    `NOTIFY pgrst, 'reload schema';`;
  const e = new Error(msg);
  e.code = 'SCHEMA_TOO_OLD';
  throw e;
}

export async function GET(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        {
          data: null,
          error: 'Server configuration error. Database client not available.',
        },
        { status: 500 },
      );
    }

    const columns = [
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
      'street',
      'barangay',
      'city',
      'is_pwd',
      'is_senior_citizen',
      'is_solo_parent',
      'valid_id_url',
      'valid_id_urls',
      'status',
      'notes',
      'processed_by',
      'processed_at',
      'created_at',
      'updated_at',
    ];

    let lastError = null;
    for (let attempt = 0; attempt < columns.length; attempt++) {
      const { data, error } = await db
        .from('account_requests')
        .select(columns.join(', '))
        .order('created_at', { ascending: false });

      if (!error) {
        return NextResponse.json({ data, error: null });
      }

      lastError = error;
      const missing = getMissingAccountRequestsColumn(error.message);
      if (!missing) break;

      const idx = columns.indexOf(missing);
      if (idx === -1) break;
      columns.splice(idx, 1);
    }

    throw lastError;
  } catch (error) {
    console.error('Fetch account requests error:', error);
    return NextResponse.json({ data: null, error: error.message || 'Failed to fetch account requests.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        {
          data: null,
          error: 'Server configuration error. Database client not available.',
        },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const contactNumber = normalizeContactNumber(body.contactNumber);
    const password = body.password;

    if (
      !body.firstName ||
      !body.lastName ||
      !body.birthday ||
      !body.birthplace ||
      !body.sex ||
      !body.citizenship ||
      !body.civilStatus ||
      !contactNumber ||
      !body.houseNo ||
      !body.purok
    ) {
      return NextResponse.json({ data: null, error: 'Missing required fields.' }, { status: 400 });
    }

    if (contactNumber.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    const sectorCount = [!!body.isPwd, !!body.isSeniorCitizen, !!body.isSoloParent].filter(Boolean).length;
    if (sectorCount > 1) {
      return NextResponse.json(
        { data: null, error: 'Only one sector classification can be selected.' },
        { status: 400 },
      );
    }

    const validIdUrl = body.validIdUrl || body.valid_id_url || null;
    const validIdUrls = parseValidIdUrls(body.validIdUrls ?? body.valid_id_urls);
    const effectiveValidIdUrls = validIdUrls.length
      ? validIdUrls
      : (validIdUrl ? [String(validIdUrl)] : []);
    if (sectorCount > 0 && effectiveValidIdUrls.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Valid ID is required to verify your sector classification.' },
        { status: 400 },
      );
    }

    const age = calculateAge(body.birthday);
    const passwordHash = await hashPassword(password);

    // Enforce uniqueness: contact number cannot be used more than once
    const { data: existingRequest, error: existingRequestError } = await db
      .from('account_requests')
      .select('id, status')
      .eq('contact_number', contactNumber)
      .limit(1)
      .maybeSingle();

    if (existingRequestError && existingRequestError.code !== 'PGRST116') {
      throw existingRequestError;
    }

    if (existingRequest) {
      return NextResponse.json(
        { data: null, error: 'This contact number has already been used. Please use a different contact number.' },
        { status: 409 },
      );
    }

    // Best-effort: also block if already registered as a resident
    try {
      const { data: existingResident, error: existingResidentError } = await db
        .from('residents')
        .select('id')
        .eq('contact_number', contactNumber)
        .limit(1)
        .maybeSingle();

      if (!existingResidentError && existingResident) {
        return NextResponse.json(
          { data: null, error: 'This contact number is already registered. Please log in instead.' },
          { status: 409 },
        );
      }
    } catch {
      // Ignore if residents table is not accessible in this environment
    }

    const insertPayload = {
      first_name: body.firstName,
      middle_name: body.middleName || null,
      last_name: body.lastName,
      birthday: body.birthday,
      contact_number: contactNumber,
      age,
      birthplace: body.birthplace || null,
      sex: body.sex || null,
      citizenship: body.citizenship || null,
      civil_status: body.civilStatus || body.civil_status || null,
      house_no: body.houseNo,
      purok: body.purok,
      street: body.street || null,
      barangay: body.barangay || 'Sta. Rita',
      city: body.city || 'Olongapo City',
      is_pwd: !!body.isPwd,
      is_senior_citizen: !!body.isSeniorCitizen,
      is_solo_parent: !!body.isSoloParent,
      valid_id_url: effectiveValidIdUrls[0] || null,
      valid_id_urls: effectiveValidIdUrls,
      status: 'Pending',
      password_hash: passwordHash,
    };

    const { data } = await insertAccountRequestWithRetry(db, insertPayload);

    return NextResponse.json({
      data,
      error: null,
      message:
        'PENDING APPROVAL: Your sign-up request was submitted successfully. Please wait for admin approval before you can log in.',
    });
  } catch (error) {
    console.error('Create account request error:', error);

    const code = error?.code;
    const message = String(error?.message || '');
    if (code === '23505' || message.toLowerCase().includes('duplicate key value violates unique constraint')) {
      return NextResponse.json(
        { data: null, error: 'This contact number has already been used. Please use a different contact number.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ data: null, error: error.message || 'Failed to create account request.' }, { status: 500 });
  }
}
