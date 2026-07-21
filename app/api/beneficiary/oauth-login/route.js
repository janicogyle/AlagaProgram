import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  BENEFICIARY_SESSION_COOKIE,
  BENEFICIARY_SESSION_MAX_AGE_SECONDS,
  createBeneficiarySessionToken,
} from '@/lib/beneficiarySession.server';
import { BENEFICIARY_RESIDENT_STATUSES } from '@/lib/beneficiaryIdStatus.server';

export const runtime = 'nodejs';

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function isMissingEmailColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes("could not find the 'email' column") || message.includes('residents.email') || message.includes('account_requests.email');
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Supabase admin client is not available.' },
        { status: 500 },
      );
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const authUser = userData?.user;
    if (userError || !authUser) {
      return NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 });
    }

    const email = normalizeEmail(authUser.email);
    if (!email) {
      return NextResponse.json({ data: null, error: 'Your Google account did not provide an email address.' }, { status: 400 });
    }

    const { data: resident, error: residentError } = await supabaseAdmin
      .from('residents')
      .select('id, first_name, last_name, contact_number, email, status')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (residentError) {
      if (isMissingEmailColumn(residentError)) {
        return NextResponse.json(
          {
            data: null,
            error:
              'Database is missing residents.email. Run the latest database schema update and reload the Supabase schema cache.',
          },
          { status: 500 },
        );
      }
      throw residentError;
    }

    if (!resident) {
      const { data: requestRow, error: requestError } = await supabaseAdmin
        .from('account_requests')
        .select('id, status')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError && !isMissingEmailColumn(requestError)) throw requestError;

      if (requestRow?.status === 'Pending' || requestRow?.status === 'Resubmitted') {
        return NextResponse.json(
          {
            data: null,
            error: 'PENDING APPROVAL: Your sign-up request is still under admin review.',
            code: 'GOOGLE_SIGNUP_PENDING',
          },
          { status: 403 },
        );
      }

      if (requestRow?.status === 'Incomplete' || requestRow?.status === 'Archived' || requestRow?.status === 'Rejected') {
        return NextResponse.json(
          {
            data: null,
            error: 'Your sign-up request needs attention before you can sign in.',
            code: 'GOOGLE_SIGNUP_INCOMPLETE',
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          data: null,
          error: 'No approved beneficiary account is linked to this Gmail address.',
          code: 'GOOGLE_EMAIL_NOT_LINKED',
        },
        { status: 404 },
      );
    }

    if (resident.status && !BENEFICIARY_RESIDENT_STATUSES.includes(resident.status)) {
      return NextResponse.json(
        { data: null, error: 'Your account is not active. Please contact the administrator.' },
        { status: 403 },
      );
    }

    const sessionToken = createBeneficiarySessionToken(resident.id);
    const response = NextResponse.json({
      data: {
        id: resident.id,
        first_name: resident.first_name,
        last_name: resident.last_name,
        contact_number: resident.contact_number,
        email: resident.email,
      },
      error: null,
    });

    response.cookies.set(BENEFICIARY_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: BENEFICIARY_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Beneficiary OAuth login error:', error);
    return NextResponse.json({ data: null, error: error?.message || 'Google sign-in failed.' }, { status: 500 });
  }
}
