import { NextResponse } from 'next/server';
import { BENEFICIARY_SESSION_COOKIE, readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { logBeneficiaryActivity } from '@/lib/activityLogger.server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(request) {
  const session = readBeneficiarySession(request);
  if (session.ok && supabaseAdmin) {
    const { data: resident } = await supabaseAdmin
      .from('residents')
      .select('id, first_name, middle_name, last_name, contact_number')
      .eq('id', session.residentId)
      .maybeSingle();

    if (resident) {
      await logBeneficiaryActivity(
        resident,
        {
          action: 'Logged out',
          message: 'Signed out of the Alaga beneficiary portal.',
          entity_type: 'beneficiary_session',
          entity_id: resident.id,
          reference_number: resident.contact_number || resident.id,
          link: '/beneficiary/activity-logs',
        },
        supabaseAdmin,
      );
    }
  }

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
