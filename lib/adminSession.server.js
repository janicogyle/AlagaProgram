import { signHmacToken, verifyHmacToken } from '@/lib/hmacTokens.server';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ALLOWED_ADMIN_ROLES = new Set(['Admin', 'Staff']);

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.BENEFICIARY_SESSION_SECRET || process.env.QR_CARD_SECRET || '';
}

export function createAdminSessionToken(profile, { maxAgeSeconds = ADMIN_SESSION_MAX_AGE_SECONDS } = {}) {
  if (!profile?.id) throw new Error('Missing admin user id.');
  if (!ALLOWED_ADMIN_ROLES.has(profile?.role)) throw new Error('Invalid admin role.');

  const now = Math.floor(Date.now() / 1000);
  return signHmacToken(
    {
      typ: 'admin-session',
      uid: String(profile.id),
      role: profile.role,
      name: profile.full_name || profile.name || 'User',
      email: profile.email || null,
      iat: now,
      exp: now + Number(maxAgeSeconds),
    },
    getSessionSecret(),
  );
}

export function readAdminSessionToken(token) {
  if (!token) return { ok: false, user: null, error: 'Missing session.' };

  let verified;
  try {
    verified = verifyHmacToken(token, getSessionSecret());
  } catch {
    return { ok: false, user: null, error: 'Invalid session configuration.' };
  }

  const { ok, payload } = verified;
  if (!ok || !payload) return { ok: false, user: null, error: 'Invalid session.' };

  if (payload.typ !== 'admin-session') {
    return { ok: false, user: null, error: 'Invalid session.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, user: null, error: 'Session expired.' };
  }

  if (!payload.uid || !ALLOWED_ADMIN_ROLES.has(payload.role)) {
    return { ok: false, user: null, error: 'Invalid session.' };
  }

  return {
    ok: true,
    user: {
      id: String(payload.uid),
      role: payload.role,
      name: payload.name || 'User',
      email: payload.email || null,
    },
    error: null,
  };
}
