/**
 * Undoable test-data seeder for ALAGA beneficiary workflows.
 *
 * Usage:
 *   pnpm seed:test-beneficiaries -- --dry-run
 *   pnpm seed:test-beneficiaries -- --apply
 *   pnpm seed:test-beneficiaries -- --undo
 */
import crypto from 'crypto';
import { stat } from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import { resolve } from 'path';
import { resolveAssistanceAmount } from '../lib/assistanceAmounts.mjs';

config({ path: resolve(process.cwd(), '.env.local') });

const TEST_PASSWORD = 'Test@12345';
const TEST_CONTACTS = Array.from({ length: 20 }, (_, index) => `091710000${String(index + 1).padStart(2, '0')}`);
const TEST_REFERENCE_PREFIX = 'ALAGA-SEED-TEST';
const VALID_ID_PLACEHOLDER = 'https://res.cloudinary.com/demo/image/upload/alaga/test-valid-id.png';
const CLOUDINARY_SEED_FOLDER = 'alaga/test-valid-ids';
const SECTOR_ID_FILES = {
  'Senior Citizen': {
    path: 'C:\\Users\\hansol\\Downloads\\SR ID.jpg',
    publicId: 'senior-citizen-id',
  },
  PWD: {
    path: 'C:\\Users\\hansol\\Downloads\\PWD ID.png',
    publicId: 'pwd-id',
  },
  'Solo Parent': {
    path: 'C:\\Users\\hansol\\Downloads\\SOLO PARENT.jpg',
    publicId: 'solo-parent-id',
  },
};
const SECTOR_COORDINATORS = {
  'Senior Citizen': 'Senior Coordinator',
  PWD: 'PWD Coordinator',
  'Solo Parent': 'Solo Parent Coordinator',
};

const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--undo') ? 'undo' : args.has('--dry-run') ? 'dry-run' : '';

if (!mode) {
  console.error('Choose one mode: --dry-run, --apply, or --undo.');
  process.exit(1);
}

if ([...args].filter((arg) => ['--apply', '--undo', '--dry-run'].includes(arg)).length > 1) {
  console.error('Use only one mode at a time: --dry-run, --apply, or --undo.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing Supabase service-role setup. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const beneficiaries = [
  ['Eric', 'Ebuenga', 'Senior Citizen', '09171000001', '1A', '03/12/1958', 68, 'Olongapo City', 'Male', 'Married'],
  ['Juan', 'Japag', 'PWD', '09171000002', '1B', '06/18/1972', 54, 'Zambales', 'Male', 'Married'],
  ['Jerry', 'Galinato', 'Solo Parent', '09171000003', '2', '01/08/1980', 46, 'Olongapo City', 'Male', 'Widowed'],
  ['Ida', 'Dimalanta', 'Senior Citizen', '09171000004', '3A', '09/14/1959', 67, 'Olongapo City', 'Female', 'Married'],
  ['Melchor', 'Latorre', 'PWD', '09171000005', '3B', '02/25/1970', 56, 'Bataan', 'Male', 'Married'],
  ['Hervie', 'Caridad', 'Solo Parent', '09171000006', '3C', '08/11/1984', 42, 'Olongapo City', 'Male', 'Single'],
  ['Jose Rodolfo', 'Pineda', 'Senior Citizen', '09171000007', '3D', '05/03/1957', 69, 'Zambales', 'Male', 'Married'],
  ['Anthea', 'Teope', 'Solo Parent', '09171000008', '3E', '07/15/1987', 39, 'Olongapo City', 'Female', 'Single'],
  ['Felicidad', 'Locsin', 'Senior Citizen', '09171000009', '3F', '11/21/1955', 71, 'Olongapo City', 'Female', 'Widowed'],
  ['Reynaldo', 'Tison', 'PWD', '09171000010', '4A', '04/08/1974', 52, 'Bataan', 'Male', 'Married'],
  ['Benjamin', 'Del Rosario', 'Solo Parent', '09171000011', '4B', '12/05/1983', 43, 'Olongapo City', 'Male', 'Single'],
  ['Joven', 'Gaspar', 'PWD', '09171000012', '4C', '03/19/1976', 50, 'Olongapo City', 'Male', 'Married'],
  ['Victor', 'Cepeda', 'Senior Citizen', '09171000013', '4D', '10/10/1958', 68, 'Olongapo City', 'Male', 'Married'],
  ['Dolores', 'Goron', 'Senior Citizen', '09171000014', '4E', '09/02/1960', 66, 'Olongapo City', 'Female', 'Widowed'],
  ['Radito', 'Ciego', 'PWD', '09171000015', '5A', '06/07/1978', 48, 'Olongapo City', 'Male', 'Married'],
  ['Modesto', 'Marquez', 'Solo Parent', '09171000016', '5A1', '08/16/1982', 44, 'Zambales', 'Male', 'Single'],
  ['Ferdinand', 'Palasol', 'PWD', '09171000017', '5A2', '11/05/1975', 51, 'Olongapo City', 'Male', 'Married'],
  ['William', 'Ybañez', 'Senior Citizen', '09171000018', '5B', '02/14/1956', 70, 'Olongapo City', 'Male', 'Married'],
  ['Zenaida', 'Sasis', 'Senior Citizen', '09171000019', '5C', '07/20/1959', 67, 'Olongapo City', 'Female', 'Widowed'],
  ['Porterio', 'Bueno Jr.', 'Solo Parent', '09171000020', '5D', '01/12/1985', 41, 'Olongapo City', 'Male', 'Single'],
].map(([firstName, lastName, sector, contact, purok, birthday, age, birthplace, sex, civilStatus], index) => {
  return {
    index,
    name: `${firstName} ${lastName}`,
    sector,
    contact,
    first_name: firstName,
    middle_name: null,
    last_name: lastName,
    birthday: toIsoDate(birthday),
    age,
    birthplace,
    sex,
    citizenship: 'Filipino',
    civil_status: civilStatus,
    house_no: null,
    purok,
    street: null,
    barangay: 'Sta. Rita',
    city: 'Olongapo City',
    is_pwd: sector === 'PWD',
    is_senior_citizen: sector === 'Senior Citizen',
    is_solo_parent: sector === 'Solo Parent',
    valid_id_url: VALID_ID_PLACEHOLDER,
    address: `Purok ${purok}, Sta. Rita, Olongapo`,
    isOnline: index % 2 === 0,
  };
});

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolvePromise, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolvePromise(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;
  const maxmem = 64 * 1024 * 1024;
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(`${password}${process.env.PASSWORD_PEPPER ?? ''}`, salt, keylen, {
    N,
    r,
    p,
    maxmem,
  });
  return ['scrypt', String(N), String(r), String(p), salt.toString('base64'), Buffer.from(derivedKey).toString('base64')].join('$');
}

function toIsoDate(mmddyyyy) {
  const [month, day, year] = String(mmddyyyy).split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function isoTimestamp(date) {
  return date.toISOString();
}

function parseBeneficiarySequence(value) {
  const match = String(value || '').trim().match(/^BENEF-(\d+)$/i);
  return match ? Number(match[1]) || 0 : 0;
}

function formatBeneficiaryControl(seq) {
  return `BENEF-${String(seq).padStart(3, '0')}`;
}

function formatAssistanceControl(seq, now = new Date()) {
  return `${now.getFullYear()}-${String(seq).padStart(3, '0')}`;
}

function fullName(row) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ');
}

function coordinatorForSector(sector) {
  return SECTOR_COORDINATORS[sector] || 'Seed Coordinator';
}

function chunk(values, size = 50) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function configureCloudinary() {
  const cloudinaryUrl = String(process.env.CLOUDINARY_URL || '').trim();
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      cloudinary.config({
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
        secure: true,
      });
      return;
    } catch {
      throw new Error('Invalid CLOUDINARY_URL in .env.local. Expected cloudinary://API_KEY:API_SECRET@CLOUD_NAME.');
    }
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return;
  }

  throw new Error(
    'Missing Cloudinary setup. Add CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env.local before applying seed data.',
  );
}

async function uploadSectorValidIds() {
  configureCloudinary();

  const uploadedBySector = {};
  for (const [sector, file] of Object.entries(SECTOR_ID_FILES)) {
    try {
      await stat(file.path);
    } catch {
      throw new Error(`Missing test valid ID image for ${sector}: ${file.path}`);
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: CLOUDINARY_SEED_FOLDER,
      public_id: file.publicId,
      resource_type: 'image',
      overwrite: true,
    });

    uploadedBySector[sector] = result.secure_url || result.url;
    if (!uploadedBySector[sector]) {
      throw new Error(`Cloudinary upload for ${sector} did not return a URL.`);
    }
  }

  console.log(`Uploaded sector valid ID images to Cloudinary folder: ${CLOUDINARY_SEED_FOLDER}`);
  return uploadedBySector;
}

async function must(result, label) {
  const resolved = await result;
  if (resolved.error) throw new Error(`${label}: ${resolved.error.message || resolved.error}`);
  return resolved;
}

function getMissingColumn(message, table) {
  const text = String(message || '');

  let match = text.match(new RegExp(`Could not find the '([^']+)' column of '${table}' in the schema cache`, 'i'));
  if (match?.[1]) return match[1];

  match = text.match(new RegExp(`column\\s+(?:public\\.)?${table}\\.([a-zA-Z0-9_]+)\\s+does\\s+not\\s+exist`, 'i'));
  if (match?.[1]) return match[1];

  match = text.match(new RegExp(`column\\s+"?([a-zA-Z0-9_]+)"?\\s+of\\s+relation\\s+"?(?:public\\.)?${table}"?\\s+does\\s+not\\s+exist`, 'i'));
  if (match?.[1]) return match[1];

  return null;
}

function isMissingTable(error, table) {
  const msg = String(error?.message || error || '').toLowerCase();
  const tableName = String(table || '').toLowerCase();
  return (
    msg.includes(tableName) &&
    (msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      msg.includes(`could not find the table 'public.${tableName}'`))
  );
}

async function insertRowsWithRetry(table, rows, selectFields, label, { requiredColumns = [] } = {}) {
  let currentRows = rows.map((row) => ({ ...row }));
  const stripped = [];
  const required = new Set(requiredColumns);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(currentRows).select(selectFields);
    if (!error) {
      if (stripped.length) {
        console.warn(`${label}: skipped optional missing column(s): ${stripped.join(', ')}`);
      }
      return data || [];
    }

    const missing = getMissingColumn(error.message, table);
    if (!missing && isMissingTable(error, table)) {
      throw new Error(`${label}: table ${table} is not available.`);
    }
    if (!missing) throw new Error(`${label}: ${error.message || error}`);
    if (required.has(missing)) {
      throw new Error(`${label}: database is missing required column ${table}.${missing}.`);
    }
    if (stripped.includes(missing)) throw new Error(`${label}: schema cache is still rejecting ${table}.${missing}.`);

    currentRows = currentRows.map((row) => {
      const next = { ...row };
      delete next[missing];
      return next;
    });
    stripped.push(missing);
  }

  throw new Error(`${label}: too many schema fallback attempts.`);
}

async function maybeDelete(table, buildQuery, label) {
  try {
    const { data, error } = await buildQuery(supabase.from(table).delete());
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    const msg = String(error?.message || error || '').toLowerCase();
    if (msg.includes(table) && (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find'))) {
      console.warn(`Skipping ${label}: ${table} table is not available.`);
      return 0;
    }
    throw error;
  }
}

async function loadSeededResidents() {
  const { data, error } = await supabase
    .from('residents')
    .select('id, control_number, contact_number, account_request_id, first_name, last_name')
    .in('contact_number', TEST_CONTACTS);
  if (error) throw error;
  return data || [];
}

async function undoSeedData({ dryRun = false } = {}) {
  const residents = await loadSeededResidents();
  const residentIds = residents.map((resident) => resident.id).filter(Boolean);
  const accountRequestIds = residents.map((resident) => resident.account_request_id).filter(Boolean);
  const contactNumbers = TEST_CONTACTS;

  console.log('Seed data cleanup boundary:');
  console.log(`  Contacts: ${contactNumbers[0]} through ${contactNumbers.at(-1)}`);
  console.log(`  Existing seeded residents found: ${residentIds.length}`);

  if (dryRun) {
    console.log('Dry run only. No rows will be deleted.');
    return { residents, residentIds, accountRequestIds };
  }

  let deletedActivity = 0;
  if (residentIds.length) {
    deletedActivity += await maybeDelete(
      'activity_logs',
      (query) =>
        query
          .or(`actor_resident_id.in.(${residentIds.join(',')}),audience_resident_id.in.(${residentIds.join(',')})`)
          .select('id'),
      'activity logs by seeded resident ids',
    );
  }
  deletedActivity += await maybeDelete(
    'activity_logs',
    (query) => query.like('reference_number', `${TEST_REFERENCE_PREFIX}%`).select('id'),
    'activity logs by seed reference',
  );

  let deletedRenewals = 0;
  let deletedAssistance = 0;
  let deletedCards = 0;
  if (residentIds.length) {
    for (const ids of chunk(residentIds)) {
      deletedRenewals += await maybeDelete(
        'beneficiary_id_renewal_requests',
        (query) => query.in('resident_id', ids).select('id'),
        'renewal requests',
      );
      deletedAssistance += await maybeDelete(
        'assistance_requests',
        (query) => query.in('resident_id', ids).select('id'),
        'assistance requests',
      );
      deletedCards += await maybeDelete(
        'beneficiary_cards',
        (query) => query.in('resident_id', ids).select('id'),
        'beneficiary cards',
      );
    }
  }

  const accountIdsToDelete = [...new Set(accountRequestIds)];
  let deletedAccountRequests = 0;
  if (accountIdsToDelete.length) {
    deletedAccountRequests += await maybeDelete(
      'account_requests',
      (query) => query.in('id', accountIdsToDelete).select('id'),
      'linked account requests',
    );
  }
  deletedAccountRequests += await maybeDelete(
    'account_requests',
    (query) => query.in('contact_number', contactNumbers).select('id'),
    'account requests by test contacts',
  );

  let deletedResidents = 0;
  if (residentIds.length) {
    deletedResidents = await maybeDelete(
      'residents',
      (query) => query.in('id', residentIds).select('id'),
      'test residents',
    );
  }

  console.log('Deleted seed data:');
  console.log(`  Activity logs: ${deletedActivity}`);
  console.log(`  Renewal requests: ${deletedRenewals}`);
  console.log(`  Assistance requests: ${deletedAssistance}`);
  console.log(`  Beneficiary cards: ${deletedCards}`);
  console.log(`  Account requests: ${deletedAccountRequests}`);
  console.log(`  Residents: ${deletedResidents}`);

  return { residents: [], residentIds: [], accountRequestIds: [] };
}

async function nextBeneficiaryControlNumbers(count) {
  const { data, error } = await supabase.from('residents').select('control_number');
  if (error) throw error;
  let maxSeq = 0;
  for (const row of data || []) maxSeq = Math.max(maxSeq, parseBeneficiarySequence(row.control_number));
  return Array.from({ length: count }, (_, index) => formatBeneficiaryControl(maxSeq + index + 1));
}

async function nextAssistanceControlNumbers(count) {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('assistance_requests')
    .select('control_number')
    .like('control_number', `${year}-%`);
  if (error) throw error;
  let maxSeq = 0;
  for (const row of data || []) {
    const match = String(row.control_number || '').match(new RegExp(`^${year}-(\\d+)$`));
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]) || 0);
  }
  return Array.from({ length: count }, (_, index) => formatAssistanceControl(maxSeq + index + 1));
}

function cardScenario(row, now) {
  const index = row.index;
  if (index <= 3) {
    return {
      residentStatus: 'Expired',
      cardStatus: 'Expired',
      issuedAt: addDays(now, -390 - index),
      expiresAt: addDays(now, -20 + index),
    };
  }
  if (index <= 7) {
    return {
      residentStatus: 'Active',
      cardStatus: 'Expiring Soon',
      issuedAt: addDays(now, -360 + index),
      expiresAt: addDays(now, 3 + (index - 4)),
    };
  }
  if (index <= 11) {
    return {
      residentStatus: 'Active',
      cardStatus: 'Expiring Soon',
      issuedAt: addDays(now, -340 + index),
      expiresAt: addDays(now, 14 + (index - 8) * 5),
    };
  }
  return {
    residentStatus: 'Active',
    cardStatus: 'Active',
    issuedAt: new Date('2026-06-02T00:00:00.000Z'),
    expiresAt: new Date('2027-06-02T00:00:00.000Z'),
  };
}

function assistanceSeedRows(residentsByContact, controlNumbers, now) {
  const specs = [
    [0, 'Released', 'Medicine Assistance', -120, 500, 'Eligible sample - released over 90 days ago.'],
    [1, 'Released', 'Burial Assistance', -95, 1000, 'Eligible sample - released over 90 days ago.'],
    [2, 'Released', 'Confinement Assistance', -75, 1000, 'Future eligibility sample - 75 days since release.'],
    [3, 'Released', 'Medicine Assistance', -62, 500, 'Future eligibility sample - 62 days since release.'],
    [4, 'Released', 'Confinement Assistance', -45, 1000, 'Not yet eligible sample - less than 60 days.'],
    [5, 'Released', 'Burial Assistance', -25, 1000, 'Not yet eligible sample - less than 60 days.'],
    [8, 'Pending', 'Medicine Assistance', -2, 0, 'Under review sample using Pending status.'],
    [9, 'Resubmitted', 'Confinement Assistance', -4, 0, 'Under review sample using Resubmitted status.'],
    [10, 'Approved', 'Burial Assistance', -8, 1000, 'Approved sample awaiting release.'],
    [11, 'Rejected', 'Medicine Assistance', -11, 0, 'Rejected sample.'],
    [12, 'Pending', 'Burial Assistance', -1, 0, 'Pending request status sample.'],
    [13, 'Approved', 'Confinement Assistance', -6, 1000, 'Approved request status sample.'],
    [14, 'Released', 'Medicine Assistance', -130, 500, 'Released request status sample.'],
    [15, 'Rejected', 'Burial Assistance', -15, 0, 'Cancelled-like sample represented as Rejected.'],
  ];

  return specs.map(([beneficiaryIndex, status, assistanceType, daysAgo, amount, remarks], index) => {
    const beneficiary = beneficiaries[beneficiaryIndex];
    const resident = residentsByContact.get(beneficiary.contact);
    const requestDate = addDays(now, daysAgo);
    const processed = ['Approved', 'Released', 'Rejected'].includes(status);
    const requestSource = beneficiary.isOnline ? 'online' : 'walk-in';
    const requirementFiles = requestSource === 'online'
      ? [
          {
            file_url: beneficiary.valid_id_url,
            file_name: `${beneficiary.sector} sample ID`,
            requirement_type: 'Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID',
          },
        ]
      : [];
    const requirementUrls = requirementFiles.map((file) => file.file_url);
    return {
      control_number: controlNumbers[index],
      resident_id: resident.id,
      requester_name: fullName(beneficiary),
      requester_contact: beneficiary.contact,
      requester_address: beneficiary.address,
      beneficiary_name: fullName(beneficiary),
      beneficiary_contact: beneficiary.contact,
      beneficiary_address: beneficiary.address,
      assistance_type: assistanceType,
      amount: resolveAssistanceAmount(assistanceType, amount),
      status,
      request_source: requestSource,
      processed_by: processed ? coordinatorForSector(beneficiary.sector) : null,
      decision_remarks: remarks,
      valid_id_url: requestSource === 'online' ? beneficiary.valid_id_url : null,
      requirements_urls: requirementUrls,
      requirements_files: requirementFiles,
      requirements_checklist: [
        { label: 'Valid ID', completed: true },
        { label: 'Proof of eligibility', completed: status !== 'Rejected' },
      ],
      requirements_completed: status !== 'Rejected',
      request_date: isoDate(requestDate),
      created_at: isoTimestamp(requestDate),
    };
  });
}

function renewalSeedRows(residentsByContact, cardsByResidentId, now) {
  const specs = [
    [0, 'Pending', 'Expired ID renewal submitted for review.', null],
    [1, 'Incomplete', 'Missing updated valid ID for renewal.', 'Please upload a clearer valid ID.'],
    [4, 'Pending', 'Expiring-soon ID renewal submitted.', null],
    [5, 'Incomplete', 'Expiring-soon renewal needs correction.', 'Please replace the blurred document.'],
    [6, 'Approved', 'Approved renewal sample.', 'Approved for testing.'],
  ];

  return specs.map(([beneficiaryIndex, status, remarks, adminRemarks], index) => {
    const beneficiary = beneficiaries[beneficiaryIndex];
    const resident = residentsByContact.get(beneficiary.contact);
    const card = cardsByResidentId.get(resident.id);
    const createdAt = addDays(now, -8 + index);
    return {
      resident_id: resident.id,
      card_id: card.id,
      current_expires_at: card.expires_at,
      updated_valid_id_url: beneficiary.valid_id_url,
      remarks,
      status,
      admin_remarks: adminRemarks,
      processed_by: status === 'Approved' || status === 'Incomplete' ? coordinatorForSector(beneficiary.sector) : null,
      processed_at: status === 'Approved' || status === 'Incomplete' ? isoTimestamp(addDays(createdAt, 1)) : null,
      created_at: isoTimestamp(createdAt),
    };
  });
}

function activitySeedRows(residentsByContact, assistanceRows, renewalRows, now) {
  const registrationLogs = beneficiaries.slice(0, 8).map((beneficiary, index) => {
    const resident = residentsByContact.get(beneficiary.contact);
    return {
      actor_resident_id: resident.id,
      actor_name: coordinatorForSector(beneficiary.sector),
      actor_role: 'Staff',
      action: beneficiary.isOnline ? 'Approved account request' : 'Registered walk-in beneficiary',
      message: `${fullName(beneficiary)} added as ${beneficiary.sector}.`,
      entity_type: 'resident',
      entity_id: resident.id,
      reference_number: `${TEST_REFERENCE_PREFIX}-REG-${String(index + 1).padStart(2, '0')}`,
      link: '/admin/residents',
      audience_resident_id: resident.id,
      created_at: isoTimestamp(addDays(now, -index)),
    };
  });

  const assistanceLogs = assistanceRows.slice(0, 8).map((request, index) => ({
    actor_name: request.processed_by || 'System',
    actor_role: request.processed_by ? 'Staff' : 'System',
    action: `${request.status} assistance request`,
    message: `Reference: ${request.control_number} - ${request.beneficiary_name}`,
    entity_type: 'assistance_request',
    entity_id: request.id,
    reference_number: `${TEST_REFERENCE_PREFIX}-ASSIST-${String(index + 1).padStart(2, '0')}`,
    link: '/admin/assistance/requests',
    audience_resident_id: request.resident_id,
    created_at: isoTimestamp(addDays(now, -index - 2)),
  }));

  const renewalLogs = renewalRows.map((request, index) => {
    const beneficiary = beneficiaries.find((item) => residentsByContact.get(item.contact)?.id === request.resident_id);
    return {
      actor_name: request.processed_by || coordinatorForSector(beneficiary?.sector),
      actor_role: request.processed_by ? 'Staff' : 'System',
      action: `${request.status} ID renewal request`,
      message: `${fullName(beneficiary)} renewal scenario seeded.`,
      entity_type: 'beneficiary_id_renewal_request',
      entity_id: request.id,
      reference_number: `${TEST_REFERENCE_PREFIX}-RENEW-${String(index + 1).padStart(2, '0')}`,
      link: '/admin/renewal-requests',
      audience_resident_id: request.resident_id,
      created_at: isoTimestamp(addDays(now, -index - 4)),
    };
  });

  return [...registrationLogs, ...assistanceLogs, ...renewalLogs];
}

async function applySeedData({ dryRun = false } = {}) {
  console.log('Apply will reset and recreate the sample data set.');
  await undoSeedData({ dryRun });

  console.log('Seed data to create:');
  console.log('  Residents: 20');
  console.log('  Online registration samples: 10');
  console.log('  Walk-in registration samples: 10');
  console.log('  Beneficiary cards: 20');
  console.log('  Assistance requests: 14');
  console.log('  Renewal requests: 5');
  console.log('  Activity logs: 21');
  console.log('  Sector valid ID image uploads: 3');

  if (dryRun) {
    console.log('Dry run only. No rows will be inserted.');
    return;
  }

  const now = new Date();
  const validIdUrlBySector = await uploadSectorValidIds();
  for (const beneficiary of beneficiaries) {
    beneficiary.valid_id_url = validIdUrlBySector[beneficiary.sector];
    if (!beneficiary.valid_id_url) {
      throw new Error(`Missing uploaded valid ID URL for ${beneficiary.sector}.`);
    }
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const controlNumbers = await nextBeneficiaryControlNumbers(beneficiaries.length);
  const assistanceControlNumbers = await nextAssistanceControlNumbers(14);

  const accountRequestRows = beneficiaries
    .filter((row) => row.isOnline)
    .map((row) => ({
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      birthday: row.birthday,
      contact_number: row.contact,
      password_hash: passwordHash,
      house_no: row.house_no,
      purok: row.purok,
      street: row.street,
      barangay: row.barangay,
      city: row.city,
      is_pwd: row.is_pwd,
      is_senior_citizen: row.is_senior_citizen,
      is_solo_parent: row.is_solo_parent,
      valid_id_url: row.valid_id_url,
      valid_id_urls: [row.valid_id_url],
      age: row.age,
      birthplace: row.birthplace,
      sex: row.sex,
      citizenship: row.citizenship,
      civil_status: row.civil_status,
      status: 'Approved',
      notes: `${TEST_REFERENCE_PREFIX}: approved online registration sample.`,
      processed_by: coordinatorForSector(row.sector),
      processed_at: isoTimestamp(addDays(now, -6)),
      created_at: isoTimestamp(addDays(now, -14 + row.index)),
    }));

  const insertedAccountRequests = await insertRowsWithRetry(
    'account_requests',
    accountRequestRows,
    'id, contact_number',
    'Insert online account requests',
    { requiredColumns: ['first_name', 'last_name', 'contact_number', 'status'] },
  );
  const accountRequestByContact = new Map((insertedAccountRequests || []).map((row) => [row.contact_number, row.id]));

  const residentRows = beneficiaries.map((row, index) => {
    const scenario = cardScenario(row, now);
    return {
      control_number: controlNumbers[index],
      last_name: row.last_name,
      first_name: row.first_name,
      middle_name: row.middle_name,
      contact_number: row.contact,
      house_no: row.house_no,
      purok: row.purok,
      street: row.street,
      barangay: row.barangay,
      city: row.city,
      birthday: row.birthday,
      birthplace: row.birthplace,
      age: row.age,
      sex: row.sex,
      citizenship: row.citizenship,
      civil_status: row.civil_status,
      valid_id_url: row.valid_id_url,
      is_pwd: row.is_pwd,
      is_senior_citizen: row.is_senior_citizen,
      is_solo_parent: row.is_solo_parent,
      representative_name: null,
      representative_contact: null,
      account_request_id: accountRequestByContact.get(row.contact) || null,
      status: scenario.residentStatus,
      password_hash: passwordHash,
      created_at: isoTimestamp(addDays(now, -30 + index)),
    };
  });

  const insertedResidents = await insertRowsWithRetry(
    'residents',
    residentRows,
    'id, control_number, contact_number, first_name, last_name',
    'Insert residents',
    { requiredColumns: ['control_number', 'first_name', 'last_name', 'contact_number'] },
  );
  const residentsByContact = new Map((insertedResidents || []).map((row) => [row.contact_number, row]));

  const cardRows = beneficiaries.map((row) => {
    const resident = residentsByContact.get(row.contact);
    const scenario = cardScenario(row, now);
    return {
      resident_id: resident.id,
      issued_at: isoTimestamp(scenario.issuedAt),
      expires_at: isoTimestamp(scenario.expiresAt),
      revoked_at: null,
      status: scenario.cardStatus,
      created_at: isoTimestamp(scenario.issuedAt),
    };
  });

  const insertedCards = await insertRowsWithRetry(
    'beneficiary_cards',
    cardRows,
    'id, resident_id, issued_at, expires_at, status',
    'Insert beneficiary cards',
    { requiredColumns: ['resident_id', 'expires_at'] },
  );
  const cardsByResidentId = new Map((insertedCards || []).map((row) => [row.resident_id, row]));

  const assistanceRows = assistanceSeedRows(residentsByContact, assistanceControlNumbers, now);
  const insertedAssistance = await insertRowsWithRetry(
    'assistance_requests',
    assistanceRows,
    'id, control_number, resident_id, status, beneficiary_name',
    'Insert assistance requests',
    { requiredColumns: ['control_number', 'resident_id', 'beneficiary_name', 'assistance_type', 'status'] },
  );

  const renewalRows = renewalSeedRows(residentsByContact, cardsByResidentId, now);
  const insertedRenewals = await insertRowsWithRetry(
    'beneficiary_id_renewal_requests',
    renewalRows,
    'id, resident_id, card_id, current_expires_at, status',
    'Insert renewal requests',
    { requiredColumns: ['resident_id', 'updated_valid_id_url', 'status'] },
  );

  const assistanceForLogs = insertedAssistance.map((row, index) => ({ ...assistanceRows[index], ...row }));
  const renewalsForLogs = insertedRenewals.map((row, index) => ({ ...renewalRows[index], ...row }));
  const activityRows = activitySeedRows(residentsByContact, assistanceForLogs, renewalsForLogs, now);
  try {
    await insertRowsWithRetry('activity_logs', activityRows, 'id', 'Insert activity logs', {
      requiredColumns: ['actor_name', 'actor_role', 'action'],
    });
  } catch (error) {
    if (isMissingTable(error, 'activity_logs') || String(error?.message || '').includes('table activity_logs is not available')) {
      console.warn('Activity logs were skipped because activity_logs is not available in this Supabase schema.');
    } else {
      throw error;
    }
  }

  console.log('Seed data applied successfully.');
  console.log(`  Test beneficiary password: ${TEST_PASSWORD}`);
  console.log(`  Contacts: ${TEST_CONTACTS[0]} through ${TEST_CONTACTS.at(-1)}`);
}

try {
  if (mode === 'undo') {
    await undoSeedData();
  } else if (mode === 'dry-run') {
    await applySeedData({ dryRun: true });
  } else {
    await applySeedData();
  }
} catch (error) {
  console.error('Seed failed:', error?.message || error);
  process.exit(1);
}
