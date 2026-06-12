import { OTP_EXPIRY_MINUTES } from '@/lib/sms.server';

export function buildOtpMessage(code) {
  return `Barangay Sta. Rita OTP: ${code}. Expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
}

export function buildAccountStatusMessage({ status, notes }) {
  // UniSMS may reject marketing-style wording (422 spam filter). Keep messages short and factual.
  if (status === 'Approved') {
    return 'Sta Rita ALAGA: Your signup is approved. You may log in with your contact number and password.';
  }

  if (status === 'Archived' || status === 'Rejected') {
    const missing = String(notes || '').trim();
    if (missing) {
      return `Sta Rita ALAGA: Signup incomplete. Missing: ${missing}. Visit the barangay office.`;
    }
    return 'Sta Rita ALAGA: Signup could not be completed. Visit the barangay office for details.';
  }

  return null;
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

  if (status === 'Approved') {
    return 'Sta. Rita ALAGA: Your assistance request has been approved. Please proceed to the Barangay Secretariat Social Services Office or Barangay Treasury Office and bring a valid ID for verification';
  }

  if (status === 'Rejected') {
    const docs = missing || 'required documents';
    return `Sta Rita ALAGA: Additional documents needed: ${docs}. Please resubmit your request.`;
  }

  if (status === 'Resubmitted') {
    const docs = missing || 'required documents';
    return `Sta Rita ALAGA: Resubmission required. Please provide: ${docs}.`;
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
  if (sms.ok) {
    const recipient = sms.recipient ? ` (${sms.recipient})` : '';
    return ` An SMS was sent to the beneficiary${recipient}.`;
  }
  if (sms.skipped) return '';
  const reason = String(sms.error || 'unknown error').trim();
  return reason ? ` SMS was not sent: ${reason}` : ' SMS was not sent.';
}
