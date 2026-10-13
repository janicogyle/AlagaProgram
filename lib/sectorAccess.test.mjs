import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSectorOrFilter, rowMatchesSectorAccess } from './sectorAccess.js';

test('coordinator access is based on primary sector only', () => {
  const beneficiary = {
    primary_sector: 'pwd',
    secondary_sector: 'solo_parent',
    is_pwd: true,
    is_solo_parent: true,
  };

  assert.equal(
    rowMatchesSectorAccess(beneficiary, { role: 'PWD Coordinator', sector_access: ['pwd'] }),
    true,
  );
  assert.equal(
    rowMatchesSectorAccess(beneficiary, { role: 'Solo Parent Coordinator', sector_access: ['solo_parent'] }),
    false,
  );
});

test('secondary-sector flags do not grant coordinator access', () => {
  const beneficiary = {
    primary_sector: 'senior_citizen',
    secondary_sector: 'pwd',
    is_senior_citizen: true,
    is_pwd: true,
  };

  assert.equal(
    rowMatchesSectorAccess(beneficiary, { role: 'PWD Coordinator', sector_access: ['pwd'] }),
    false,
  );
});

test('admin access remains unrestricted', () => {
  assert.equal(rowMatchesSectorAccess({ primary_sector: null }, { role: 'Admin' }), true);
});

test('database filters target primary_sector', () => {
  assert.equal(
    buildSectorOrFilter({ role: 'Staff', sector_access: ['solo_parent'] }),
    'primary_sector.eq.solo_parent',
  );
  assert.equal(
    buildSectorOrFilter({ role: 'Staff', sector_access: ['pwd', 'senior_citizen'] }, 'residents.'),
    'residents.primary_sector.eq.pwd,residents.primary_sector.eq.senior_citizen',
  );
});
