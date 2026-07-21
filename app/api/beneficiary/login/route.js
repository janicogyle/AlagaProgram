import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { verifyPassword } from '@/lib/passwords.server';
import {
  BENEFICIARY_SESSION_COOKIE,
  BENEFICIARY_SESSION_MAX_AGE_SECONDS,
  createBeneficiarySessionToken,
} from '@/lib/beneficiarySession.server';
import { BENEFICIARY_RESIDENT_STATUSES } from '@/lib/beneficiaryIdStatus.server';

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

function getLoginLimitStatus(keys, nowMs = Date.now()) {
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

function recordFailedLoginAttempt(keys, nowMs = Date.now()) {
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

function clearContactLoginAttempts(contactNumber) {
  loginAttempts.delete(getAttemptKey('contact', contactNumber));
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
    const limitStatus = getLoginLimitStatus([contactAttemptKey, ipAttemptKey]);
    if (!limitStatus.allowed) {
      return rateLimitedResponse(limitStatus);
    }
    const recordFailedAttempt = () =>
      recordFailedLoginAttempt([
        { key: contactAttemptKey, maxAttempts: LOGIN_MAX_CONTACT_ATTEMPTS },
        { key: ipAttemptKey, maxAttempts: LOGIN_MAX_IP_ATTEMPTS },
      ]);

    if (typeof password !== 'string' || !password) {
      recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect password.' }, { status: 401 });
    }

    const { data: resident, error } = await db
      .from('residents')
      .select('id, first_name, last_name, contact_number, status, password_hash')
      .eq('contact_number', contactNumber)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!resident) {
      // If they already signed up, show a clearer status instead of "not found".
      try {
        const { data: requestRow, error: requestError } = await db
          .from('account_requests')
          .select('id, status')
          .eq('contact_number', contactNumber)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!requestError && requestRow) {
          if (requestRow.status === 'Pending' || requestRow.status === 'Resubmitted') {
            return NextResponse.json(
              {
                data: null,
                error:
                  'PENDING APPROVAL: Your sign-up request is still under admin review. Please wait for approval before logging in.',
              },
              { status: 403 },
            );
          }

          if (requestRow.status === 'Incomplete' || requestRow.status === 'Archived' || requestRow.status === 'Rejected') {
            return NextResponse.json(
              { data: null, error: 'Your sign-up request is incomplete. Please use the resubmission code sent by SMS.' },
              { status: 403 },
            );
          }

          if (requestRow.status === 'Approved') {
            return NextResponse.json(
              {
                data: null,
                error:
                  'Your account was approved but is not available for login yet. Please try again later or contact the administrator.',
              },
              { status: 403 },
            );
          }
        }
      } catch {
        // Ignore lookup errors; fall back to the generic message
      }

      recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'No beneficiary found with that contact number.' }, { status: 404 });
    }

    if (resident.status && !BENEFICIARY_RESIDENT_STATUSES.includes(resident.status)) {
      return NextResponse.json(
        { data: null, error: 'Your account is not active. Please contact the administrator.' },
        { status: 403 },
      );
    }

    if (!resident.password_hash) {
      return NextResponse.json(
        {
          data: null,
          error: 'Your account does not have a password yet. Please sign up and wait for approval, or contact the administrator.',
        },
        { status: 403 },
      );
    }

    const ok = await verifyPassword(password, resident.password_hash);
    if (!ok) {
      recordFailedAttempt();
      return NextResponse.json({ data: null, error: 'Incorrect password.' }, { status: 401 });
    }

    clearContactLoginAttempts(contactNumber);

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

    return res;
  } catch (err) {
    console.error('Beneficiary login error:', err);
    return NextResponse.json({ data: null, error: err.message || 'Login failed.' }, { status: 500 });
  }
}
