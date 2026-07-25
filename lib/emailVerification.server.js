import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

const TOKEN_TYPE = 'signup-email-verification';
const DEFAULT_MAX_AGE_SECONDS = 15 * 60;

function getEmailVerificationSecret() {
  return (
    process.env.EMAIL_VERIFICATION_SECRET ||
    process.env.BENEFICIARY_SESSION_SECRET ||
    process.env.QR_CARD_SECRET ||
    process.env.SMS_OTP_SECRET ||
    ''
  );
}

export function normalizeVerificationEmail(input) {
  return String(input || '').trim().toLowerCase();
}

export function createEmailVerificationToken(email, { maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}) {
  const normalizedEmail = normalizeVerificationEmail(email);
  if (!normalizedEmail) throw new Error('Missing email.');

  const now = Math.floor(Date.now() / 1000);
  return signHmacToken(
    {
      typ: TOKEN_TYPE,
      email: normalizedEmail,
      iat: now,
      exp: now + Number(maxAgeSeconds),
    },
    getEmailVerificationSecret(),
  );
}

export function verifyEmailVerificationToken(token, expectedEmail) {
  const normalizedExpectedEmail = normalizeVerificationEmail(expectedEmail);
  if (!token || !normalizedExpectedEmail) {
    return { ok: false, error: 'Email verification is required.' };
  }

  let verified;
  try {
    verified = verifyHmacToken(token, getEmailVerificationSecret());
  } catch {
    return { ok: false, error: 'Email verification is not configured.' };
  }

  if (!verified.ok || !verified.payload) {
    return { ok: false, error: 'Email verification is invalid. Please verify again.' };
  }

  const { payload } = verified;
  if (payload.typ !== TOKEN_TYPE) {
    return { ok: false, error: 'Email verification is invalid. Please verify again.' };
  }

  if (normalizeVerificationEmail(payload.email) !== normalizedExpectedEmail) {
    return { ok: false, error: 'The verified email does not match the email on this signup.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, error: 'Email verification expired. Please verify again.' };
  }

  return { ok: true, email: normalizedExpectedEmail, error: null };
}
