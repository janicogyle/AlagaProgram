import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { verifyPassword } from '@/lib/passwords.server';
import {
  BENEFICIARY_SESSION_COOKIE,
  BENEFICIARY_SESSION_MAX_AGE_SECONDS,
  createBeneficiarySessionToken,
} from '@/lib/beneficiarySession.server';
import { BENEFICIARY_RESIDENT_STATUSES } from '@/lib/beneficiaryIdStatus.server';
import { createHash } from 'crypto';
import { logBeneficiaryActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_MAX_CONTACT_ATTEMPTS = 5;
const LOGIN_MAX_IP_ATTEMPTS = 20;

const loginAttempts =
  globalThis.__beneficiaryLoginAttempts ?? new Map();
globalThis.__beneficiaryLoginAttempts = loginAttempts;

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

function getRequestIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown'
  );
}

function pruneLoginAttempts(nowMs) {
  for (const [key, entry] of loginAttempts.entries()) {
    const lockedUntil = Number(entry.lockedUntil || 0);
    const firstAttemptAt = Number(entry.firstAttemptAt || 0);
    const isLockExpired = !lockedUntil || lockedUntil <= nowMs;
    const isWindowExpired = !firstAttemptAt || firstAttemptAt + LOGIN_ATTEMPT_WINDOW_MS <= nowMs;

    if (isLockExpired && isWindowExpired) {
      loginAttempts.delete(key);
    }
  }
}

function getAttemptKey(type, value) {
  return `${type}:${value || 'unknown'}`;
}

function getMemoryLoginLimitStatus(keys, nowMs = Date.now()) {
  pruneLoginAttempts(nowMs);

  for (const key of keys) {
    const entry = loginAttempts.get(key);
    const lockedUntil = Number(entry?.lockedUntil || 0);

    if (lockedUntil > nowMs) {
      const retryAfterSeconds = Math.ceil((lockedUntil - nowMs) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        error: `Too many failed login attempts. Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) before trying again.`,
      };
    }
  }

  return { allowed: true };
}

function recordFailedLoginAttemptInMemory(keys, nowMs = Date.now()) {
  pruneLoginAttempts(nowMs);

  for (const { key, maxAttempts } of keys) {
    const current = loginAttempts.get(key);
    const windowExpired =
      !current?.firstAttemptAt || current.firstAttemptAt + LOGIN_ATTEMPT_WINDOW_MS <= nowMs;
    const attempts = windowExpired ? 1 : Number(current.attempts || 0) + 1;
    const lockedUntil = attempts >= maxAttempts ? nowMs + LOGIN_LOCKOUT_MS : 0;

    loginAttempts.set(key, {
      attempts,
      firstAttemptAt: windowExpired ? nowMs : current.firstAttemptAt,
      lockedUntil,
    });
  }
}

function clearContactLoginAttemptsInMemory(contactNumber) {
  loginAttempts.delete(getAttemptKey('contact', contactNumber));
}

function hashAttemptKey(key) {
  const pepper =
    process.env.LOGIN_RATE_LIMIT_SECRET ||
    process.env.BENEFICIARY_SESSION_SECRET ||
    process.env.SMS_OTP_SECRET ||
    'alaga-login-rate-limit';
  return createHash('sha256').update(`${pepper}:${key}`).digest('hex');
}

function isMissingRateLimitStore(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    message.includes('beneficiary_login_rate_limits') ||
    message.includes('record_beneficiary_login_failure')
  );
}

async function getLoginLimitStatus(db, keys, nowMs = Date.now()) {
  const hashedKeys = keys.map(hashAttemptKey);
  const { data, error } = await db
    .from('beneficiary_login_rate_limits')
    .select('locked_until')
    .in('key_hash', hashedKeys);

  if (error) {
    if (isMissingRateLimitStore(error)) return getMemoryLoginLimitStatus(keys, nowMs);
    throw error;
  }

  const latestLock = (data || [])
    .map((row) => new Date(row.locked_until || 0).getTime())
    .filter((lockedUntil) => Number.isFinite(lockedUntil) && lockedUntil > nowMs)
    .sort((a, b) => b - a)[0];

  if (!latestLock) return { allowed: true };
  const retryAfterSeconds = Math.ceil((latestLock - nowMs) / 1000);
  return {
    allowed: false,
    retryAfterSeconds,
    error: `Too many failed login attempts. Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) before trying again.`,
  };
}

async function recordFailedLoginAttempt(db, keys) {
  const results = await Promise.all(
    keys.map(({ key, maxAttempts }) =>
      db.rpc('record_beneficiary_login_failure', {
        p_key_hash: hashAttemptKey(key),
        p_max_attempts: maxAttempts,
        p_window_seconds: Math.floor(LOGIN_ATTEMPT_WINDOW_MS / 1000),
        p_lockout_seconds: Math.floor(LOGIN_LOCKOUT_MS / 1000),
      }),
    ),
  );
  const firstError = results.find((result) => result.error)?.error;
  if (!firstError) return;
  if (isMissingRateLimitStore(firstError)) {
    recordFailedLoginAttemptInMemory(keys);
    return;
  }
  throw firstError;
}

async function clearContactLoginAttempts(db, contactNumber) {
  const key = getAttemptKey('contact', contactNumber);
  const { error } = await db
    .from('beneficiary_login_rate_limits')
    .delete()
    .eq('key_hash', hashAttemptKey(key));
  if (error) {
    if (isMissingRateLimitStore(error)) {
      clearContactLoginAttemptsInMemory(contactNumber);
      return;
    }
    throw error;
  }
}

function rateLimitedResponse(limitStatus) {
  return NextResponse.json(
    {
      data: null,
      error: limitStatus.error,
      retryAfterSeconds: limitStatus.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(limitStatus.retryAfterSeconds || 0),
      },
    },
  );
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
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
    const ipAddress = getRequestIp(request);

    if (!contactNumber || contactNumber.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    const contactAttemptKey = getAttemptKey('contact', contactNumber);
    const ipAttemptKey = getAttemptKey('ip', ipAddress);
    const limitStatus = await getLoginLimitStatus(db, [contactAttemptKey, ipAttemptKey]);
    if (!limitStatus.allowed) {
      return rateLimitedResponse(limitStatus);
    }
    const recordFailedAttempt = () =>
      recordFailedLoginAttempt(db, [
        { key: contactAttemptKey, maxAttempts: LOGIN_MAX_CONTACT_ATTEMPTS },
        { key: ipAttemptKey, maxAttempts: LOGIN_MAX_IP_ATTEMPTS },
      ]);

    if (typeof password !== 'string' || !password) {
      await recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect contact number or password.' }, { status: 401 });
    }

    const { data: resident, error } = await db
      .from('residents')
      .select('id, first_name, middle_name, last_name, contact_number, status, password_hash')
      .eq('contact_number', contactNumber)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!resident) {
      await recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect contact number or password.' }, { status: 401 });
    }

    if (!resident.password_hash) {
      await recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect contact number or password.' }, { status: 401 });
    }

    const ok = await verifyPassword(password, resident.password_hash);
    if (!ok) {
      await recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect contact number or password.' }, { status: 401 });
    }

    if (resident.status && !BENEFICIARY_RESIDENT_STATUSES.includes(resident.status)) {
      return NextResponse.json(
        { data: null, error: 'Your account is not active. Please contact the administrator.' },
        { status: 403 },
      );
    }

    await clearContactLoginAttempts(db, contactNumber);

    let sessionToken;
    try {
      sessionToken = createBeneficiarySessionToken(resident.id);
    } catch (e) {
      console.error('Beneficiary session cookie not set:', e?.message || e);
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Beneficiary session is not available.' },
        { status: 500 },
      );
    }

    const res = NextResponse.json({
      data: {
        id: resident.id,
        first_name: resident.first_name,
        last_name: resident.last_name,
        contact_number: resident.contact_number,
      },
      error: null,
    });

    res.cookies.set(BENEFICIARY_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: BENEFICIARY_SESSION_MAX_AGE_SECONDS,
    });

    await logBeneficiaryActivity(
      resident,
      {
        action: 'Logged in',
        message: 'Signed in to the Alaga beneficiary portal.',
        entity_type: 'beneficiary_session',
        entity_id: resident.id,
        reference_number: resident.contact_number || resident.id,
        link: '/beneficiary/activity-logs',
      },
      supabaseAdmin ?? db,
    );

    return res;
  } catch (err) {
    console.error('Beneficiary login error:', err);
    return NextResponse.json({ data: null, error: err.message || 'Login failed.' }, { status: 500 });
  }
}
