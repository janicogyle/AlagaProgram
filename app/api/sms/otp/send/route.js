import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_SEND_LOCKOUT_MINUTES,
  canSendSms,
  evaluateOtpSendLimit,
  generateOtpCode,
  getSmsSetupError,
  hashOtp,
  isSmsDevModeEnabled,
  normalizeSmsContactNumber,
  sendSms,
} from '@/lib/sms.server';
import { buildOtpMessage } from '@/lib/smsTemplates';

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

    const purpose = parsePurpose(body.purpose);

    if (!canSendSms()) {
      return NextResponse.json(
        { data: null, error: getSmsSetupError() || 'SMS is not configured.' },
        { status: 503 },
      );
    }

    const now = new Date();
    const rateLimit = await evaluateOtpSendLimit({ contactNumber, purpose, now });

    if (!rateLimit.allowed) {
      console.warn(
        `[SMS] OTP send blocked for ${contactNumber} (${purpose}): ${rateLimit.error} (retry in ${rateLimit.retryAfterSeconds}s)`,
      );
      return NextResponse.json(
        {
          data: null,
          error: rateLimit.error,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const otpCode = generateOtpCode();
    const otpHash = hashOtp(otpCode, contactNumber);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const { data: otpRow, error: insertError } = await supabaseAdmin
      .from('sms_otps')
      .insert({
        contact_number: contactNumber,
        purpose,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        last_sent_at: now.toISOString(),
        attempts: 0,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const message = buildOtpMessage(otpCode);
    const devMode = isSmsDevModeEnabled() && process.env.NODE_ENV !== 'production';

    if (devMode) {
      console.info(`[SMS DEV] OTP (${purpose}) for ${contactNumber}: ${otpCode}`);
    } else {
      await sendSms({
        to: contactNumber,
        message,
        referenceType: 'otp',
        referenceId: otpRow?.id || null,
        referenceKey: otpRow?.id || null,
      });
    }

    const sendsAfter = (rateLimit.sendsInWindow || 0) + 1;
    const sendsRemaining = Math.max(0, OTP_MAX_SENDS_PER_WINDOW - sendsAfter);

    return NextResponse.json({
      data: {
        expiresAt: expiresAt.toISOString(),
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        sendsRemaining,
        maxSendsPerWindow: OTP_MAX_SENDS_PER_WINDOW,
        lockoutMinutes: OTP_SEND_LOCKOUT_MINUTES,
        ...(devMode ? { devMode: true } : {}),
      },
      error: null,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to send OTP. Please try again.' },
      { status: 500 },
    );
  }
}
