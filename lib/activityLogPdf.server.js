const MANILA_DATE_TIME = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function printable(value, fallback = '-') {
  const normalized = String(value ?? '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return MANILA_DATE_TIME.format(date);
}

function recordLabel(row) {
  const type = printable(row?.entity_type, 'Record').replace(/_/g, ' ');
  const reference = printable(row?.reference_number, '');
  return reference ? `${type}: ${reference}` : type;
}

export async function createActivityLogReportPdf({ rows, viewer, filters, total }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default ?? autoTableModule;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = formatTimestamp(new Date());
  const scopeLabel = viewer?.kind === 'admin'
    ? 'All administrator, coordinator, and beneficiary activities'
    : viewer?.kind === 'staff'
      ? `Own activity only - ${printable(viewer?.name)} (${printable(viewer?.role)})`
      : `Beneficiary activity history - ${printable(viewer?.name)}`;

  const activeFilters = [
    filters?.user && `User: ${printable(filters.user)}`,
    filters?.role && `Role: ${printable(filters.role)}`,
    filters?.action && `Action: ${printable(filters.action)}`,
    filters?.dateFromLabel && `From: ${printable(filters.dateFromLabel)}`,
    filters?.dateToLabel && `To: ${printable(filters.dateToLabel)}`,
    filters?.search && `Search: ${printable(filters.search)}`,
  ].filter(Boolean).join(' | ') || 'No filters applied';

  const body = (rows || []).map((row) => [
    formatTimestamp(row.created_at),
    printable(row.actor_name),
    printable(row.actor_role),
    printable(row.action),
    printable(row.message),
    recordLabel(row),
  ]);

  if (!body.length) {
    body.push(['-', '-', '-', 'No activity logs found', 'No records matched the selected filters.', '-']);
  }

  autoTable(doc, {
    startY: 102,
    head: [['Exact Date / Time', 'User', 'Role', 'Action', 'Description', 'Affected Record']],
    body,
    theme: 'grid',
    margin: { top: 102, right: 28, bottom: 36, left: 28 },
    styles: {
      font: 'helvetica',
      fontSize: 7.3,
      cellPadding: 4,
      valign: 'top',
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.35,
    },
    headStyles: {
      fillColor: [20, 78, 180],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    rowPageBreak: 'avoid',
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 },
      2: { cellWidth: 88 },
      3: { cellWidth: 120 },
      4: { cellWidth: 245 },
      5: { cellWidth: 142.8 },
    },
    willDrawPage: () => {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('BARANGAY STA. RITA - ALAGA PROGRAM', 28, 30);
      doc.setFontSize(12);
      doc.text('ACTIVITY LOG REPORT', 28, 48);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.text(scopeLabel, 28, 64, { maxWidth: pageWidth - 56 });
      doc.text(activeFilters, 28, 78, { maxWidth: pageWidth - 220 });
      doc.text(`Generated: ${generatedAt}`, pageWidth - 28, 64, { align: 'right' });
      doc.text(`Matching records: ${Number(total || 0)}`, pageWidth - 28, 78, { align: 'right' });

      doc.setDrawColor(191, 219, 254);
      doc.line(28, 88, pageWidth - 28, 88);
    },
    didDrawPage: ({ pageNumber }) => {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text('Read-only audit record - Asia/Manila time', 28, pageHeight - 16);
      doc.text(`Page ${pageNumber}`, pageWidth - 28, pageHeight - 16, { align: 'right' });
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}
