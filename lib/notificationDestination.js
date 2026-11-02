import { normalizePhContactNumber } from './contactNumber.js';

export function getNotificationDestination(resident) {
  if (resident?.verification_method === 'email' && resident.email_verified === true && resident.email) {
    return { channel: 'email', email: resident.email };
  }
  const contactNumber = normalizePhContactNumber(resident?.contact_number);
  if (resident?.contact_verified === true && /^09\d{9}$/.test(contactNumber || '')) {
    return { channel: 'sms', contactNumber };
  }
  return { channel: null };
}

export function skippedNotification() {
  return { ok: false, skipped: true, error: 'No verified notification contact is available. Verify the beneficiary phone number or email first.' };
}
