import test from 'node:test';
import assert from 'node:assert/strict';
import * as sms from './smsTemplates.js';
import { getNotificationDestination } from './notificationDestination.js';
import { getRenewalReminderStage } from './smsReminderSchedule.js';

test('OTP contains the supplied code, expiry, and confidentiality reminder', () => {
  const message = sms.buildOtpMessage('123456');
  assert.match(message, /123456/);
  assert.match(message, /5 minutes/);
  assert.match(message, /Do not share/);
});

test('account approval, incomplete aliases, and resubmission codes', () => {
  assert.match(sms.buildAccountStatusMessage({ status: 'Approved' }), /approved/);
  for (const status of ['Incomplete', 'Archived', 'Rejected']) {
    assert.match(sms.buildAccountStatusMessage({ status, notes: 'ID back' }), /ID back/);
    assert.match(sms.buildAccountStatusMessage({ status }), /barangay office/);
  }
  assert.equal(sms.buildAccountStatusMessage({ status: 'Pending' }), null);
  assert.match(sms.buildAccountResubmissionMessage({ notes: 'ID', resubmissionCode: ' ab-12cd34 ' }), /AB12CD34/);
  assert.match(sms.buildAccountResubmissionMessage({ resubmissionCode: 'AB12CD34' }), /AB12CD34/);
  assert.equal(sms.buildAccountResubmissionMessage({ resubmissionCode: '---' }), null);
});

test('every assistance notification has the reference and correct action', () => {
  for (const status of ['Approved', 'Rejected', 'Incomplete', 'Resubmitted', 'Released']) {
    const message = sms.buildAssistanceStatusMessage({ status, controlNumber: '2026-026', remarks: 'Receipt' });
    assert.match(message, /2026-026/);
    assert.doesNotMatch(message, /undefined|null/);
  }
  assert.match(sms.buildAssistanceStatusMessage({ status: 'Resubmitted' }), /awaiting review/);
  assert.match(sms.buildAssistanceStatusMessage({ status: 'Released' }), /released/);
  assert.match(sms.buildAssistanceStatusMessage({ status: 'Rejected' }), /required documents/);
  assert.equal(sms.buildAssistanceStatusMessage({ status: 'Pending' }), null);
});

test('missing requirements honor remarks and checked/completed variants', () => {
  assert.equal(sms.extractMissingRequirements({ remarks: 'Custom', checklist: ['ID'] }), 'Custom');
  assert.equal(sms.extractMissingRequirements({ checklist: [{ label: 'ID', checked: true }, { label: 'Receipt', completed: '1' }, { label: 'Certificate', checked: false }] }), 'Certificate');
  assert.equal(sms.extractMissingRequirements({ checklist: ['ID', null, { name: 'Receipt' }] }), 'ID, Receipt');
  assert.equal(sms.extractMissingRequirements({}), '');
});

test('eligibility and every ID renewal template handle normal and missing details', () => {
  assert.match(sms.buildEligibilityReminderMessage({ nextEligibleDate: '2027-02-02' }), /2027-02-02/);
  assert.doesNotMatch(sms.buildEligibilityReminderMessage({}), /undefined/);
  assert.match(sms.buildBeneficiaryIdRenewalReminderMessage({ daysUntilExpiration: 7, expirationDate: 'Nov 09, 2026' }), /Nov 09, 2026/);
  for (const daysUntilExpiration of [0, -1]) assert.match(sms.buildBeneficiaryIdRenewalReminderMessage({ daysUntilExpiration }), /expired/);
  assert.match(sms.buildBeneficiaryIdRenewalApprovedMessage({ expirationDate: 'Nov 02, 2027' }), /Nov 02, 2027/);
  assert.doesNotMatch(sms.buildBeneficiaryIdRenewalApprovedMessage({}), /undefined/);
  assert.match(sms.buildBeneficiaryIdRenewalIncompleteMessage({ remarks: 'New ID' }), /New ID/);
  assert.match(sms.buildBeneficiaryIdRenewalIncompleteMessage({}), /updated valid ID/);
});

test('result formatting never claims delivery for simulation, skipping, or acceptance', () => {
  for (const format of [sms.formatSmsNotificationResult, sms.formatDeliveryResult]) {
    assert.equal(format(null), '');
    assert.match(format({ ok: true, channel: 'sms', devMode: true }), /simulated/);
    assert.match(format({ ok: false, skipped: true, error: 'Phone not verified' }), /Phone not verified/);
    assert.match(format({ ok: true, channel: 'sms' }), /delivery is not yet confirmed/);
  }
  assert.match(sms.formatDeliveryResult({ ok: true, channel: 'email' }), /email/);
});

test('notification routing uses verified destinations and preserves email preference', () => {
  const resident = { verification_method: 'sms', contact_number: '+639159937831', contact_verified: true };
  assert.deepEqual(getNotificationDestination(resident), { channel: 'sms', contactNumber: '09159937831' });
  assert.equal(getNotificationDestination({ ...resident, contact_verified: false }).channel, null);
  assert.equal(getNotificationDestination({ ...resident, contact_number: '123' }).channel, null);
  assert.equal(getNotificationDestination({ ...resident, verification_method: 'email', email_verified: true, email: 'test@example.com' }).channel, 'email');
});

test('renewal reminders retry in stable windows using Philippine calendar days', () => {
  const now = '2026-11-02T16:30:00Z'; // Nov 3 in the Philippines
  assert.equal(getRenewalReminderStage('2026-11-03T00:00:00+08:00', now), 0);
  assert.equal(getRenewalReminderStage('2026-11-09T00:00:00+08:00', now), 7);
  assert.equal(getRenewalReminderStage('2026-11-28T00:00:00+08:00', now), 30);
  assert.equal(getRenewalReminderStage('2027-01-01T00:00:00+08:00', now), null);
  assert.equal(getRenewalReminderStage('invalid', now), null);
});
