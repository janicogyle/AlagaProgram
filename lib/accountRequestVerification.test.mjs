import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual route loader without loading provider clients or sending
// notifications. The fake database returns only explicitly selected columns.
const source = readFileSync(new URL('../app/api/account-requests/[id]/route.js', import.meta.url), 'utf8');
const start = source.indexOf('async function fetchAccountRequestWithRetry(');
const end = source.indexOf('\nfunction isBlank(', start);
const loadRequest = vm.runInNewContext(`(${source.slice(start, end).trim()})`);

for (const method of ['sms', 'email']) {
  test(`account request loader preserves ${method} verification for notifications and approval`, async () => {
    const row = { id: 'request-id', email: 'example@example.com', contact_number: '09123456789', verification_method: method, contact_verified: method === 'sms', email_verified: method === 'email' };
    let columns;
    const query = {
      select(value) { columns = value.split(',').map(v => v.trim()); return this; },
      eq(field, value) { assert.equal(field, 'id'); assert.equal(value, row.id); return this; },
      async single() { return { data: Object.fromEntries(columns.map(key => [key, row[key]])), error: null }; },
    };
    const result = await loadRequest({ from(table) { assert.equal(table, 'account_requests'); return query; } }, row.id);
    assert.equal(result.data.verification_method, method);
    assert.equal(result.data.contact_verified, method === 'sms');
    assert.equal(result.data.email_verified, method === 'email');
  });
}

const approvalStart = source.indexOf("    if (finalAction === 'approve') {");
const approvalEnd = source.indexOf('      let residentId = null;', approvalStart);
const checkApproval = vm.runInNewContext(`(accountRequest) => {
  const finalAction = 'approve';
  const VALID_ID_BOTH_SIDES_ERROR = 'Both ID sides required';
  const FACE_VERIFICATION_FAILED_ERROR = 'Face verification required';
  const NextResponse = { json: (body, options) => ({ ...body, ...options }) };
  ${source.slice(approvalStart, approvalEnd)}
  }
  return { status: 200 };
}`);
for (const status of ['passed', 'manual_review']) {
  test(`staff approval accepts ${status} with complete identity documents`, () => {
    assert.equal(checkApproval({ valid_id_front_url: 'front', valid_id_back_url: 'back', selfie_url: 'selfie', face_verification_status: status }).status, 200);
  });
}
for (const missing of ['valid_id_front_url', 'valid_id_back_url', 'selfie_url']) {
  test(`staff approval still requires ${missing}`, () => {
    assert.equal(checkApproval({ valid_id_front_url: 'front', valid_id_back_url: 'back', selfie_url: 'selfie', face_verification_status: 'manual_review', [missing]: null }).status, 409);
  });
}
test('failed or absent face checks are not treated as manual review', () => {
  for (const status of ['failed', null, '']) {
    assert.equal(checkApproval({ valid_id_front_url: 'front', valid_id_back_url: 'back', selfie_url: 'selfie', face_verification_status: status }).status, 409);
  }
});
