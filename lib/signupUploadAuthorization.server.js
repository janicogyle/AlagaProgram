import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

const TOKEN_TYPE = 'signup-identity-upload';
const DEFAULT_MAX_AGE_SECONDS = 20 * 60;

function getSecret() {
  return (
    process.env.SIGNUP_UPLOAD_SECRET ||
    process.env.BENEFICIARY_SESSION_SECRET ||
    process.env.SMS_OTP_SECRET ||
    process.env.QR_CARD_SECRET ||
    ''
  );
}

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

export function createSignupUploadToken(contactNumber, { maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}) {
  const contact = normalizeContactNumber(contactNumber);
  if (!/^0\d{10}$/.test(contact)) throw new Error('Invalid contact number.');
  const now = Math.floor(Date.now() / 1000);
  return signHmacToken(
    { typ: TOKEN_TYPE, contact, iat: now, exp: now + Number(maxAgeSeconds) },
    getSecret(),
  );
}

export function verifySignupUploadToken(token, expectedContactNumber) {
  const expectedContact = normalizeContactNumber(expectedContactNumber);
  if (!token || !/^0\d{10}$/.test(expectedContact)) {
    return { ok: false, error: 'Verified contact authorization is required before uploading.' };
  }

  let verified;
  try {
    verified = verifyHmacToken(token, getSecret());
  } catch {
    return { ok: false, error: 'Signup upload authorization is not configured.' };
  }

  const payload = verified?.payload;
  const now = Math.floor(Date.now() / 1000);
  if (
    !verified?.ok ||
    !payload ||
    payload.typ !== TOKEN_TYPE ||
    payload.contact !== expectedContact ||
    (typeof payload.exp === 'number' && payload.exp < now)
  ) {
    return { ok: false, error: 'Upload authorization is invalid or expired. Verify your contact again.' };
  }

  return { ok: true, contact: expectedContact, error: null };
}
