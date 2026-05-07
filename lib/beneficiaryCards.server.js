import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

function getCardSecret() {
  // Allow session secret as a fallback so local setups still work if only one secret is configured.
  return process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET || '';
}

export function createBeneficiaryCardToken(cardId, expiresAt) {
  if (!cardId) throw new Error('Missing card id.');
  if (!expiresAt) throw new Error('Missing expiration date.');

  const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
  if (!Number.isFinite(exp) || exp <= 0) throw new Error('Invalid expiration date.');

  return signHmacToken(
    {
      typ: 'beneficiary-card',
      cid: String(cardId),
      exp,
    },
    getCardSecret(),
  );
}

export function verifyBeneficiaryCardToken(token) {
  const { ok, payload } = verifyHmacToken(token, getCardSecret());
  if (!ok || !payload) return { ok: false, payload: null, reason: 'invalid' };

  if (payload.typ !== 'beneficiary-card') return { ok: false, payload: null, reason: 'invalid' };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, payload, reason: 'expired' };
  }

  if (!payload.cid) return { ok: false, payload: null, reason: 'invalid' };

  return { ok: true, payload, reason: null };
}
