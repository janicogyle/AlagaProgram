import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEligibilityMaps, getResidentEligibility } from './residentEligibility.js';

const residentId = 'resident-1';

test('a pending request blocks every assistance category', () => {
  const rows = [{
    id: 'request-1',
    resident_id: residentId,
    assistance_type: 'Medicine Assistance',
    status: 'Pending',
    created_at: new Date().toISOString(),
  }];

  const eligibility = getResidentEligibility(
    residentId,
    buildEligibilityMaps(rows),
    'Burial Assistance',
  );

  assert.equal(eligibility.canCreateRequest, false);
  assert.equal(eligibility.blockReason, 'active');
  assert.equal(eligibility.cooldownInfo.status, 'Pending');
});

test('an approved request stays blocked until it is released', () => {
  const rows = [{
    id: 'request-1',
    resident_id: residentId,
    assistance_type: 'Medicine Assistance',
    status: 'Approved',
    created_at: new Date().toISOString(),
  }];

  const eligibility = getResidentEligibility(residentId, buildEligibilityMaps(rows));

  assert.equal(eligibility.canCreateRequest, false);
  assert.equal(eligibility.blockReason, 'active');
  assert.equal(eligibility.cooldownInfo.status, 'Approved');
});

test('an incomplete request must be edited instead of duplicated', () => {
  const rows = [{
    id: 'request-1',
    resident_id: residentId,
    assistance_type: 'Confinement Assistance',
    status: 'Rejected',
    created_at: new Date().toISOString(),
  }];

  const eligibility = getResidentEligibility(residentId, buildEligibilityMaps(rows));

  assert.equal(eligibility.canCreateRequest, false);
  assert.equal(eligibility.blockReason, 'incomplete');
  assert.equal(eligibility.editableRequest.id, 'request-1');
});

test('released cooldown starts from released_at rather than request_date', () => {
  const releasedAt = new Date();
  releasedAt.setDate(releasedAt.getDate() - 1);
  const rows = [{
    id: 'request-1',
    resident_id: residentId,
    assistance_type: 'Medicine Assistance',
    status: 'Released',
    request_date: '2020-01-01',
    released_at: releasedAt.toISOString(),
    created_at: '2020-01-01T00:00:00.000Z',
  }];

  const eligibility = getResidentEligibility(residentId, buildEligibilityMaps(rows));

  assert.equal(eligibility.canCreateRequest, false);
  assert.equal(eligibility.blockReason, 'cooldown');
  assert.ok(eligibility.cooldownInfo.daysRemaining > 0);
});

test('a beneficiary becomes eligible after three months from release', () => {
  const releasedAt = new Date();
  releasedAt.setMonth(releasedAt.getMonth() - 4);
  const rows = [{
    id: 'request-1',
    resident_id: residentId,
    assistance_type: 'Medicine Assistance',
    status: 'Released',
    released_at: releasedAt.toISOString(),
    created_at: releasedAt.toISOString(),
  }];

  const eligibility = getResidentEligibility(residentId, buildEligibilityMaps(rows));

  assert.equal(eligibility.canCreateRequest, true);
  assert.equal(eligibility.blockReason, null);
});
