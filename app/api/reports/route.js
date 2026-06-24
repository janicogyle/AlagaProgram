import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { getAllowedSectorKeys, isAdminProfile, rowMatchesSectorAccess } from '@/lib/sectorAccess';
import { buildEligibilityMaps, getResidentEligibility } from '@/lib/residentEligibility';

export const runtime = 'nodejs';

const ASSISTANCE_TYPES = ['Medicine Assistance', 'Confinement Assistance', 'Burial Assistance'];
const SECTOR_REPORT_TYPES = ['pwd', 'senior', 'soloparent', 'all'];
const TABLE_REPORT_TYPES = [
  'expiring_ids',
  'eligible_beneficiaries',
  'not_yet_eligible',
  'pending_requests',
  'online_registration',
  'walkin_registration',
  'renewal_summary',
  'coordinator_performance',
];
const VALID_REPORT_TYPES = [...SECTOR_REPORT_TYPES, ...TABLE_REPORT_TYPES];

export async function GET(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const year = normalizeYear(searchParams.get('year'));
    const rangeDays = normalizeRangeDays(searchParams.get('rangeDays'));
    const counts = {};

    await Promise.all(
      VALID_REPORT_TYPES.map(async (type) => {
        try {
          if (type === 'all' && !isAdminProfile(auth.profile)) {
            counts[type] = 0;
            return;
          }
          if (type === 'coordinator_performance' && !isAdminProfile(auth.profile)) {
            counts[type] = 0;
            return;
          }

          const result = SECTOR_REPORT_TYPES.includes(type)
            ? await getSectorAssistanceRows({ db, reportType: type, year, profile: auth.profile })
            : await buildTableReport({ db, reportType: type, year, rangeDays, profile: auth.profile, countOnly: true });
          counts[type] = Array.isArray(result?.rows) ? result.rows.length : 0;
        } catch (error) {
          console.warn(`Report count failed for ${type}:`, error?.message || error);
          counts[type] = 0;
        }
      }),
    );

    return NextResponse.json({ data: { counts, year, rangeDays }, error: null });
  } catch (error) {
    console.error('Fetch report counts error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch report counts.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const { reportType, format, year } = body;

    if (!reportType || !format) {
      return NextResponse.json(
        { data: null, error: 'Report type and format are required.' },
        { status: 400 },
      );
    }

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return NextResponse.json(
        {
          data: null,
          error: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}.`,
        },
        { status: 400 },
      );
    }

    const validFormats = ['pdf', 'xlsx'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { data: null, error: `Invalid format. Must be one of: ${validFormats.join(', ')}.` },
        { status: 400 },
      );
    }

    if (!isAdminProfile(auth.profile)) {
      if (reportType === 'all' || reportType === 'coordinator_performance') {
        return NextResponse.json({ data: null, error: 'All-sector reports are Admin-only.' }, { status: 403 });
      }
      const reportSector = sectorReportAccessKey(reportType);
      if (reportSector && !getAllowedSectorKeys(auth.profile).includes(reportSector)) {
        return NextResponse.json({ data: null, error: 'Report is outside your assigned sector access.' }, { status: 403 });
      }
    }

    if (SECTOR_REPORT_TYPES.includes(reportType)) {
      return handleSectorAssistanceSummary({ db, reportType, format, year, profile: auth.profile });
    }

    return handleTableReport({ db, reportType, format, year, rangeDays: body?.rangeDays, profile: auth.profile });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to generate report.' },
      { status: 500 },
    );
  }
}

async function handleSectorAssistanceSummary({ db, reportType, format, year, profile }) {
  const reportYear = normalizeYear(year);

  const sector = sectorConfig(reportType);
  const { rows } = await getSectorAssistanceRows({ db, reportType, year: reportYear, profile });

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const dateStr = new Date().toISOString().split('T')[0];
  const filenamePrefix = `${reportType}_summary_${reportYear}_${dateStr}`;

  if (format === 'xlsx') {
    const buffer = await generateCashAssistanceXLSX({
      rows,
      reportYear,
      total,
      sectorLabel: sector?.label || null,
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenamePrefix}.xlsx"`,
      },
    });
  }


  return NextResponse.json({
    data: { rows, reportYear, total, sectorLabel: sector?.label || null },
    error: null,
    message: `${rows.length} records found.`,
  });
}

function sectorConfig(reportType) {
  switch (reportType) {
    case 'pwd':
      return { label: 'PWD', filterColumn: 'is_pwd', joinInner: true };
    case 'senior':
      return { label: 'SENIOR CITIZENS', filterColumn: 'is_senior_citizen', joinInner: true };
    case 'soloparent':
      return { label: 'SOLO PARENTS', filterColumn: 'is_solo_parent', joinInner: true };
    case 'all':
    default:
      return { label: 'ALL SECTORS', filterColumn: null, joinInner: false };
  }
}

function sectorReportAccessKey(reportType) {
  if (reportType === 'senior') return 'senior_citizen';
  if (reportType === 'soloparent') return 'solo_parent';
  if (reportType === 'pwd') return 'pwd';
  return null;
}

function normalizeYear(value) {
  const y = Number(value);
  const current = new Date().getFullYear();
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return current;
  return Math.trunc(y);
}

function normalizeRangeDays(value) {
  return Number(value) === 7 ? 7 : 30;
}

function yearWindow(year) {
  const reportYear = normalizeYear(year);
  return {
    reportYear,
    start: `${reportYear}-01-01`,
    end: `${reportYear + 1}-01-01`,
  };
}

function todayWindow(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + normalizeRangeDays(days) + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function formatLongDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function toDisplayName(value) {
  const s = String(value || '').trim();
  return s ? s.toUpperCase() : '';
}

function residentName(resident) {
  return [resident?.first_name, resident?.middle_name, resident?.last_name]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

function sectorList(row) {
  return [
    row?.is_pwd ? 'PWD' : null,
    row?.is_senior_citizen ? 'Senior Citizen' : null,
    row?.is_solo_parent ? 'Solo Parent' : null,
  ].filter(Boolean).join(', ');
}

function dateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

async function getSectorAssistanceRows({ db, reportType, year, profile }) {
  const { start, end } = yearWindow(year);
  const sector = sectorConfig(reportType);
  const join = sector?.joinInner
    ? 'residents:resident_id!inner(first_name, middle_name, last_name, is_pwd, is_senior_citizen, is_solo_parent)'
    : 'residents:resident_id(first_name, middle_name, last_name, is_pwd, is_senior_citizen, is_solo_parent)';

  const runQuery = async (schemaMode) => {
    const fields =
      schemaMode === 'new'
        ? ['control_number', 'assistance_type', 'amount', 'status', 'request_date', 'beneficiary_name', join].join(',')
        : ['control_number', 'service_type', 'other_service', 'amount', 'status', 'date', 'beneficiary_name', join].join(',');

    let q = db.from('assistance_requests').select(fields).eq('status', 'Released');
    if (sector?.filterColumn) q = q.eq(`residents.${sector.filterColumn}`, true);
    return schemaMode === 'new'
      ? q.gte('request_date', start).lt('request_date', end).order('request_date', { ascending: true })
      : q.gte('date', start).lt('date', end).order('date', { ascending: true });
  };

  let res = await runQuery('new');
  if (res.error) {
    const msg = String(res.error.message || '').toLowerCase();
    if (
      (msg.includes('request_date') && msg.includes('does not exist')) ||
      (msg.includes('assistance_type') && msg.includes('does not exist'))
    ) {
      res = await runQuery('old');
    }
  }
  if (res.error) throw res.error;

  const rows = (Array.isArray(res.data) ? res.data : [])
    .filter((row) => rowMatchesSectorAccess(row, profile))
    .map((row) => {
      const resident = Array.isArray(row.residents) ? row.residents[0] : row.residents || {};
      const rawDate = row.request_date || row.date || null;
      const rawTime = rawDate ? new Date(rawDate).getTime() : NaN;
      const amount = Number(row.amount || 0);
      return {
        rawTime: Number.isFinite(rawTime) ? rawTime : 0,
        dateRelease: formatLongDate(rawDate),
        name: toDisplayName(row.beneficiary_name || residentName(resident)),
        controlNumber: String(row.control_number || '').trim(),
        typeOfService: String(row.assistance_type || row.service_type || row.other_service || '').trim(),
        amount: Number.isFinite(amount) ? amount : 0,
      };
    })
    .sort((a, b) => (a.rawTime !== b.rawTime ? a.rawTime - b.rawTime : a.controlNumber.localeCompare(b.controlNumber)))
    .map((row, idx) => {
      const { rawTime, ...rest } = row;
      return { ...rest, no: idx + 1 };
    });

  return { rows };
}

async function handleTableReport({ db, reportType, format, year, rangeDays, profile }) {
  const reportYear = normalizeYear(year);
  const normalizedRangeDays = normalizeRangeDays(rangeDays);
  const table = await buildTableReport({ db, reportType, year: reportYear, rangeDays: normalizedRangeDays, profile });
  const filenamePrefix = `${reportType}_${reportYear}_${new Date().toISOString().split('T')[0]}`;

  if (format === 'xlsx') {
    const buffer = await generateTableXLSX(table);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenamePrefix}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    data: { table, reportYear, rangeDays: normalizedRangeDays },
    error: null,
    message: `${table.rows.length} records found.`,
  });
}

async function buildTableReport({ db, reportType, year, rangeDays, profile, countOnly = false }) {
  switch (reportType) {
    case 'expiring_ids':
      return buildExpiringIdsReport({ db, rangeDays, profile, countOnly });
    case 'eligible_beneficiaries':
      return buildEligibleBeneficiariesReport({ db, profile, countOnly });
    case 'not_yet_eligible':
      return buildNotYetEligibleReport({ db, profile, countOnly });
    case 'pending_requests':
      return buildPendingRequestsReport({ db, profile, countOnly });
    case 'online_registration':
      return buildRegistrationReport({ db, year, profile, online: true, countOnly });
    case 'walkin_registration':
      return buildRegistrationReport({ db, year, profile, online: false, countOnly });
    case 'renewal_summary':
      return buildRenewalSummaryReport({ db, year, profile, countOnly });
    case 'coordinator_performance':
      return buildCoordinatorPerformanceReport({ db, year });
    default:
      return { title: 'Report', columns: [], rows: [] };
  }
}

async function buildExpiringIdsReport({ db, rangeDays, profile, countOnly }) {
  const days = normalizeRangeDays(rangeDays);
  const { startIso, endIso } = todayWindow(days);
  const { data, error } = await db
    .from('beneficiary_cards')
    .select('id, issued_at, expires_at, status, revoked_at, residents:resident_id(control_number, first_name, middle_name, last_name, is_pwd, is_senior_citizen, is_solo_parent)')
    .is('revoked_at', null)
    .gte('expires_at', startIso)
    .lt('expires_at', endIso)
    .order('expires_at', { ascending: true });
  if (error) throw error;

  const matches = (data || []).filter((row) => rowMatchesSectorAccess(row, profile));
  if (countOnly) return { rows: matches };

  return {
    title: `Expiring IDs (${days} Days)`,
    columns: ['No.', 'Control Number', 'Name', 'Sectors', 'Issued At', 'Expires At', 'Status'],
    rows: matches.map((row, idx) => {
      const resident = Array.isArray(row.residents) ? row.residents[0] : row.residents || {};
      return [idx + 1, resident.control_number || '', residentName(resident), sectorList(resident), dateOnly(row.issued_at), dateOnly(row.expires_at), row.status || ''];
    }),
  };
}

async function buildEligibleBeneficiariesReport({ db, profile, countOnly }) {
  const { data: residents, error: residentsError } = await db
    .from('residents')
    .select('id, control_number, first_name, middle_name, last_name, contact_number, status, is_pwd, is_senior_citizen, is_solo_parent')
    .eq('status', 'Active')
    .order('last_name', { ascending: true });
  if (residentsError) throw residentsError;

  const allowedResidents = (residents || []).filter((row) => rowMatchesSectorAccess(row, profile));
  const residentIds = allowedResidents.map((row) => row.id).filter(Boolean);
  if (!residentIds.length) return { title: 'Eligible Beneficiaries', columns: [], rows: [] };

  const { data: requests, error: requestsError } = await db
    .from('assistance_requests')
    .select('resident_id, assistance_type, status, request_date, created_at')
    .in('resident_id', residentIds)
    .in('status', ['Pending', 'Resubmitted', 'Approved', 'Released']);
  if (requestsError) throw requestsError;

  const maps = buildEligibilityMaps(requests || []);
  const matches = allowedResidents
    .map((resident) => ({
      resident,
      eligibleTypes: ASSISTANCE_TYPES.filter((type) => getResidentEligibility(resident.id, maps, type).canCreateRequest),
    }))
    .filter((entry) => entry.eligibleTypes.length > 0);
  if (countOnly) return { rows: matches };

  return {
    title: 'Eligible Beneficiaries',
    columns: ['No.', 'Control Number', 'Name', 'Sectors', 'Contact Number', 'Eligible Categories'],
    rows: matches.map((entry, idx) => [
      idx + 1,
      entry.resident.control_number || '',
      residentName(entry.resident),
      sectorList(entry.resident),
      entry.resident.contact_number || '',
      entry.eligibleTypes.join(', '),
    ]),
  };
}

async function buildNotYetEligibleReport({ db, profile, countOnly }) {
  const { data: residents, error: residentsError } = await db
    .from('residents')
    .select('id, control_number, first_name, middle_name, last_name, contact_number, status, is_pwd, is_senior_citizen, is_solo_parent')
    .eq('status', 'Active')
    .order('last_name', { ascending: true });
  if (residentsError) throw residentsError;

  const allowedResidents = (residents || []).filter((row) => rowMatchesSectorAccess(row, profile));
  const residentIds = allowedResidents.map((row) => row.id).filter(Boolean);
  if (!residentIds.length) return { title: 'Not Yet Eligible', columns: [], rows: [] };

  const { data: requests, error: requestsError } = await db
    .from('assistance_requests')
    .select('id, control_number, resident_id, assistance_type, status, request_date, created_at')
    .in('resident_id', residentIds)
    .in('status', ['Pending', 'Resubmitted', 'Approved', 'Released']);
  if (requestsError) throw requestsError;

  const maps = buildEligibilityMaps(requests || []);
  const matches = allowedResidents
    .map((resident) => {
      const blocked = ASSISTANCE_TYPES.map((type) => {
        const eligibility = getResidentEligibility(resident.id, maps, type);
        if (eligibility.canCreateRequest) return null;
        const reason = eligibility.blockReason === 'active' ? 'active' : 'cooldown';
        return {
          type,
          reason,
          nextEligibleDate: eligibility.cooldownInfo?.nextEligibleDate || '',
          lastRequestDate: eligibility.cooldownInfo?.lastRequestDate || '',
        };
      }).filter(Boolean);

      return { resident, blocked };
    })
    .filter((entry) => entry.blocked.length > 0);
  if (countOnly) return { rows: matches };

  return {
    title: 'Not Yet Eligible Beneficiaries',
    columns: ['No.', 'Control Number', 'Name', 'Sectors', 'Contact Number', 'Blocked Categories', 'Reason', 'Next Eligible Date'],
    rows: matches.map((entry, idx) => [
      idx + 1,
      entry.resident.control_number || '',
      residentName(entry.resident),
      sectorList(entry.resident),
      entry.resident.contact_number || '',
      entry.blocked.map((item) => item.type).join(', '),
      Array.from(new Set(entry.blocked.map((item) => item.reason))).join(', '),
      entry.blocked.map((item) => item.nextEligibleDate).filter(Boolean).join(', '),
    ]),
  };
}

async function buildPendingRequestsReport({ db, profile, countOnly }) {
  const { data, error } = await db
    .from('assistance_requests')
    .select('id, control_number, assistance_type, status, request_date, processed_by, beneficiary_name, residents:resident_id(control_number, first_name, middle_name, last_name, is_pwd, is_senior_citizen, is_solo_parent)')
    .in('status', ['Pending', 'Resubmitted', 'Approved'])
    .order('request_date', { ascending: true });
  if (error) throw error;

  const matches = (data || []).filter((row) => rowMatchesSectorAccess(row, profile));
  if (countOnly) return { rows: matches };

  return {
    title: 'Pending Assistance Requests',
    columns: ['No.', 'Request Control No.', 'Beneficiary Control No.', 'Beneficiary Name', 'Sectors', 'Assistance Type', 'Status', 'Request Date', 'Processed By'],
    rows: matches.map((row, idx) => {
      const resident = Array.isArray(row.residents) ? row.residents[0] : row.residents || {};
      return [
        idx + 1,
        row.control_number || '',
        resident.control_number || '',
        row.beneficiary_name || residentName(resident),
        sectorList(resident),
        row.assistance_type || '',
        row.status || '',
        dateOnly(row.request_date),
        row.processed_by || '',
      ];
    }),
  };
}

async function buildRegistrationReport({ db, year, profile, online, countOnly }) {
  const { reportYear, start, end } = yearWindow(year);
  let query = db
    .from('residents')
    .select('id, control_number, first_name, middle_name, last_name, contact_number, status, created_at, is_pwd, is_senior_citizen, is_solo_parent, account_request_id')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });
  query = online ? query.not('account_request_id', 'is', null) : query.is('account_request_id', null);

  const { data, error } = await query;
  if (error) throw error;
  const matches = (data || []).filter((row) => rowMatchesSectorAccess(row, profile));
  if (countOnly) return { rows: matches };

  return {
    title: `${online ? 'Online' : 'Walk-In'} Registration ${reportYear}`,
    columns: ['No.', 'Control Number', 'Name', 'Sectors', 'Contact Number', 'Status', 'Registration Date'],
    rows: matches.map((row, idx) => [idx + 1, row.control_number || '', residentName(row), sectorList(row), row.contact_number || '', row.status || '', dateOnly(row.created_at)]),
  };
}

async function buildRenewalSummaryReport({ db, year, profile, countOnly }) {
  const { reportYear, start, end } = yearWindow(year);
  const { data, error } = await db
    .from('beneficiary_id_renewal_requests')
    .select('id, current_expires_at, remarks, status, admin_remarks, processed_by, processed_at, created_at, residents:resident_id(control_number, first_name, middle_name, last_name, is_pwd, is_senior_citizen, is_solo_parent)')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const matches = (data || []).filter((row) => rowMatchesSectorAccess(row, profile));
  if (countOnly) return { rows: matches };

  return {
    title: `Renewal Requests Summary ${reportYear}`,
    columns: ['No.', 'Control Number', 'Name', 'Sectors', 'Current Expiry', 'Requested At', 'Status', 'Processed By', 'Processed At', 'Remarks'],
    rows: matches.map((row, idx) => {
      const resident = Array.isArray(row.residents) ? row.residents[0] : row.residents || {};
      return [idx + 1, resident.control_number || '', residentName(resident), sectorList(resident), dateOnly(row.current_expires_at), dateOnly(row.created_at), row.status || '', row.processed_by || '', dateOnly(row.processed_at), row.admin_remarks || row.remarks || ''];
    }),
  };
}

async function buildCoordinatorPerformanceReport({ db, year }) {
  const { reportYear, start, end } = yearWindow(year);
  const byName = new Map();
  const ensure = (name) => {
    const key = String(name || 'Unassigned').trim() || 'Unassigned';
    if (!byName.has(key)) {
      byName.set(key, { name: key, assistanceApproved: 0, assistanceReleased: 0, assistanceIncomplete: 0, accountApproved: 0, accountIncomplete: 0, renewalApproved: 0, renewalIncomplete: 0, total: 0 });
    }
    return byName.get(key);
  };

  const [assistance, accounts, renewals] = await Promise.all([
    db.from('assistance_requests').select('processed_by, status, updated_at').not('processed_by', 'is', null).gte('updated_at', start).lt('updated_at', end),
    db.from('account_requests').select('processed_by, status, processed_at').not('processed_by', 'is', null).gte('processed_at', start).lt('processed_at', end),
    db.from('beneficiary_id_renewal_requests').select('processed_by, status, processed_at').not('processed_by', 'is', null).gte('processed_at', start).lt('processed_at', end),
  ]);
  if (assistance.error) throw assistance.error;
  if (accounts.error) throw accounts.error;
  if (renewals.error) throw renewals.error;

  (assistance.data || []).forEach((row) => {
    const entry = ensure(row.processed_by);
    if (row.status === 'Approved') entry.assistanceApproved += 1;
    else if (row.status === 'Released') entry.assistanceReleased += 1;
    else if (row.status === 'Rejected') entry.assistanceIncomplete += 1;
    entry.total += 1;
  });
  (accounts.data || []).forEach((row) => {
    const entry = ensure(row.processed_by);
    if (row.status === 'Approved') entry.accountApproved += 1;
    else if (['Incomplete', 'Rejected'].includes(row.status)) entry.accountIncomplete += 1;
    entry.total += 1;
  });
  (renewals.data || []).forEach((row) => {
    const entry = ensure(row.processed_by);
    if (row.status === 'Approved') entry.renewalApproved += 1;
    else if (row.status === 'Incomplete') entry.renewalIncomplete += 1;
    entry.total += 1;
  });

  const matches = Array.from(byName.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return {
    title: `Coordinator Performance Report ${reportYear}`,
    columns: ['No.', 'Coordinator', 'Assistance Approved', 'Assistance Released', 'Assistance Incomplete', 'Accounts Approved', 'Accounts Incomplete', 'Renewals Approved', 'Renewals Incomplete', 'Total'],
    rows: matches.map((row, idx) => [idx + 1, row.name, row.assistanceApproved, row.assistanceReleased, row.assistanceIncomplete, row.accountApproved, row.accountIncomplete, row.renewalApproved, row.renewalIncomplete, row.total]),
  };
}

async function generateTableXLSX({ title, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  const safeColumns = columns || [];
  const safeRows = rows || [];

  sheet.mergeCells(1, 1, 1, Math.max(1, safeColumns.length));
  sheet.getCell(1, 1).value = String(title || 'Report').toUpperCase();
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.addRow([]);

  const headerRow = sheet.addRow(safeColumns);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  safeRows.forEach((values) => {
    const row = sheet.addRow(values);
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  safeColumns.forEach((column, idx) => {
    const columnIndex = idx + 1;
    const maxLength = Math.max(String(column).length, ...safeRows.map((row) => String(row?.[idx] || '').length));
    sheet.getColumn(columnIndex).width = Math.max(10, Math.min(34, maxLength + 3));
  });

  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  workbook.creator = 'ALAGA Program';
  workbook.created = new Date();
  return workbook.xlsx.writeBuffer();
}



async function generateCashAssistanceXLSX({ rows, reportYear, total, sectorLabel }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Summary');

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'dateRelease', width: 18 },
    { key: 'name', width: 28 },
    { key: 'controlNumber', width: 18 },
    { key: 'typeOfService', width: 22 },
    { key: 'amount', width: 12 },
  ];

  const logoSize = 72;
  const logoAnchor = { col: 3.00, row: 0.1 };
  const logoRowStart = 1;
  const logoRowEnd = 3;
  const titleRowIndex = 4;
  const subtitleRowIndex = 5;
  const sectorRowIndex = 6;
  const spacerRowIndex = 7;

  sheet.getRow(1).height = 18;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 18;
  sheet.getRow(spacerRowIndex).height = 14;

  // Try to add logo from public/Brand.png (server-side). Keep it square so the seal stays circular.
  try {
    const logoPath = path.join(process.cwd(), 'public', 'Brand.png');
    if (fs.existsSync(logoPath)) {
      const imgBuffer = fs.readFileSync(logoPath);
      const imageId = workbook.addImage({ buffer: imgBuffer, extension: 'png' });
      sheet.addImage(imageId, {
        tl: logoAnchor,
        ext: { width: logoSize, height: logoSize },
      });
    }
  } catch (e) {
    console.warn('Could not add logo to XLSX:', e?.message || e);
  }

  sheet.mergeCells(`A${logoRowStart}:F${logoRowEnd}`);
  sheet.getCell(`A${logoRowStart}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`A${titleRowIndex}:F${titleRowIndex}`);
  sheet.getCell(`A${titleRowIndex}`).value = `SUMMARY OF ALAGA PROGRAM ${reportYear}`;
  sheet.getCell(`A${titleRowIndex}`).font = { bold: true, size: 14 };
  sheet.getCell(`A${titleRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`A${subtitleRowIndex}:F${subtitleRowIndex}`);
  sheet.getCell(`A${subtitleRowIndex}`).value = 'CASH ASSISTANCE / DONATIONS';
  sheet.getCell(`A${subtitleRowIndex}`).font = { bold: true, size: 12 };
  sheet.getCell(`A${subtitleRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

  const freezeSplit = 8;

  if (sectorLabel) {
    sheet.mergeCells(`A${sectorRowIndex}:F${sectorRowIndex}`);
    sheet.getCell(`A${sectorRowIndex}`).value = String(sectorLabel).toUpperCase();
    sheet.getCell(`A${sectorRowIndex}`).font = { bold: true, size: 10 };
    sheet.getCell(`A${sectorRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'NO.',
    'DATE RELEASE',
    'NAME',
    'CA CONTROL FORM NO.',
    'TYPE OF SERVICES',
    'AMOUNT',
  ]);

  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  for (const r of rows) {
    const row = sheet.addRow([
      r.no,
      r.dateRelease,
      r.name,
      r.controlNumber,
      r.typeOfService,
      Number(r.amount) || 0,
    ]);

    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right' };

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (colNumber !== 6) {
        cell.alignment = cell.alignment || {};
        cell.alignment.vertical = 'middle';
      }
    });
  }

  const totalRowIndex = sheet.lastRow.number + 1;
  const totalRow = sheet.addRow(['TOTAL', '', '', '', '', total]);
  sheet.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
  sheet.getCell(`A${totalRowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getCell(`A${totalRowIndex}`).font = { bold: true };
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0.00';
  totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  sheet.views = [{ state: 'frozen', ySplit: freezeSplit }];

  workbook.creator = 'ALAGA Program';
  workbook.created = new Date();

  return workbook.xlsx.writeBuffer();
}
