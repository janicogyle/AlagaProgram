import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

export const BENEFICIARY_SESSION_COOKIE = 'beneficiary_session';

function getSessionSecret() {
  return process.env.BENEFICIARY_SESSION_SECRET || process.env.QR_CARD_SECRET || '';
}

export function createBeneficiarySessionToken(residentId, { maxAgeSeconds = 60 * 60 * 24 * 7 } = {}) {
  if (!residentId) throw new Error('Missing resident id.');
  const now = Math.floor(Date.now() / 1000);

  return signHmacToken(
    {
      typ: 'beneficiary-session',
      rid: String(residentId),
      iat: now,
      exp: now + Number(maxAgeSeconds),
    },
    getSessionSecret(),
  );
}

export function readBeneficiarySession(request) {
  const cookie = request.cookies.get(BENEFICIARY_SESSION_COOKIE)?.value;
  if (!cookie) return { ok: false, residentId: null, error: 'Missing session.' };

  const { ok, payload } = verifyHmacToken(cookie, getSessionSecret());
  if (!ok || !payload) return { ok: false, residentId: null, error: 'Invalid session.' };

  if (payload.typ !== 'beneficiary-session') return { ok: false, residentId: null, error: 'Invalid session.' };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, residentId: null, error: 'Session expired.' };
  }

  const residentId = payload.rid ? String(payload.rid) : null;
  if (!residentId) return { ok: false, residentId: null, error: 'Invalid session.' };

  return { ok: true, residentId, error: null };
}
