import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { verifyPassword } from '@/lib/passwords.server';
import { BENEFICIARY_SESSION_COOKIE, createBeneficiarySessionToken } from '@/lib/beneficiarySession.server';

export const runtime = 'nodejs';

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

    if (!contactNumber || contactNumber.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { data: null, error: 'Password must be at least 8 characters long.' },
        { status: 400 },
      );
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
          if (requestRow.status === 'Pending') {
            return NextResponse.json(
              {
                data: null,
                error:
                  'PENDING APPROVAL: Your sign-up request is still pending admin approval. Please wait for approval before logging in.',
              },
              { status: 403 },
            );
          }

          if (requestRow.status === 'Archived') {
            return NextResponse.json(
              { data: null, error: 'Your sign-up request was archived. Please contact the administrator.' },
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

      return NextResponse.json({ data: null, error: 'No beneficiary found with that contact number.' }, { status: 404 });
    }

    if (resident.status && resident.status !== 'Active') {
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
      return NextResponse.json({ data: null, error: 'Invalid contact number or password.' }, { status: 401 });
    }

    let sessionToken = null;
    try {
      sessionToken = createBeneficiarySessionToken(resident.id);
    } catch (e) {
      // QR/ID features are optional; don't block beneficiary login if secrets aren't configured yet.
      console.warn('Beneficiary session cookie not set:', e?.message || e);
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

    if (sessionToken) {
      res.cookies.set(BENEFICIARY_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err) {
    console.error('Beneficiary login error:', err);
    return NextResponse.json({ data: null, error: err.message || 'Login failed.' }, { status: 500 });
  }
}
