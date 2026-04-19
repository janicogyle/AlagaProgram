import { NextResponse } from 'next/server';
import { BENEFICIARY_SESSION_COOKIE } from '@/lib/beneficiarySession.server';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(BENEFICIARY_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
