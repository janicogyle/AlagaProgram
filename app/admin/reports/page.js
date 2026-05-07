'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';

const defaultReportTypes = [
  {
    id: 'pwd',
    title: 'PWD',
    description: 'Summary of released assistance for Persons with Disability',
    count: 0,
    color: '#1e40af',
    bgColor: '#dbeafe',
  },
  {
    id: 'senior',
    title: 'Senior Citizens',
    description: 'Summary of released assistance for Senior Citizens',
    count: 0,
    color: '#16a34a',
    bgColor: '#dcfce7',
  },
  {
    id: 'soloparent',
    title: 'Solo Parents',
    description: 'Summary of released assistance for Solo Parents',
    count: 0,
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  {
    id: 'all',
    title: 'All Sectors',
    description: 'Summary of all released assistance',
    count: 0,
    color: '#7c3aed',
    bgColor: '#ede9fe',
  },
];

export default function ReportsPage() {
  const [reportTypes, setReportTypes] = useState(defaultReportTypes);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const getReportBadge = (report) => {
    if (!report) return '';
    if (report.id === 'pwd') return 'PWD';
    if (report.id === 'senior') return 'SC';
    if (report.id === 'soloparent') return 'SP';
    if (report.id === 'all') return 'ALL';
    return String(report.title || '').slice(0, 3).toUpperCase();
  };

  // Fetch counts from Supabase
  useEffect(() => {
    const fetchCounts = async () => {
      if (!supabase) {
        console.error('Database client not available');
        return;
      }

      const start = `${reportYear}-01-01`;
      const end = `${reportYear + 1}-01-01`;

      const fetchCount = async ({ sectorColumn }) => {
        // Try new schema first (request_date)
        const baseSelect = sectorColumn
          ? 'id, residents:resident_id!inner(id)'
          : 'id';

        const base = supabase
          .from('assistance_requests')
          .select(baseSelect, { count: 'exact', head: true })
          .eq('status', 'Released');

        const applySector = (q) => (sectorColumn ? q.eq(`residents.${sectorColumn}`, true) : q);

        let q = applySector(base).gte('request_date', start).lt('request_date', end);
        let res = await q;

        if (res.error) {
          const msg = String(res.error.message || '').toLowerCase();
          const missingRequestDate = msg.includes('request_date') && msg.includes('does not exist');
          if (missingRequestDate) {
            res = await applySector(base).gte('date', start).lt('date', end);
          }
        }

        return res?.count || 0;
      };

      try {
        const [pwdCount, seniorCount, soloParentCount, allCount] = await Promise.all([
          fetchCount({ sectorColumn: 'is_pwd' }),
          fetchCount({ sectorColumn: 'is_senior_citizen' }),
          fetchCount({ sectorColumn: 'is_solo_parent' }),
          fetchCount({ sectorColumn: null }),
        ]);

        setReportTypes((prev) =>
          prev.map((report) => {
            switch (report.id) {
              case 'pwd':
                return { ...report, count: pwdCount };
              case 'senior':
                return { ...report, count: seniorCount };
              case 'soloparent':
                return { ...report, count: soloParentCount };
              case 'all':
                return { ...report, count: allCount };
              default:
                return report;
            }
          }),
        );

      } catch (err) {
        console.error('Failed to fetch report counts:', err);
      }
    };

    fetchCounts();
  }, [reportYear]);

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setSelectedFormat('pdf');
    setIsModalOpen(true);
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const toExportRows = (residents) => {
    const data = Array.isArray(residents) ? residents : [];

    return data.map((row) => ({
      'Control Number': row.control_number || '',
      'Last Name': row.last_name || '',
      'First Name': row.first_name || '',
      'Middle Name': row.middle_name || '',
      'Birthday': row.birthday || '',
      Age: row.age || '',
      Sex: row.sex || '',
      'Contact Number': row.contact_number || '',
      Address: `${row.house_no || ''} ${row.purok ? `Purok ${row.purok}` : ''}`.trim(),
      Barangay: row.barangay || '',
      City: row.city || '',
      PWD: row.is_pwd ? 'Yes' : 'No',
      'Senior Citizen': row.is_senior_citizen ? 'Yes' : 'No',
      'Solo Parent': row.is_solo_parent ? 'Yes' : 'No',
      Status: row.status || '',
    }));
  };

  const generateCashAssistancePdf = async ({ rows, reportYear: y, total, sectorLabel }) => {
    const { jsPDF } = await import('jspdf');
    const autoTableMod = await import('jspdf-autotable');
    const autoTable = autoTableMod.default ?? autoTableMod;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Try to fetch site logo from public folder and add to PDF (best-effort)
    try {
      const resp = await fetch('/Brand.png');
      if (resp.ok) {
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        // Place logo at top-left (smaller size to not interfere with text)
        doc.addImage(dataUrl, 'PNG', 20, 10, 50, 50);
      }
    } catch (e) {
      // ignore if logo can't be loaded
      console.warn('Could not add logo to PDF:', e?.message || e);
    }

    doc.setFontSize(14);
    doc.text(`SUMMARY OF ALAGA PROGRAM ${y}`, doc.internal.pageSize.getWidth() / 2, 40, {
      align: 'center',
    });
    doc.setFontSize(12);
    doc.text('CASH ASSISTANCE / DONATIONS', doc.internal.pageSize.getWidth() / 2, 58, {
      align: 'center',
    });

    if (sectorLabel) {
      doc.setFontSize(10);
      doc.text(String(sectorLabel).toUpperCase(), doc.internal.pageSize.getWidth() / 2, 72, {
        align: 'center',
      });
    }

    const head = [['NO.', 'DATE RELEASE', 'NAME', 'CA CONTROL FORM NO.', 'TYPE OF SERVICES', 'AMOUNT']];
    const body = (rows || []).map((r) => [
      r.no,
      r.dateRelease,
      r.name,
      r.controlNumber,
      r.typeOfService,
      (Number(r.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ]);

    body.push([
      { content: 'TOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'center' } },
      {
        content: (Number(total) || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const colWidths = [36, 120, 190, 120, 140, 80];
    const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
    const leftMargin = Math.max(40, (pageWidth - tableWidth) / 2);

    autoTable(doc, {
      startY: sectorLabel ? 88 : 80,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: [217, 217, 217], textColor: 20 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 36 },
        1: { halign: 'left', cellWidth: 120 },
        2: { halign: 'left', cellWidth: 190 },
        3: { halign: 'center', cellWidth: 120 },
        4: { halign: 'left', cellWidth: 140 },
        5: { halign: 'right', cellWidth: 80 },
      },
      margin: { left: leftMargin, right: leftMargin },
    });

    return doc;
  };

  const handleConfirmGenerate = async () => {
    if (!selectedReport || isGenerating) return;

    setIsGenerating(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = `${selectedReport.id}_report_${dateStr}`;

      const body = {
        reportType: selectedReport.id,
        format: selectedFormat,
        year: reportYear,
      };

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMessage = response.statusText || 'Failed to generate report.';
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const payload = await response.json();
            errorMessage = payload?.error || payload?.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch {
          // ignore parsing failures
        }
        throw new Error(errorMessage);
      }

      if (selectedFormat === 'csv') {
        const blob = await response.blob();
        downloadBlob(blob, `${baseName}.csv`);
        setStatus({ type: 'success', message: `CSV report "${selectedReport.title}" downloaded successfully!` });
      } else if (selectedFormat === 'xlsx') {
        const blob = await response.blob();
        const filename = `${selectedReport.id}_summary_${reportYear}_${dateStr}.xlsx`;
        downloadBlob(blob, filename);
        setStatus({ type: 'success', message: `Excel report "${selectedReport.title}" downloaded successfully!` });
      } else {
        const payload = await response.json();
        if (payload?.error) throw new Error(payload.error);

        if (selectedFormat === 'pdf') {
          const doc = await generateCashAssistancePdf({ ...(payload?.data || {}), sectorLabel: selectedReport.title });
          doc.save(`${selectedReport.id}_summary_${payload?.data?.reportYear || reportYear}_${dateStr}.pdf`);

          setStatus({ type: 'success', message: `PDF report "${selectedReport.title}" downloaded successfully!` });
        } else {
          throw new Error('Unsupported format selected.');
        }
      }

      setIsModalOpen(false);
      setSelectedReport(null);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to generate report: ' + error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
  };

  return (
    <div className={styles.reportsPage}>
      {status && (
        <div
          className={`${styles.statusBanner} ${
            status.type === 'success'
              ? styles.statusBannerSuccess
              : styles.statusBannerError
          }`}
          role="alert"
        >
          {status.message}
        </div>
      )}
      <Card title="Generate Reports" subtitle="Select a report type to generate and export reports (PDF/CSV/Excel)">
        <div className={styles.reportGrid}>
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className={styles.reportCard}
              onClick={() => handleReportClick(report)}
            >
              <div
                className={styles.reportIcon}
                style={{ background: report.bgColor, color: report.color }}
                aria-hidden="true"
              >
                {getReportBadge(report)}
              </div>
              <div className={styles.reportInfo}>
                <h3 className={styles.reportTitle}>{report.title}</h3>
                <p className={styles.reportDesc}>{report.description}</p>
              </div>
              <span className={styles.reportCount}>{report.count} records</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Generate Report"
        size="small"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={handleCloseModal} disabled={isGenerating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmGenerate} disabled={isGenerating}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isGenerating ? 'Generating…' : 'Generate Report'}
            </Button>
          </div>
        }
      >
        {selectedReport && (
          <div className={styles.confirmContent}>
            <h4 className={styles.confirmTitle}>{selectedReport.title}</h4>
            <p className={styles.confirmDesc}>
              Are you sure you want to generate this report? This will create a downloadable file with {selectedReport.count} records.
            </p>
            <div className={styles.confirmDetails}>
              <div className={styles.confirmDetail}>
                <span>Report Type:</span>
                <strong>{selectedReport.title}</strong>
              </div>
              <div className={styles.confirmDetail}>
                <span>Total Records:</span>
                <strong>{selectedReport.count}</strong>
              </div>
            </div>

            <div className={styles.confirmDetails}>
              <div className={styles.confirmDetail}>
                <span>Report Year:</span>
                <strong>
                  <input
                    type="number"
                    value={reportYear}
                    min={2000}
                    max={2100}
                    onChange={(e) => setReportYear(Number(e.target.value || new Date().getFullYear()))}
                    className={styles.yearInput}
                    inputMode="numeric"
                  />
                </strong>
              </div>
            </div>

            <div className={styles.formatSection}>
              <span className={styles.formatLabel}>Export Format:</span>
              <div className={styles.formatOptions}>
                <button
                  type="button"
                  className={`${styles.formatBtn} ${selectedFormat === 'pdf' ? styles.formatBtnActive : ''}`}
                  onClick={() => setSelectedFormat('pdf')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  PDF
                </button>

                <button
                  type="button"
                  className={`${styles.formatBtn} ${selectedFormat === 'xlsx' ? styles.formatBtnActive : ''}`}
                  onClick={() => setSelectedFormat('xlsx')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h8" />
                  </svg>
                  Excel
                </button>

                <button
                  type="button"
                  className={`${styles.formatBtn} ${selectedFormat === 'csv' ? styles.formatBtnActive : ''}`}
                  onClick={() => setSelectedFormat('csv')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h8" />
                  </svg>
                  CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
