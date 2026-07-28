import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskIdNumber,
  namesMatch,
  parseIdentityDate,
  parsePhilippineIdentityText,
} from './identityOcrParsing.mjs';

const fixtures = [
  ['philsys', 'PHILIPPINE IDENTIFICATION CARD\nName: JUAN DELA CRUZ\nDate of Birth: 1990-01-02\nPCN: 1234-5678-9012'],
  ['drivers_license', "LAND TRANSPORTATION OFFICE\nDRIVER'S LICENSE\nName: JUAN DELA CRUZ\nDate of Birth: 02/01/1990\nLicense No: N01-23-456789"],
  ['pwd', 'PERSON WITH DISABILITY PWD ID\nName: JUAN DELA CRUZ\nBirth Date: 02 JANUARY 1990\nID No: 1234567'],
  ['senior_citizen', 'OFFICE OF SENIOR CITIZENS AFFAIRS OSCA\nSENIOR CITIZEN ID\nName: JUAN DELA CRUZ\nDOB: 1990-01-02\nID No: SC-123456'],
  ['solo_parent', 'SOLO PARENT IDENTIFICATION CARD\nName: JUAN DELA CRUZ\nDate of Birth: 1990/01/02\nID No: SP-123456'],
  ['passport', 'REPUBLIC OF THE PHILIPPINES PASSPORT\nSurname: DELA CRUZ\nGiven Names: JUAN\nDate of Birth: 02 JAN 1990\nPassport No: P1234567A'],
  ['umid_sss_gsis', 'UNIFIED MULTI-PURPOSE ID UMID\nName: JUAN DELA CRUZ\nDate of Birth: 1990-01-02\nCRN: 1234-5678901-2'],
  ['voters', "COMMISSION ON ELECTIONS\nVOTER'S IDENTIFICATION CARD\nName: JUAN DELA CRUZ\nDate of Birth: 02/01/1990\nID No: 1234-5678"],
  ['prc', 'PROFESSIONAL REGULATION COMMISSION\nPROFESSIONAL IDENTIFICATION CARD\nName: JUAN DELA CRUZ\nBirth Date: 1990-01-02\nRegistration No: 1234567'],
];

for (const [expectedType, text] of fixtures) {
  test(`detects and extracts ${expectedType}`, () => {
    const result = parsePhilippineIdentityText(text);
    assert.equal(result.supported, true);
    assert.equal(result.idType, expectedType);
    assert.deepEqual(result.missingFields, []);
    assert.equal(result.fields.birthDate, '1990-01-02');
    assert.match(result.fields.idNumber, /\d/);
    assert.equal(namesMatch(result.fields.fullName, { firstName: 'Juan', lastName: 'Dela Cruz' }), true);
  });
}

test('rejects explicitly unsupported IDs', () => {
  const result = parsePhilippineIdentityText(
    'PHILIPPINE POSTAL ID\nName: JUAN DELA CRUZ\nDate of Birth: 1990-01-02\nID No: 1234567',
  );
  assert.equal(result.supported, false);
  assert.equal(result.unsupportedLabel, 'Postal ID');
});

test('reports missing required fields for conditional reverse capture', () => {
  const result = parsePhilippineIdentityText('SOLO PARENT ID\nName: JUAN DELA CRUZ\nID No: SP-123456');
  assert.equal(result.supported, true);
  assert.deepEqual(result.missingFields, ['birthDate']);
});

test('normalizes name order and ignores middle-name differences', () => {
  assert.equal(namesMatch('DELA CRUZ, JUAN MIGUEL', { firstName: 'Juan', lastName: 'Dela Cruz' }), true);
  assert.equal(namesMatch('JUANA DELA CRUZ', { firstName: 'Juan', lastName: 'Dela Cruz' }), false);
});

test('normalizes common Philippine ID date formats', () => {
  assert.equal(parseIdentityDate('1990/01/02'), '1990-01-02');
  assert.equal(parseIdentityDate('02 JANUARY 1990'), '1990-01-02');
  assert.equal(parseIdentityDate('January 2, 1990'), '1990-01-02');
});

test('masks all but the last four ID digits', () => {
  assert.equal(maskIdNumber('1234-5678-9012'), '********9012');
});
