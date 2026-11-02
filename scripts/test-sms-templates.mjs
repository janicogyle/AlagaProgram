// Preview by default. --send explicitly sends one labeled message per scenario.
import dotenv from 'dotenv';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
dotenv.config({ path: '.env.local', quiet: true });
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/')
    ? pathToFileURL(path.resolve(`${specifier.slice(2)}.js`)).href : specifier, context);
} });
const t = await import('../lib/smsTemplates.js');
const cases = [
  ['OTP', t.buildOtpMessage('000000')],
  ['Account approved', t.buildAccountStatusMessage({ status: 'Approved' })],
  ['Account incomplete', t.buildAccountStatusMessage({ status: 'Incomplete', notes: 'Sample ID back' })],
  ['Account resubmission', t.buildAccountResubmissionMessage({ notes: 'Sample ID', resubmissionCode: 'TEST0000' })],
  ...['Approved', 'Rejected', 'Resubmitted', 'Released'].map(status => [`Assistance ${status}`, t.buildAssistanceStatusMessage({ status, controlNumber: 'TEST-001', remarks: 'Sample receipt' })]),
  ['Eligibility reminder', t.buildEligibilityReminderMessage({ nextEligibleDate: '2027-02-02' })],
  ['ID expiring', t.buildBeneficiaryIdRenewalReminderMessage({ daysUntilExpiration: 7, expirationDate: 'Nov 09, 2026' })],
  ['ID expired', t.buildBeneficiaryIdRenewalReminderMessage({ daysUntilExpiration: 0 })],
  ['ID renewal approved', t.buildBeneficiaryIdRenewalApprovedMessage({ expirationDate: 'Nov 02, 2027' })],
  ['ID renewal incomplete', t.buildBeneficiaryIdRenewalIncompleteMessage({ remarks: 'Sample updated ID' })],
];
const send = process.argv.includes('--send');
const recipient = process.argv.find(value => /^09\d{9}$/.test(value));
if (send && !recipient) throw new Error('Provide the authorized test mobile number.');
const { sendSms } = send ? await import('../lib/sms.server.js') : {};
const runId = `template-test-${Date.now()}`;
let failures = 0;
for (const [index, [name, body]] of cases.entries()) {
  const message = `TEST ONLY ${index + 1}/${cases.length}: ${body}`;
  if (!send) { console.log(`${name}: ${message}`); continue; }
  try {
    const result = await sendSms({ to: recipient, message, referenceType: 'sms_diagnostic', referenceKey: `${runId}:${index + 1}` });
    console.log(JSON.stringify({ test: index + 1, name, providerId: result.providerId, status: result.payload?.message?.status }));
  } catch (error) {
    failures += 1;
    console.error(JSON.stringify({ test: index + 1, name, error: error.message }));
  }
  if (index < cases.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));
}
console.log(JSON.stringify({ scenarios: cases.length, failures, sent: send }));
if (failures) process.exitCode = 1;
