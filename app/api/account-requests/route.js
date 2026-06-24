import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwords.server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { filterCloudinaryUrls, validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { logActivity } from '@/lib/activityLogger.server';
import { applyDirectSectorFilter } from '@/lib/sectorAccess';
import { validateSectorPair } from '@/lib/beneficiarySectors';

export const runtime = 'nodejs';

const LOCKED_CITIZENSHIP = 'Filipino';
const SOLO_PARENT_MARRIED_ERROR = 'Married civil status is not allowed for Solo Parent classification.';
const MINOR_PWD_REPRESENTATIVE_ERROR =
  'Beneficiaries below 18 years old must provide a guardian or representative before registration can be completed.';
const VALID_ID_BOTH_SIDES_ERROR = 'Please upload both the front and back images of your valid ID.';
const FACE_VERIFICATION_FAILED_ERROR =
  'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.';

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

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

function isMissingSmsOtpsTable(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return msg.includes('sms_otps') || msg.includes('does not exist') || code === '42p01';
}

async function requireSignupOtp(db, contactNumber) {
  const { data: otpRow, error } = await db
    .from('sms_otps')
    .select('id, verified_at, expires_at, consumed_at')
    .eq('contact_number', contactNumber)
    .eq('purpose', 'signup')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    if (isMissingSmsOtpsTable(error)) {
      throw new Error(
        'SMS OTP verification is not configured. Run the SMS schema script (setup-step6.sql) and reload PostgREST.',
      );
    }
    throw error;
  }

  if (!otpRow || !otpRow.verified_at) {
    return { ok: false, error: 'Please verify your contact number via SMS OTP before submitting.' };
  }

  if (otpRow.consumed_at) {
    return { ok: false, error: 'OTP already used. Please request a new code.' };
  }

  if (otpRow.expires_at && new Date(otpRow.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'OTP expired. Please request a new code.' };
  }

  return { ok: true, otpId: otpRow.id };
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
    'valid_id_front_url',
    'valid_id_back_url',
    'selfie_url',
    'face_verification_status',
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

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const hasPagination = pageParam != null || pageSizeParam != null;
    const page = parsePositiveInt(pageParam, 1, { min: 1, max: 100000 });
    const pageSize = parsePositiveInt(pageSizeParam, 25, { min: 1, max: 100 });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

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
      'primary_sector',
      'secondary_sector',
      'valid_id_url',
      'valid_id_urls',
      'valid_id_front_url',
      'valid_id_back_url',
      'selfie_url',
      'face_verification_status',
      'face_verification_score',
      'face_verification_provider',
      'face_verified_at',
      'face_verification_error',
      'representative_name',
      'representative_contact',
      'representative_relationship',
      'representative_valid_id_url',
      'status',
      'notes',
      'processed_by',
      'processed_at',
      'created_at',
      'updated_at',
    ];

    let lastError = null;
    for (let attempt = 0; attempt < columns.length; attempt++) {
      let query = db
        .from('account_requests')
        .select(columns.join(', '), hasPagination ? { count: 'exact' } : undefined)
        .order('created_at', { ascending: false });

      query = applyDirectSectorFilter(query, auth.profile);
      if (!query) {
        return NextResponse.json({
          data: [],
          error: null,
          meta: hasPagination
            ? { page, pageSize, total: 0, totalPages: 0 }
            : undefined,
        });
      }

      if (hasPagination) query = query.range(from, to);

      const { data, error, count } = await query;

      if (!error) {
        return NextResponse.json({
          data,
          error: null,
          meta: hasPagination
            ? {
                page,
                pageSize,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / pageSize),
              }
            : undefined,
        });
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

    const otpCheck = await requireSignupOtp(db, contactNumber);
    if (!otpCheck.ok) {
      return NextResponse.json({ data: null, error: otpCheck.error }, { status: 403 });
    }

    const sectorValidation = validateSectorPair(body);
    if (!sectorValidation.ok) {
      return NextResponse.json({ data: null, error: sectorValidation.error }, { status: 400 });
    }
    const { primarySector, secondarySector, flags: sectorFlags } = sectorValidation;
    const sectorCount = Object.values(sectorFlags).filter(Boolean).length;
    const civilStatus = String(body.civilStatus || body.civil_status || '').trim().toLowerCase();
    if (sectorFlags.is_solo_parent && civilStatus === 'married') {
      return NextResponse.json({ data: null, error: SOLO_PARENT_MARRIED_ERROR }, { status: 400 });
    }

    const validIdFrontUrl = body.validIdFrontUrl || body.valid_id_front_url || null;
    const validIdBackUrl = body.validIdBackUrl || body.valid_id_back_url || null;
    const selfieUrl = body.selfieUrl || body.selfie_url || null;
    const faceVerificationStatus = String(
      body.faceVerificationStatus || body.face_verification_status || '',
    ).trim();
    const faceVerificationScore = body.faceVerificationScore ?? body.face_verification_score ?? null;
    const faceVerificationProvider = body.faceVerificationProvider || body.face_verification_provider || null;
    const faceVerifiedAt = body.faceVerifiedAt || body.face_verified_at || null;
    const faceVerificationError = body.faceVerificationError || body.face_verification_error || null;

    if (!validIdFrontUrl || !validIdBackUrl) {
      return NextResponse.json({ data: null, error: VALID_ID_BOTH_SIDES_ERROR }, { status: 400 });
    }
    if (!selfieUrl) {
      return NextResponse.json({ data: null, error: 'Selfie/face capture is required.' }, { status: 400 });
    }

    const identityDocCheck = validateCloudinaryDocumentUrls([validIdFrontUrl, validIdBackUrl, selfieUrl], {
      label: 'Identity document',
    });
    if (!identityDocCheck.ok) {
      return NextResponse.json({ data: null, error: identityDocCheck.error }, { status: 400 });
    }

    const cloudinaryIdentityUrls = filterCloudinaryUrls([validIdFrontUrl, validIdBackUrl, selfieUrl]);
    if (cloudinaryIdentityUrls.length !== 3) {
      return NextResponse.json({ data: null, error: 'Identity documents must be uploaded to Cloudinary.' }, { status: 400 });
    }
    if (faceVerificationStatus !== 'passed') {
      return NextResponse.json({ data: null, error: FACE_VERIFICATION_FAILED_ERROR }, { status: 400 });
    }

    const validIdUrl = body.validIdUrl || body.valid_id_url || validIdFrontUrl || null;
    const validIdUrls = parseValidIdUrls(body.validIdUrls ?? body.valid_id_urls);
    const effectiveValidIdUrls = validIdUrls.length
      ? validIdUrls
      : [validIdFrontUrl, validIdBackUrl].filter(Boolean);

    if (effectiveValidIdUrls.length) {
      const docCheck = validateCloudinaryDocumentUrls(effectiveValidIdUrls, { label: 'Valid ID' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }

    const cloudinaryValidIdUrls = filterCloudinaryUrls(effectiveValidIdUrls);

    if (sectorCount > 0 && cloudinaryValidIdUrls.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Valid ID is required to verify your sector classification.' },
        { status: 400 },
      );
    }

    const age = calculateAge(body.birthday);
    if (age === null || age < 0) {
      return NextResponse.json({ data: null, error: 'Please provide a valid birthday.' }, { status: 400 });
    }
    if (age < 18 && !sectorFlags.is_pwd) {
      return NextResponse.json(
        { data: null, error: 'You must be at least 18 years old unless classified as PWD.' },
        { status: 400 },
      );
    }
    if (sectorFlags.is_senior_citizen && age < 60) {
      return NextResponse.json(
        { data: null, error: 'Senior Citizen selection requires age 60 or above.' },
        { status: 400 },
      );
    }

    const representativeName = String(body.representativeName || body.representative_name || '').trim();
    const representativeContact = normalizeContactNumber(body.representativeContact || body.representative_contact || '');
    const representativeRelationship = String(
      body.representativeRelationship || body.representative_relationship || '',
    ).trim();
    const representativeValidIdUrl =
      body.representativeValidIdUrl || body.representative_valid_id_url || null;
    const representativeUrls = representativeValidIdUrl ? [String(representativeValidIdUrl)] : [];
    if (representativeUrls.length) {
      const docCheck = validateCloudinaryDocumentUrls(representativeUrls, { label: 'Representative valid ID' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }
    const cloudinaryRepresentativeUrls = filterCloudinaryUrls(representativeUrls);
    const requiresRepresentative = age < 18 && sectorFlags.is_pwd;
    if (
      requiresRepresentative &&
      (!representativeName ||
        !representativeContact ||
        representativeContact.length !== 11 ||
        !representativeRelationship ||
        cloudinaryRepresentativeUrls.length === 0)
    ) {
      return NextResponse.json({ data: null, error: MINOR_PWD_REPRESENTATIVE_ERROR }, { status: 400 });
    }
    if (representativeContact && representativeContact.length !== 11) {
      return NextResponse.json(
        { data: null, error: 'Guardian/Representative contact number must be exactly 11 digits.' },
        { status: 400 },
      );
    }
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
          { data: null, error: 'This contact number is already registered' },
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
      citizenship: LOCKED_CITIZENSHIP,
      civil_status: body.civilStatus || body.civil_status || null,
      house_no: body.houseNo,
      purok: body.purok,
      street: body.street || null,
      barangay: body.barangay || 'Sta. Rita',
      city: body.city || 'Olongapo City',
      primary_sector: primarySector,
      secondary_sector: secondarySector || null,
      is_pwd: sectorFlags.is_pwd,
      is_senior_citizen: sectorFlags.is_senior_citizen,
      is_solo_parent: sectorFlags.is_solo_parent,
      valid_id_url: validIdFrontUrl || cloudinaryValidIdUrls[0] || null,
      valid_id_urls: cloudinaryValidIdUrls.length ? cloudinaryValidIdUrls : [validIdFrontUrl, validIdBackUrl],
      valid_id_front_url: validIdFrontUrl,
      valid_id_back_url: validIdBackUrl,
      selfie_url: selfieUrl,
      face_verification_status: faceVerificationStatus,
      face_verification_score: faceVerificationScore,
      face_verification_provider: faceVerificationProvider || null,
      face_verified_at: faceVerifiedAt || new Date().toISOString(),
      face_verification_error: faceVerificationError || null,
      representative_name: representativeName || null,
      representative_contact: representativeContact || null,
      representative_relationship: representativeRelationship || null,
      representative_valid_id_url: cloudinaryRepresentativeUrls[0] || null,
      status: 'Pending',
      password_hash: passwordHash,
    };

    const { data } = await insertAccountRequestWithRetry(db, insertPayload);

    await logActivity(
      {
        actor_name: [data?.first_name, data?.middle_name, data?.last_name].filter(Boolean).join(' ') || 'Beneficiary',
        actor_role: 'Beneficiary',
        action: 'Submitted account request',
        message: 'A beneficiary submitted a signup request.',
        entity_type: 'account_request',
        entity_id: data?.id || null,
        reference_number: data?.contact_number || contactNumber,
        link: '/admin/account-requests',
      },
      supabaseAdmin ?? db,
    );

    let otpConsumeError = null;
    if (otpCheck?.otpId) {
      const { error: consumeError } = await db
        .from('sms_otps')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', otpCheck.otpId);
      if (consumeError) {
        otpConsumeError = consumeError.message || 'Failed to mark OTP as used.';
      }
    }

    return NextResponse.json({
      data,
      error: null,
      message:
        'PENDING APPROVAL: Your sign-up request was submitted successfully. Please wait for admin approval before you can log in.',
      meta: otpConsumeError ? { otpConsumed: false, otpError: otpConsumeError } : { otpConsumed: true },
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
