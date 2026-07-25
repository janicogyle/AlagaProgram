import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createEmailVerificationToken,
  normalizeVerificationEmail,
} from '@/lib/emailVerification.server';

export const runtime = 'nodejs';

function getEmailAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  // A fresh, non-persistent client prevents one verification request from
  // sharing an authenticated session with another server request.
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();
    const email = normalizeVerificationEmail(body.email);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ data: null, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const authClient = getEmailAuthClient();
    if (!authClient) {
      return NextResponse.json(
        { data: null, error: 'Email verification is not configured.' },
        { status: 500 },
      );
    }

    if (action === 'send') {
      const { error } = await authClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (error) {
        const rateLimited = error.status === 429 || /rate|seconds|security purposes/i.test(error.message || '');
        return NextResponse.json(
          {
            data: null,
            error: rateLimited
              ? 'Please wait before requesting another email code.'
              : error.message || 'Unable to send the email verification code.',
          },
          { status: rateLimited ? 429 : 400 },
        );
      }

      return NextResponse.json({
        data: { sent: true, email },
        error: null,
      });
    }

    if (action === 'verify') {
      const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) {
        return NextResponse.json({ data: null, error: 'Verification code must be 6 digits.' }, { status: 400 });
      }

      const { error } = await authClient.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) {
        return NextResponse.json(
          { data: null, error: 'Invalid or expired email code. Please try again.' },
          { status: 401 },
        );
      }

      return NextResponse.json({
        data: {
          verified: true,
          email,
          token: createEmailVerificationToken(email),
        },
        error: null,
      });
    }

    return NextResponse.json({ data: null, error: 'Invalid email verification action.' }, { status: 400 });
  } catch (error) {
    console.error('Signup email verification error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Email verification failed.' },
      { status: 500 },
    );
  }
}
