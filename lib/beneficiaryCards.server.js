import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

function getCardSecret() {
  // Allow session secret as a fallback so local setups still work if only one secret is configured.
  return process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET || '';
}

export function isMissingBeneficiaryCardsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('beneficiary_cards') &&
    (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

export function getBeneficiaryCardsSetupHint() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const host = supabaseUrl
    ? supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*/, '')
    : '(missing NEXT_PUBLIC_SUPABASE_URL)';

  return (
    "QR ID cards are not set up in the database yet. " +
    "Run setup-step5.sql in Supabase SQL Editor, wait a moment (schema cache reload), then try again. " +
    `Your app is currently connected to: ${host}. ` +
    "If you ran the SQL in a different Supabase project, it won't work - run it in the project shown above."
  );
}

export function assertBeneficiaryCardSecret() {
  if (!getCardSecret()) {
    const err = new Error(
      'Missing QR token signing secret. Set QR_CARD_SECRET in .env.local (server-side), then restart the dev server (pnpm dev).',
    );
    err.code = 'QR_CARD_SECRET_MISSING';
    throw err;
  }
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

export async function issueBeneficiaryCard(db, residentId, { expiresInDays = 365 } = {}) {
  if (!db) throw new Error('Database client is required.');
  if (!residentId) throw new Error('residentId is required.');

  const days = Number.isFinite(Number(expiresInDays)) ? Number(expiresInDays) : 365;
  if (days < 1 || days > 3650) {
    throw new Error('expiresInDays must be between 1 and 3650.');
  }

  assertBeneficiaryCardSecret();

  const nowIso = new Date().toISOString();

  const { error: revokeError } = await db
    .from('beneficiary_cards')
    .update({ revoked_at: nowIso, status: 'Revoked' })
    .eq('resident_id', residentId)
    .is('revoked_at', null);

  if (revokeError) throw revokeError;

  const expiresAtIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: card, error: insertError } = await db
    .from('beneficiary_cards')
    .insert({ resident_id: residentId, issued_at: nowIso, expires_at: expiresAtIso, status: 'Active' })
    .select('id, resident_id, issued_at, expires_at, revoked_at, status')
    .single();

  if (insertError) throw insertError;

  return {
    card,
    token: createBeneficiaryCardToken(card.id, card.expires_at),
  };
}
