import crypto from 'crypto';

const RESUBMISSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RESUBMISSION_CODE_LENGTH = 8;

export function createAccountResubmissionCode() {
  let code = '';
  for (let i = 0; i < RESUBMISSION_CODE_LENGTH; i += 1) {
    code += RESUBMISSION_CODE_ALPHABET[crypto.randomInt(0, RESUBMISSION_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeAccountResubmissionCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, RESUBMISSION_CODE_LENGTH);
}

export function hashAccountResubmissionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function normalizeAccountRequestStatus(status) {
  if (status === 'Archived' || status === 'Rejected') return 'Incomplete';
  return status;
}

export function parseAccountRequestValidIdUrls(value) {
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

function getMissingAccountRequestsColumn(message) {
  const msg = String(message || '');
  let match = msg.match(/Could not find the '([^']+)' column of 'account_requests' in the schema cache/i);
  if (match?.[1]) return match[1];
  match = msg.match(/column\s+account_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];
  match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"account_requests"\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];
  return null;
}

function stripMissingAccountRequestsColumn(message, payload) {
  const missing = getMissingAccountRequestsColumn(message);
  if (!missing || typeof payload !== 'object' || payload == null || !(missing in payload)) {
    return { payload, removed: null };
  }

  const next = { ...payload };
  delete next[missing];

  if (
    missing === 'valid_id_urls' &&
    Array.isArray(payload.valid_id_urls) &&
    payload.valid_id_urls.length > 1 &&
    'valid_id_url' in next
  ) {
    next.valid_id_url = JSON.stringify(payload.valid_id_urls);
  }

  return { payload: next, removed: missing };
}

export async function updateAccountRequestForResubmission(db, requestId, payload) {
  const selectCols = ['id', 'status', 'resubmitted_at'];
  let updatePayload = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await db
      .from('account_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .eq('status', 'Incomplete')
      .select(selectCols.join(', '))
      .single();

    if (!error) return { data, error: null };

    const missingInSelect = getMissingAccountRequestsColumn(error.message);
    if (missingInSelect && selectCols.includes(missingInSelect)) {
      const idx = selectCols.indexOf(missingInSelect);
      if (idx !== -1) selectCols.splice(idx, 1);
      continue;
    }

    const stripped = stripMissingAccountRequestsColumn(error.message, updatePayload);
    if (stripped.removed) {
      updatePayload = stripped.payload;
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: new Error(
      'Database schema is missing required account_requests columns. Run setup-step4.sql and setup-step16-account-request-valid-id-urls.sql in Supabase, then NOTIFY pgrst, \'reload schema\';',
    ),
  };
}

export async function loadAccountRequestForResubmission(db, token) {
  const rawToken = normalizeAccountResubmissionCode(token);
  if (!rawToken) {
    return { ok: false, status: 400, error: 'Missing resubmission code.' };
  }

  const tokenHash = hashAccountResubmissionToken(rawToken);
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
    'notes',
    'resubmission_sent_at',
    'resubmitted_at',
  ];

  let data = null;
  let lastError = null;
  for (let attempt = 0; attempt < columns.length; attempt++) {
    const result = await db
      .from('account_requests')
      .select(columns.join(', '))
      .eq('resubmission_token_hash', tokenHash)
      .limit(1)
      .maybeSingle();

    if (!result.error) {
      data = result.data || null;
      lastError = null;
      break;
    }

    lastError = result.error;
    if (result.error.code === 'PGRST116') break;

    const missing = getMissingAccountRequestsColumn(result.error.message);
    if (!missing) break;

    const idx = columns.indexOf(missing);
    if (idx === -1) break;
    columns.splice(idx, 1);
  }

  if (lastError && lastError.code !== 'PGRST116') throw lastError;
  if (!data) {
    return { ok: false, status: 404, error: 'This resubmission code is invalid or has already been used.' };
  }

  if (normalizeAccountRequestStatus(data.status) !== 'Incomplete') {
    return { ok: false, status: 403, error: 'This request can no longer be edited.' };
  }

  return { ok: true, request: { ...data, status: normalizeAccountRequestStatus(data.status) } };
}
