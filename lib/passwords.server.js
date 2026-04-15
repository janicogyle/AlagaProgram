import crypto from 'crypto';

function getPepper() {
  return process.env.PASSWORD_PEPPER ?? '';
}

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;
  const maxmem = 64 * 1024 * 1024;

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(`${password}${getPepper()}`, salt, keylen, { N, r, p, maxmem });

  return [
    'scrypt',
    String(N),
    String(r),
    String(p),
    salt.toString('base64'),
    Buffer.from(derivedKey).toString('base64'),
  ].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !password) return false;
  if (typeof stored !== 'string' || !stored) return false;

  const parts = stored.split('$');

  // Current format: scrypt$N$r$p$saltB64$hashB64 (6 parts)
  // Backward-compat: scrypt$$N$r$p$saltB64$hashB64 (7 parts, empty part at index 1)
  let algo;
  let N;
  let r;
  let p;
  let saltB64;
  let hashB64;

  if (parts.length === 6) {
    [algo, N, r, p, saltB64, hashB64] = parts;
  } else if (parts.length === 7 && parts[1] === '') {
    algo = parts[0];
    N = parts[2];
    r = parts[3];
    p = parts[4];
    saltB64 = parts[5];
    hashB64 = parts[6];
  } else {
    return false;
  }

  if (algo !== 'scrypt') return false;

  const costN = Number(N);
  const costR = Number(r);
  const costP = Number(p);
  if (!Number.isFinite(costN) || !Number.isFinite(costR) || !Number.isFinite(costP)) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length < 8 || expected.length < 32) return false;

  const maxmem = 64 * 1024 * 1024;
  const derivedKey = await scryptAsync(`${password}${getPepper()}`, salt, expected.length, {
    N: costN,
    r: costR,
    p: costP,
    maxmem,
  });

  const actual = Buffer.from(derivedKey);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
