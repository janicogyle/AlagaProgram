import crypto from 'crypto';

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeToBuffer(input) {
  let str = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return Buffer.from(str, 'base64');
}

export function signHmacToken(payload, secret) {
  if (!secret) throw new Error('Missing token secret.');

  const payloadJson = JSON.stringify(payload ?? {});
  const payloadB64 = base64UrlEncode(payloadJson);

  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

export function verifyHmacToken(token, secret) {
  if (!secret) throw new Error('Missing token secret.');

  const raw = String(token || '');
  const [payloadB64, sigB64] = raw.split('.');
  if (!payloadB64 || !sigB64) return { ok: false, payload: null };

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const actualSig = base64UrlDecodeToBuffer(sigB64);

  if (actualSig.length !== expectedSig.length) return { ok: false, payload: null };
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) return { ok: false, payload: null };

  try {
    const payloadJson = base64UrlDecodeToBuffer(payloadB64).toString('utf8');
    const payload = JSON.parse(payloadJson);
    return { ok: true, payload };
  } catch {
    return { ok: false, payload: null };
  }
}
