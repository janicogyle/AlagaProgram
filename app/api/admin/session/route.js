import { NextResponse } from 'next/server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
} from '@/lib/adminSession.server';

export const runtime = 'nodejs';

function clearAdminSessionCookie(res) {
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function POST(request) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  let sessionToken;
  try {
    sessionToken = createAdminSessionToken(auth.profile);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error?.message || 'Unable to create admin session.' },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    data: {
      id: auth.profile.id,
      full_name: auth.profile.full_name,
      email: auth.profile.email,
      role: auth.profile.role,
      status: auth.profile.status,
    },
    error: null,
  });

  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearAdminSessionCookie(res);
  return res;
}
