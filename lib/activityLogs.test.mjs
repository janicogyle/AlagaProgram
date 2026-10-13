import test from 'node:test';
import assert from 'node:assert/strict';

import { parseActivityLogFilters } from './activityLogs.server.js';
import { createActivityLogReportPdf } from './activityLogPdf.server.js';
import { getEffectiveStaffRole } from './userRoles.js';

test('activity log filters are bounded and safe for server queries', () => {
  const params = new URLSearchParams({
    page: '-4',
    pageSize: '999',
    search: 'approved,(drop)',
    role: 'Admin',
    action: 'Approved assistance request',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-13',
  });

  const filters = parseActivityLogFilters(params);
  assert.equal(filters.page, 1);
  assert.equal(filters.pageSize, 100);
  assert.equal(filters.search, 'approved drop');
  assert.equal(filters.role, 'Admin');
  assert.equal(filters.dateFromLabel, '2026-10-01');
  assert.equal(filters.dateToLabel, '2026-10-13');
  assert.match(filters.dateFrom, /T16:00:00\.000Z$/);
  assert.match(filters.dateToExclusive, /T16:00:00\.000Z$/);
});

test('legacy single-sector staff use their coordinator role in activity logs', () => {
  assert.equal(getEffectiveStaffRole('Staff', ['solo_parent']), 'Solo Parent Coordinator');
  assert.equal(getEffectiveStaffRole('Staff', ['pwd']), 'PWD Coordinator');
  assert.equal(
    getEffectiveStaffRole('Staff', ['senior_citizen']),
    'Senior Citizen Coordinator',
  );
  assert.equal(getEffectiveStaffRole('Staff', ['pwd', 'solo_parent']), 'Staff');
});

test('activity log PDF is generated as a readable PDF document', async () => {
  const pdf = await createActivityLogReportPdf({
    rows: [
      {
        created_at: '2026-10-13T08:30:00.000Z',
        actor_name: 'Test Administrator',
        actor_role: 'Admin',
        action: 'Approved assistance request',
        message: 'Assistance request approved for release.',
        entity_type: 'assistance_request',
        reference_number: '2026-001',
      },
    ],
    viewer: { kind: 'admin', name: 'Test Administrator', role: 'Admin' },
    filters: {},
    total: 1,
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString('ascii'), '%PDF');
  assert.ok(pdf.byteLength > 1_000);
});
