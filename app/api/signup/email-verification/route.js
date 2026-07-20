import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  createEmailVerificationToken,
  normalizeVerificationEmail,
} from '@/lib/emailVerification.server';

export const runtime = 'nodejs';

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function isGoogleAuthUser(authUser) {
  const provider = String(authUser?.app_metadata?.provider || '').toLowerCase();
  const providers = Array.isArray(authUser?.app_metadata?.providers)
    ? authUser.app_metadata.providers.map((item) => String(item || '').toLowerCase())
    : [];
  return provider === 'google' || providers.includes('google');
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

    if (!isGoogleAuthUser(authUser)) {
      return NextResponse.json({ data: null, error: 'Please verify using a Google account.' }, { status: 403 });
    }

    const email = normalizeVerificationEmail(authUser.email);
    if (!email) {
      return NextResponse.json({ data: null, error: 'Your Google account did not provide an email address.' }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        email,
        token: createEmailVerificationToken(email),
      },
      error: null,
    });
  } catch (error) {
    console.error('Signup Gmail verification error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to verify Gmail.' },
      { status: 500 },
    );
  }
}
