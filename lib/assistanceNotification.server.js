import { getNotificationDestination, skippedNotification } from './notificationDestination.js';
import { sendAssistanceStatusSms } from './smsNotify.server.js';
import { sendAssistanceStatusEmail } from './emailNotify.server.js';

export async function notifyAssistanceStatus(db, data) {
  const { data: resident, error } = await db.from('residents')
    .select('contact_number, email, verification_method, contact_verified, email_verified')
    .eq('id', data.resident_id).maybeSingle();
  if (error) return { ok: false, error: 'Unable to load beneficiary notification preferences.' };
  const destination = getNotificationDestination(resident);
  const details = { status: data.status, controlNumber: data.control_number, remarks: data.decision_remarks };
  if (destination.channel === 'email') return sendAssistanceStatusEmail({ ...details, email: destination.email });
  if (destination.channel === 'sms') return sendAssistanceStatusSms({
    ...details, contactNumber: destination.contactNumber, checklist: data.requirements_checklist, requestId: data.id,
  });
  return skippedNotification();
}
