import {
  buildAccountStatusMessage,
  buildAssistanceStatusMessage,
  extractMissingRequirements,
} from '@/lib/smsTemplates';
import {
  canSendSms,
  getSmsSetupError,
  isSmsDevModeEnabled,
  normalizeSmsContactNumber,
  sendSms,
  toSmsApiDigits,
} from '@/lib/sms.server';

function logSms(event, level, detail) {
  const prefix = `[SMS] ${event}`;
  if (level === 'error') console.error(prefix, detail);
  else if (level === 'warn') console.warn(prefix, detail);
  else console.info(prefix, detail);
}

/**
 * Send a status-change SMS with validation, terminal logs, and structured result.
 */
export async function sendStatusNotification({
  event,
  contactNumber,
  message,
  referenceType,
  referenceId,
  referenceKey,
}) {
  const normalized = normalizeSmsContactNumber(contactNumber);
  if (!normalized) {
    const error = 'No valid beneficiary contact number on record.';
    logSms(event, 'error', `skipped — ${error}`);
    return { ok: false, error };
  }

  const apiDigits = toSmsApiDigits(normalized);
  if (!message) {
    const error = 'No SMS message template for this status.';
    logSms(event, 'error', `skipped — ${error}`);
    return { ok: false, error, recipient: apiDigits };
  }

  if (!canSendSms()) {
    const setupError = getSmsSetupError() || 'SMS is not configured.';
    if (isSmsDevModeEnabled() && process.env.NODE_ENV !== 'production') {
      logSms(event, 'info', `DEV MODE → ${apiDigits}: ${message}`);
      return { ok: true, devMode: true, recipient: apiDigits, providerId: null };
    }
    logSms(event, 'error', `failed — ${setupError}`);
    return { ok: false, skipped: true, error: setupError, recipient: apiDigits };
  }

  logSms(event, 'info', `sending to ${apiDigits}…`);

  try {
    const result = await sendSms({
      to: normalized,
      message,
      referenceType,
      referenceId,
      referenceKey,
    });
    logSms(
      event,
      'info',
      `sent to ${apiDigits}${result?.providerId ? ` (ref: ${result.providerId})` : ''}`,
    );
    return { ok: true, recipient: apiDigits, providerId: result?.providerId || null };
  } catch (error) {
    const errMsg = error?.message || 'Failed to send SMS.';
    logSms(event, 'error', `failed for ${apiDigits} — ${errMsg}`);
    return { ok: false, error: errMsg, recipient: apiDigits };
  }
}

export async function sendAccountStatusSms({ contactNumber, status, notes, requestId }) {
  const smsStatus = status === 'Rejected' ? 'Archived' : status;
  const message = buildAccountStatusMessage({ status: smsStatus, notes });
  const event =
    smsStatus === 'Approved' ? 'account_approved' : smsStatus === 'Archived' ? 'account_rejected' : 'account_status';

  const referenceKey = `${requestId}:${smsStatus}:${Date.now()}`;

  return sendStatusNotification({
    event,
    contactNumber,
    message,
    referenceType: 'account_status',
    referenceId: requestId,
    referenceKey,
  });
}

export async function sendAssistanceStatusSms({ contactNumber, status, controlNumber, remarks, checklist, requestId }) {
  const missingRequirements = extractMissingRequirements({ remarks, checklist });
  const message = buildAssistanceStatusMessage({
    status,
    controlNumber,
    remarks,
    missingRequirements,
  });

  const eventMap = {
    Approved: 'assistance_approved',
    Rejected: 'assistance_rejected',
    Resubmitted: 'assistance_resubmit_required',
  };
  const event = eventMap[status] || 'assistance_status';

  const referenceKey = `${requestId || controlNumber}:${status}:${Date.now()}`;

  return sendStatusNotification({
    event,
    contactNumber,
    message,
    referenceType: 'assistance_status',
    referenceId: requestId,
    referenceKey,
  });
}
