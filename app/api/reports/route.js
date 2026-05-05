import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

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

    const validReportTypes = ['pwd', 'senior', 'soloparent', 'all'];
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        {
          data: null,
          error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}.`,
        },
        { status: 400 },
      );
    }

    const validFormats = ['csv', 'pdf', 'xlsx'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { data: null, error: `Invalid format. Must be one of: ${validFormats.join(', ')}.` },
        { status: 400 },
      );
    }

    // All sector reports use the Cash Assistance / Donations template.
    return handleSectorAssistanceSummary({ db, reportType, format, year });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to generate report.' },
      { status: 500 },
    );
  }
}

async function handleSectorAssistanceSummary({ db, reportType, format, year }) {
  const reportYear = normalizeYear(year);
  const start = `${reportYear}-01-01`;
  const end = `${reportYear + 1}-01-01`;

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

    if (sector?.filterColumn) {
      q = q.eq(`residents.${sector.filterColumn}`, true);
    }

    if (schemaMode === 'new') {
      q = q.gte('request_date', start).lt('request_date', end).order('request_date', { ascending: true });
    } else {
      q = q.gte('date', start).lt('date', end).order('date', { ascending: true });
    }

    return q;
  };

  // Try new schema first, then fall back to old schema.
  let res = await runQuery('new');
  if (res.error) {
    const msg = String(res.error.message || '').toLowerCase();
    const missingNewCols =
      (msg.includes('request_date') && msg.includes('does not exist')) ||
      (msg.includes('assistance_type') && msg.includes('does not exist'));

    if (missingNewCols) {
      res = await runQuery('old');
    }
  }

  if (res.error) throw res.error;

  const raw = Array.isArray(res.data) ? res.data : [];

  const rows = raw
    .map((r) => {
      const resident = r.residents || {};
      const rawDate = r.request_date || r.date || null;
      const rawTime = rawDate ? new Date(rawDate).getTime() : NaN;

      const name = toDisplayName(
        r.beneficiary_name ||
          [resident.first_name, resident.middle_name, resident.last_name]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(' '),
      );

      const type = String(r.assistance_type || r.service_type || r.other_service || '').trim();
      const amount = Number(r.amount || 0);

      return {
        rawTime: Number.isFinite(rawTime) ? rawTime : 0,
        dateRelease: formatLongDate(rawDate),
        name,
        controlNumber: String(r.control_number || '').trim(),
        typeOfService: type,
        amount: Number.isFinite(amount) ? amount : 0,
      };
    })
    .sort((a, b) => {
      if (a.rawTime !== b.rawTime) return a.rawTime - b.rawTime;
      return a.controlNumber.localeCompare(b.controlNumber);
    })
    .map((r, idx) => {
      const { rawTime, ...rest } = r;
      return { ...rest, no: idx + 1 };
    });

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

  if (format === 'csv') {
    const csv = generateCashAssistanceCSV(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filenamePrefix}.csv"`,
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

function normalizeYear(value) {
  const y = Number(value);
  const current = new Date().getFullYear();
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return current;
  return Math.trunc(y);
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

function generateResidentCSV(data) {
  const headers = [
    'Control Number',
    'Last Name',
    'First Name',
    'Middle Name',
    'Birthday',
    'Age',
    'Sex',
    'Contact Number',
    'Address',
    'Barangay',
    'City',
    'PWD',
    'Senior Citizen',
    'Solo Parent',
    'Status',
  ];

  const rows = data.map((row) => [
    row.control_number || '',
    row.last_name || '',
    row.first_name || '',
    row.middle_name || '',
    row.birthday || '',
    row.age || '',
    row.sex || '',
    row.contact_number || '',
    `${row.house_no || ''} ${row.street || ''}`.trim(),
    row.barangay || '',
    row.city || '',
    row.is_pwd ? 'Yes' : 'No',
    row.is_senior_citizen ? 'Yes' : 'No',
    row.is_solo_parent ? 'Yes' : 'No',
    row.status || '',
  ]);

  const csvRows = [
    headers.join(','),
    ...rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')),
  ];

  return csvRows.join('\n');
}

function generateCashAssistanceCSV(rows) {
  const headers = ['NO.', 'DATE RELEASE', 'NAME', 'CA CONTROL FORM NO.', 'TYPE OF SERVICES', 'AMOUNT'];
  const csvRows = [headers.join(',')];

  for (const r of rows) {
    const row = [
      r.no,
      r.dateRelease,
      r.name,
      r.controlNumber,
      r.typeOfService,
      (Number(r.amount) || 0).toFixed(2),
    ];
    csvRows.push(row.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(','));
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  csvRows.push(['TOTAL', '', '', '', '', total.toFixed(2)].map((f) => `"${String(f)}"`).join(','));

  return csvRows.join('\n');
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

  // Try to add logo from public/Brand.png (server-side)
  let logoAdded = false;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'Brand.png');
    if (fs.existsSync(logoPath)) {
      const imgBuffer = fs.readFileSync(logoPath);
      const imageId = workbook.addImage({ buffer: imgBuffer, extension: 'png' });
      // place at top-left (columns measure approx 8.43 per unit; using ext width/height in points)
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 60 },
      });
      logoAdded = true;
    }
  } catch (e) {
    console.warn('Could not add logo to XLSX:', e?.message || e);
  }

  const titleRowIndex = logoAdded ? 2 : 1;
  const subtitleRowIndex = logoAdded ? 3 : 2;
  const sectorRowIndex = logoAdded ? 4 : 3;

  sheet.mergeCells(`A${titleRowIndex}:F${titleRowIndex}`);
  sheet.getCell(`A${titleRowIndex}`).value = `SUMMARY OF ALAGA PROGRAM ${reportYear}`;
  sheet.getCell(`A${titleRowIndex}`).font = { bold: true, size: 14 };
  sheet.getCell(`A${titleRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`A${subtitleRowIndex}:F${subtitleRowIndex}`);
  sheet.getCell(`A${subtitleRowIndex}`).value = 'CASH ASSISTANCE / DONATIONS';
  sheet.getCell(`A${subtitleRowIndex}`).font = { bold: true, size: 12 };
  sheet.getCell(`A${subtitleRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

  let freezeSplit = logoAdded ? 5 : 4;

  if (sectorLabel) {
    sheet.mergeCells(`A${sectorRowIndex}:F${sectorRowIndex}`);
    sheet.getCell(`A${sectorRowIndex}`).value = String(sectorLabel).toUpperCase();
    sheet.getCell(`A${sectorRowIndex}`).font = { bold: true, size: 10 };
    sheet.getCell(`A${sectorRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };
    freezeSplit = logoAdded ? 6 : 5;
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
