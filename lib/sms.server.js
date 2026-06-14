import crypto from 'crypto';
import { normalizePhContactNumber } from '@/lib/contactNumber';
import { supabaseAdmin } from '@/lib/supabaseClient';

const DEFAULT_API_URL = 'https://unismsapi.com/api';
const UNISMS_SIGNUP_URL = 'https://unismsapi.com/register';
const DEFAULT_SMS_TIMEOUT_MS = 10000;
export const SMS_CHANNEL_DEFAULT = 'default';
export const SMS_CHANNEL_LINK = 'link';

const PLACEHOLDER_API_KEYS = new Set([
  'your_new_secret',
  'your_api_secret',
  'your-secret',
  'changeme',
  'replace_me',
  'paste_your_secret_here',
]);

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_WINDOW = 2;
export const OTP_SEND_LOCKOUT_MINUTES = 15;
export const OTP_SEND_LOCKOUT_SECONDS = OTP_SEND_LOCKOUT_MINUTES * 60;
export const OTP_MAX_ATTEMPTS = 5;

function normalizeSmsChannel(channel) {
  return channel === SMS_CHANNEL_LINK ? SMS_CHANNEL_LINK : SMS_CHANNEL_DEFAULT;
}

function isConfiguredApiKey(value) {
  const apiKey = String(value || '').trim();
  if (!apiKey) return false;
  if (PLACEHOLDER_API_KEYS.has(apiKey.toLowerCase())) return false;
  return true;
}

/**
 * Rate limit OTP sends: max 2 per rolling window, then 15-minute lockout from last send.
 * Also enforces short cooldown between consecutive sends.
 */
export async function evaluateOtpSendLimit({ contactNumber, purpose, now = new Date() }) {
  if (!supabaseAdmin) {
    return { allowed: false, retryAfterSeconds: 0, error: 'Database admin client not available.' };
  }

  const windowStart = new Date(now.getTime() - OTP_SEND_LOCKOUT_SECONDS * 1000);

  const { data: recentSends, error } = await supabaseAdmin
    .from('sms_otps')
    .select('id, last_sent_at')
    .eq('contact_number', contactNumber)
    .eq('purpose', purpose)
    .gte('last_sent_at', windowStart.toISOString())
    .order('last_sent_at', { ascending: false })
    .limit(OTP_MAX_SENDS_PER_WINDOW);

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const sends = Array.isArray(recentSends) ? recentSends : [];

  if (sends.length >= OTP_MAX_SENDS_PER_WINDOW) {
    const latestSent = new Date(sends[0].last_sent_at);
    const lockoutEndsAt = latestSent.getTime() + OTP_SEND_LOCKOUT_SECONDS * 1000;
    const remainingMs = lockoutEndsAt - now.getTime();

    if (remainingMs > 0) {
      const retryAfterSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.ceil(retryAfterSeconds / 60);
      return {
        allowed: false,
        retryAfterSeconds,
        error: `OTP send limit reached (2 attempts). Please wait ${minutes} minute(s) before requesting another code.`,
        sendsInWindow: sends.length,
      };
    }
  }

  const lastSentAt = sends[0]?.last_sent_at;
  if (lastSentAt) {
    const elapsedSeconds = Math.floor((now.getTime() - new Date(lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      return {
        allowed: false,
        retryAfterSeconds,
        error: `Please wait ${retryAfterSeconds} second(s) before requesting another OTP.`,
        sendsInWindow: sends.length,
      };
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    sendsInWindow: sends.length,
    sendsRemaining: Math.max(0, OTP_MAX_SENDS_PER_WINDOW - sends.length),
  };
}

export function isUniSmsConfigured({ channel = SMS_CHANNEL_DEFAULT } = {}) {
  const smsChannel = normalizeSmsChannel(channel);
  const envKey = smsChannel === SMS_CHANNEL_LINK ? 'UNISMS_LINK_API_KEY' : 'UNISMS_API_KEY';
  return isConfiguredApiKey(process.env[envKey]);
}

export function isSmsDevModeEnabled() {
  const flag = String(process.env.SMS_DEV_MODE || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function canSendSms({ channel = SMS_CHANNEL_DEFAULT } = {}) {
  const smsChannel = normalizeSmsChannel(channel);
  if (isUniSmsConfigured({ channel: smsChannel })) return true;
  if (smsChannel === SMS_CHANNEL_LINK) return false;
  return isSmsDevModeEnabled() && process.env.NODE_ENV !== 'production';
}

export function getSmsSetupError({ channel = SMS_CHANNEL_DEFAULT } = {}) {
  const smsChannel = normalizeSmsChannel(channel);

  if (smsChannel === SMS_CHANNEL_LINK) {
    if (isUniSmsConfigured({ channel: smsChannel })) return null;
    return 'Resubmission SMS is not configured. Set UNISMS_LINK_API_KEY to a sender-free UniSMS API key, then restart the server.';
  }

  if (isUniSmsConfigured({ channel: smsChannel })) return null;
  if (isSmsDevModeEnabled() && process.env.NODE_ENV === 'production') {
    return 'SMS_DEV_MODE cannot be used in production. Set a real UNISMS_API_KEY in Vercel Environment Variables.';
  }

  const onVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const envHint = onVercel
    ? 'Vercel → Project → Settings → Environment Variables (Production & Preview): UNISMS_API_KEY, SMS_OTP_SECRET, plus Supabase keys.'
    : '.env.local: UNISMS_API_KEY, SMS_OTP_SECRET. For local testing without credits, set SMS_DEV_MODE=true.';

  return `SMS is not configured. Sign up at ${UNISMS_SIGNUP_URL}, copy your API Secret key, then set ${envHint}`;
}

function getSmsConfig({ channel = SMS_CHANNEL_DEFAULT } = {}) {
  const smsChannel = normalizeSmsChannel(channel);
  const apiKey =
    smsChannel === SMS_CHANNEL_LINK
      ? String(process.env.UNISMS_LINK_API_KEY || '').trim()
      : String(process.env.UNISMS_API_KEY || '').trim();
  const senderId = smsChannel === SMS_CHANNEL_LINK ? '' : process.env.UNISMS_SENDER_ID || '';
  const apiUrl =
    smsChannel === SMS_CHANNEL_LINK
      ? process.env.UNISMS_LINK_API_URL || process.env.UNISMS_API_URL || DEFAULT_API_URL
      : process.env.UNISMS_API_URL || DEFAULT_API_URL;
  const timeoutMs = Number(process.env.UNISMS_TIMEOUT_MS || DEFAULT_SMS_TIMEOUT_MS);

  if (!isUniSmsConfigured({ channel: smsChannel })) {
    throw new Error(getSmsSetupError({ channel: smsChannel }) || 'Missing UNISMS_API_KEY.');
  }

  return {
    apiKey,
    senderId,
    apiUrl,
    channel: smsChannel,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_SMS_TIMEOUT_MS,
  };
}

function extractUniSmsErrorBody(payload, responseText) {
  const contentErrors = payload?.errors?.content;
  if (Array.isArray(contentErrors) && contentErrors.length) {
    return contentErrors.join(' ');
  }
  if (typeof payload?.errors === 'string') return payload.errors;

  const failReason = payload?.message?.fail_reason;
  const nestedError = payload?.message?.error || payload?.error;
  return (
    failReason ||
    nestedError ||
    (typeof payload?.message === 'string' ? payload.message : null) ||
    responseText ||
    'Failed to send SMS.'
  );
}

function formatProviderError(status, payload, responseText) {
  const raw = extractUniSmsErrorBody(payload, responseText);

  if (status === 401 || /unauthorized/i.test(String(raw))) {
    return `UniSMS rejected the API key (401 Unauthorized). Check UNISMS_API_KEY in .env.local — use your API Secret from ${UNISMS_SIGNUP_URL}.`;
  }

  if (status === 422) {
    return `UniSMS blocked the message (spam filter). ${raw}`;
  }

  return String(raw);
}

export function normalizeSmsContactNumber(input) {
  const normalized = normalizePhContactNumber(input);
  const digits = String(normalized || '').replace(/\D/g, '');
  if (!digits || digits.length !== 11) return null;
  if (!digits.startsWith('0')) return `0${digits.slice(-10)}`;
  return digits;
}

/** API-ready digits without + (e.g. 639151234567). */
export function toSmsApiDigits(contactNumber) {
  const normalized = normalizeSmsContactNumber(contactNumber);
  if (!normalized) return null;
  return `63${normalized.slice(1)}`;
}

function toE164(contactNumber) {
  const apiDigits = toSmsApiDigits(contactNumber);
  if (!apiDigits) return null;
  return `+${apiDigits}`;
}

export function generateOtpCode(length = OTP_LENGTH) {
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

export function hashOtp(code, contactNumber) {
  const secret = process.env.SMS_OTP_SECRET || process.env.BENEFICIARY_SESSION_SECRET || '';
  if (!secret) {
    throw new Error('Missing SMS_OTP_SECRET.');
  }
  return crypto.createHmac('sha256', secret).update(`${contactNumber}:${code}`).digest('hex');
}

async function recordSmsLog({
  contactNumber,
  message,
  status,
  provider,
  providerId,
  error,
  referenceType,
  referenceId,
  referenceKey,
}) {
  if (!supabaseAdmin) return { ok: false, error: 'Supabase admin client not available.' };

  try {
    const { error: insertError } = await supabaseAdmin.from('sms_logs').insert({
      contact_number: contactNumber,
      message,
      status,
      provider,
      provider_id: providerId || null,
      error: error || null,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      reference_key: referenceKey || null,
    });

    if (insertError) {
      return { ok: false, error: insertError.message || 'Failed to insert SMS log.' };
    }
  } catch (logError) {
    return { ok: false, error: logError?.message || 'Failed to insert SMS log.' };
  }

  return { ok: true, error: null };
}

export async function sendSms({
  to,
  message,
  referenceType,
  referenceId,
  referenceKey,
  omitSenderId = false,
  channel = SMS_CHANNEL_DEFAULT,
}) {
  const contactNumber = normalizeSmsContactNumber(to);
  if (!contactNumber) {
    throw new Error('Invalid recipient contact number.');
  }

  const { apiKey, senderId, apiUrl, timeoutMs, channel: smsChannel } = getSmsConfig({ channel });
  const recipient = toE164(contactNumber);
  if (!recipient) {
    throw new Error('Invalid recipient contact number.');
  }

  const metadata = {};
  if (referenceType) metadata.reference_type = referenceType;
  if (referenceId) metadata.reference_id = referenceId;
  if (referenceKey) metadata.reference_key = referenceKey;

  const requestPayload = {
    content: message,
    recipient,
    ...(senderId && !omitSenderId ? { sender_id: senderId } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const apiDigits = toSmsApiDigits(contactNumber);
  const provider = smsChannel === SMS_CHANNEL_LINK ? 'unisms_link' : 'unisms';
  if (referenceType === 'account_resubmission') {
    console.info(
      `[SMS] account_resubmission channel: ${smsChannel}; sender_id: ${
        senderId && !omitSenderId ? 'included' : 'omitted'
      }`,
    );
  }

  let response;
  let responseText = '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${String(apiUrl).replace(/\/$/, '')}/sms`;
    console.info(`[SMS] UniSMS ${smsChannel} POST ${url} → ${apiDigits} (${recipient})`);
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    responseText = await response.text();
    console.info(`[SMS] UniSMS response ${response.status} for ${apiDigits}`);
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    const errorMessage = isTimeout
      ? `SMS provider timed out after ${Math.round(timeoutMs / 1000)} second(s). Please try again.`
      : err?.message || 'Failed to reach SMS provider.';
    console.error(`[SMS] UniSMS network error for ${apiDigits}:`, errorMessage);
    await recordSmsLog({
      contactNumber,
      message,
      status: 'failed',
      provider,
      error: errorMessage,
      referenceType,
      referenceId,
      referenceKey,
    });
    throw new Error(errorMessage);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage = formatProviderError(response.status, payload, responseText);
    console.error(`[SMS] UniSMS error for ${apiDigits}:`, errorMessage);
    await recordSmsLog({
      contactNumber,
      message,
      status: 'failed',
      provider,
      error: errorMessage,
      referenceType,
      referenceId,
      referenceKey,
    });
    throw new Error(errorMessage);
  }

  const deliveryStatus = String(payload?.message?.status || '').toLowerCase();
  if (deliveryStatus === 'failed') {
    const errorMessage = formatProviderError(response.status, payload, responseText);
    console.error(`[SMS] UniSMS delivery failed for ${apiDigits}:`, errorMessage);
    await recordSmsLog({
      contactNumber,
      message,
      status: 'failed',
      provider,
      error: errorMessage,
      referenceType,
      referenceId,
      referenceKey,
    });
    throw new Error(errorMessage);
  }

  const providerId = payload?.message?.reference_id || null;

  recordSmsLog({
    contactNumber,
    message,
    status: 'sent',
    provider,
    providerId,
    referenceType,
    referenceId,
    referenceKey,
  }).then((logResult) => {
    if (!logResult.ok) {
      console.warn('SMS log insert failed:', logResult.error);
    }
  });

  return { providerId, payload };
}
