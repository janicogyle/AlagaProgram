import { OTP_EXPIRY_MINUTES } from './smsConstants.js';

export function buildOtpMessage(code) {
  return `Barangay Sta. Rita OTP: ${code}. Expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
}

export function buildAccountStatusMessage({ status, notes }) {
  // UniSMS may reject marketing-style wording (422 spam filter). Keep messages short and factual.
  if (status === 'Approved') {
    return 'Sta Rita ALAGA: Your signup is approved. You may log in with your contact number and password.';
  }

  if (status === 'Incomplete' || status === 'Archived' || status === 'Rejected') {
    const missing = String(notes || '').trim();
    if (missing) {
      return `Sta Rita ALAGA: Signup incomplete. Missing: ${missing}. Visit the barangay office.`;
    }
    return 'Sta Rita ALAGA: Signup could not be completed. Visit the barangay office for details.';
  }

  return null;
}

export function buildAccountResubmissionMessage({ notes, resubmissionCode }) {
  const code = String(resubmissionCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!code) return null;

  const missing = String(notes || '').trim();
  if (missing) {
    return `Sta Rita ALAGA: Signup incomplete. Missing: ${missing}. Resubmit code: ${code}. Open the Alaga resubmit page on the portal and enter this code.`;
  }
  return `Sta Rita ALAGA: Signup incomplete. Resubmit code: ${code}. Open the Alaga resubmit page on the portal and enter this code.`;
}

export function extractMissingRequirements({ remarks, checklist }) {
  const trimmedRemarks = String(remarks || '').trim();
  if (trimmedRemarks) return trimmedRemarks;

  if (!Array.isArray(checklist)) return '';

  const missing = [];
  for (const item of checklist) {
    if (typeof item === 'string') {
      missing.push(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;

    const checked =
      item.checked === true ||
      item.checked === 'true' ||
      item.checked === 1 ||
      item.checked === '1' ||
      item.completed === true ||
      item.completed === 'true' ||
      item.completed === 1 ||
      item.completed === '1';

    if (!checked) {
      missing.push(
        item.label || item.name || item.requirement || item.title || item.text || 'Requirement',
      );
    }
  }

  return missing.filter(Boolean).join(', ');
}

export function buildAssistanceStatusMessage({ status, controlNumber, remarks, missingRequirements }) {
  const missing = String(missingRequirements || remarks || '').trim();
  const reference = controlNumber ? ` (${controlNumber})` : '';

  if (status === 'Approved') {
    return `Sta Rita ALAGA: Assistance${reference} approved. Visit the Barangay Social Services or Treasury Office with a valid ID for verification.`;
  }

  if (status === 'Rejected' || status === 'Incomplete') {
    const docs = missing || 'required documents';
    return `Sta Rita ALAGA: Assistance${reference} incomplete. Please provide: ${docs}, then resubmit your request.`;
  }

  if (status === 'Resubmitted') {
    return `Sta Rita ALAGA: Your assistance request${reference} was resubmitted and is awaiting review.`;
  }

  if (status === 'Released') {
    return `Sta Rita ALAGA: Your assistance${reference} has been released. Your next request remains subject to the three-month eligibility period.`;
  }

  return null;
}

export function buildEligibilityReminderMessage({ nextEligibleDate }) {
  const dateLabel = nextEligibleDate || 'your next eligible date';
  return `Barangay Sta. Rita: You are now eligible to request assistance again starting ${dateLabel}. Please visit the portal to submit a new request.`;
}

export function buildBeneficiaryIdRenewalReminderMessage({ daysUntilExpiration, expirationDate }) {
  const dateLabel = expirationDate || 'soon';
  if (Number(daysUntilExpiration) <= 0) {
    return `Sta Rita ALAGA: Your Beneficiary ID has expired. Please log in and renew your ID.`;
  }
  return `Sta Rita ALAGA: Your Beneficiary ID expires on ${dateLabel}. Please log in and renew your ID.`;
}

export function buildBeneficiaryIdRenewalApprovedMessage({ expirationDate }) {
  const dateLabel = expirationDate || 'the updated expiration date';
  return `Sta Rita ALAGA: Your Beneficiary ID renewal is approved. Your ID is valid until ${dateLabel}.`;
}

export function buildBeneficiaryIdRenewalIncompleteMessage({ remarks }) {
  const note = String(remarks || '').trim();
  if (note) return `Sta Rita ALAGA: Your ID renewal is incomplete. ${note}. Please resubmit.`;
  return 'Sta Rita ALAGA: Your ID renewal is incomplete. Please resubmit an updated valid ID.';
}

/** Admin UI note after approve/reject when the API returns an `sms` object. */
export function formatSmsNotificationResult(sms) {
  if (!sms) return '';
  if (sms.devMode) return ' SMS was simulated in development mode; no text message was sent.';
  if (sms.ok) {
    const recipient = sms.recipient ? ` (${sms.recipient})` : '';
    return ` SMS accepted by the provider for the beneficiary${recipient}; delivery is not yet confirmed.`;
  }
  const reason = String(sms.error || 'unknown error').trim();
  return reason ? ` SMS was not sent: ${reason}` : ' SMS was not sent.';
}

export function formatDeliveryResult(delivery) {
  if (!delivery) return '';
  if (delivery.devMode) return ' Notification was simulated in development mode; no message was sent.';
  const label = delivery.channel === 'email' ? 'email' : delivery.channel === 'sms' ? 'SMS' : 'notification';
  if (delivery.ok) {
    if (delivery.channel === 'sms') return formatSmsNotificationResult(delivery);
    const recipient = delivery.recipient ? ` (${delivery.recipient})` : '';
    const article = label === 'email' || label === 'SMS' ? 'An' : 'A';
    return ` ${article} ${label} update was sent to the beneficiary${recipient}.`;
  }
  const reason = String(delivery.error || 'unknown error').trim();
  return reason ? ` ${label} update was not sent: ${reason}` : ` ${label} update was not sent.`;
}
