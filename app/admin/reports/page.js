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
    title: 'PWD List',
    description: 'Generate list of all Persons with Disability',
    count: 0,
    color: '#1e40af',
    bgColor: '#dbeafe',
  },
  {
    id: 'senior',
    title: 'Senior Citizens List',
    description: 'Generate list of all Senior Citizens',
    count: 0,
    color: '#16a34a',
    bgColor: '#dcfce7',
  },
  {
    id: 'soloparent',
    title: 'Solo Parent List',
    description: 'Generate list of all Solo Parents',
    count: 0,
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  {
    id: 'all',
    title: 'All Residents',
    description: 'Generate complete list of all registered residents',
    count: 0,
    color: '#7c3aed',
    bgColor: '#ede9fe',
  },
];

export default function ReportsPage() {
  const [reportTypes, setReportTypes] = useState(defaultReportTypes);
  const [summaryStats, setSummaryStats] = useState([
    { label: 'PWD', value: 0 },
    { label: 'Senior Citizens', value: 0 },
    { label: 'Solo Parents', value: 0 },
  ]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [status, setStatus] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch counts from Supabase
  useEffect(() => {
    const fetchCounts = async () => {
      if (!supabase) {
        console.error('Database client not available');
        return;
      }

      try {
        const { data: residents, error } = await supabase
          .from('residents')
          .select('id, is_pwd, is_senior_citizen, is_solo_parent');

        if (error) throw error;

        const allResidents = residents || [];
        const pwdCount = allResidents.filter(r => r.is_pwd).length;
        const seniorCount = allResidents.filter(r => r.is_senior_citizen).length;
        const soloParentCount = allResidents.filter(r => r.is_solo_parent).length;
        const totalCount = allResidents.length;

        // Update report types with counts
        setReportTypes(prev => prev.map(report => {
          switch (report.id) {
            case 'pwd': return { ...report, count: pwdCount };
            case 'senior': return { ...report, count: seniorCount };
            case 'soloparent': return { ...report, count: soloParentCount };
            case 'all': return { ...report, count: totalCount };
            default: return report;
          }
        }));

        // Update summary stats
        setSummaryStats([
          { label: 'PWD', value: pwdCount },
          { label: 'Senior Citizens', value: seniorCount },
          { label: 'Solo Parents', value: soloParentCount },
        ]);
      } catch (err) {
        console.error('Failed to fetch report counts:', err);
      }
    };

    fetchCounts();
  }, []);

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setSelectedFormat('pdf'); // Reset to default
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
      Address: `${row.house_no || ''} ${row.street || ''}`.trim(),
      Barangay: row.barangay || '',
      City: row.city || '',
      PWD: row.is_pwd ? 'Yes' : 'No',
      'Senior Citizen': row.is_senior_citizen ? 'Yes' : 'No',
      'Solo Parent': row.is_solo_parent ? 'Yes' : 'No',
      Status: row.status || '',
    }));
  };

  const handleConfirmGenerate = async () => {
    if (!selectedReport || isGenerating) return;

    setIsGenerating(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = `${selectedReport.id}_report_${dateStr}`;

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selectedReport.id,
          format: selectedFormat,
        }),
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

        setStatus({
          type: 'success',
          message: `CSV report "${selectedReport.title}" downloaded successfully!`,
        });
      } else {
        const payload = await response.json();
        if (payload?.error) throw new Error(payload.error);

        const exportRows = toExportRows(payload?.data);

        if (selectedFormat === 'excel') {
          const xlsxMod = await import('xlsx');
          const XLSX = xlsxMod.default ?? xlsxMod;

          const ws = XLSX.utils.json_to_sheet(exportRows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Report');

          const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          downloadBlob(blob, `${baseName}.xlsx`);

          setStatus({
            type: 'success',
            message: `Excel report "${selectedReport.title}" downloaded successfully!`,
          });
        } else if (selectedFormat === 'pdf') {
          const { jsPDF } = await import('jspdf');
          const autoTableMod = await import('jspdf-autotable');
          const autoTable = autoTableMod.default ?? autoTableMod;

          const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
          doc.setFontSize(14);
          doc.text(`${selectedReport.title} - ${dateStr}`, 40, 40);

          if (exportRows.length === 0) {
            doc.setFontSize(12);
            doc.text('No records found.', 40, 70);
          } else {
            const head = [Object.keys(exportRows[0])];
            const body = exportRows.map((r) => Object.values(r));

            autoTable(doc, {
              startY: 60,
              head,
              body,
              styles: { fontSize: 8 },
              headStyles: { fillColor: [30, 64, 175] },
              margin: { left: 40, right: 40 },
            });
          }

          doc.save(`${baseName}.pdf`);

          setStatus({
            type: 'success',
            message: `PDF report "${selectedReport.title}" downloaded successfully!`,
          });
        } else {
          throw new Error('Unsupported format selected.');
        }
      }

      setIsModalOpen(false);
      setSelectedReport(null);
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Failed to generate report: ' + error.message,
      });
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
      <Card title="Generate Reports" subtitle="Select a report type to generate and export resident lists">
        <div className={styles.reportGrid}>
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className={styles.reportCard}
              onClick={() => handleReportClick(report)}
            >
              <div className={styles.reportInfo}>
                <h3 className={styles.reportTitle}>{report.title}</h3>
                <p className={styles.reportDesc}>{report.description}</p>
              </div>
              <span className={styles.reportCount}>{report.count} records</span>
            </button>
          ))}
        </div>

        <div className={styles.summaryGrid}>
          {summaryStats.map((stat, index) => (
            <div key={index} className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{stat.label}</span>
              <span className={styles.summaryValue}>{stat.value}</span>
            </div>
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
                  className={`${styles.formatBtn} ${selectedFormat === 'excel' ? styles.formatBtnActive : ''}`}
                  onClick={() => setSelectedFormat('excel')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                  Excel
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
