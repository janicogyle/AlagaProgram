import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { OTP_MAX_ATTEMPTS, hashOtp, normalizeSmsContactNumber } from '@/lib/sms.server';

export const runtime = 'nodejs';

const ALLOWED_PURPOSES = new Set(['signup', 'login']);

function parsePurpose(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_PURPOSES.has(normalized) ? normalized : 'signup';
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const contactNumber = normalizeSmsContactNumber(body.contactNumber);
    if (!contactNumber) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    const otpCode = String(body.otp || '').replace(/\D/g, '').slice(0, 6);
    if (!otpCode || otpCode.length < 6) {
      return NextResponse.json({ data: null, error: 'OTP must be 6 digits.' }, { status: 400 });
    }

    const purpose = parsePurpose(body.purpose);

    const { data: otpRow, error } = await supabaseAdmin
      .from('sms_otps')
      .select('id, otp_hash, expires_at, verified_at, attempts, consumed_at')
      .eq('contact_number', contactNumber)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!otpRow) {
      return NextResponse.json({ data: null, error: 'OTP not found. Please request a new code.' }, { status: 404 });
    }

    if (otpRow.consumed_at) {
      return NextResponse.json({ data: null, error: 'OTP already used. Please request a new code.' }, { status: 409 });
    }

    if (otpRow.verified_at) {
      return NextResponse.json({ data: { verified: true, verifiedAt: otpRow.verified_at }, error: null });
    }

    if (otpRow.expires_at && new Date(otpRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ data: null, error: 'OTP expired. Please request a new code.' }, { status: 410 });
    }

    if (Number(otpRow.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ data: null, error: 'OTP attempts exceeded. Please request a new code.' }, { status: 429 });
    }

    const expectedHash = hashOtp(otpCode, contactNumber);
    if (expectedHash !== otpRow.otp_hash) {
      const attempts = Number(otpRow.attempts || 0) + 1;
      await supabaseAdmin.from('sms_otps').update({ attempts }).eq('id', otpRow.id);
      return NextResponse.json({ data: null, error: 'Invalid OTP. Please try again.' }, { status: 401 });
    }

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('sms_otps')
      .update({ verified_at: verifiedAt })
      .eq('id', otpRow.id);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { verified: true, verifiedAt }, error: null });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to verify OTP. Please try again.' },
      { status: 500 },
    );
  }
}
