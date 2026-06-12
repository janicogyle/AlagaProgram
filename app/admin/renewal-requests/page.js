'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, DocumentPreviewModal, Modal, PageHeader, Table } from '@/components';
import { supabase } from '@/lib/supabaseClient';
import styles from './page.module.css';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Incomplete', label: 'Incomplete' },
  { value: 'Approved', label: 'Approved' },
];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fullName(resident) {
  return [resident?.first_name, resident?.middle_name, resident?.last_name].filter(Boolean).join(' ') || '-';
}

export default function RenewalRequestsPage() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState({ open: false, title: '', message: '' });
  const [setupNotice, setSetupNotice] = useState('');
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: '', path: '' });

  const closeAlert = () => setAlert((prev) => ({ ...prev, open: false }));

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) throw new Error('Not authenticated. Please log in again.');
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const loadRows = async () => {
    setLoading(true);
    setSetupNotice('');
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/renewal-requests?${params.toString()}`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json?.code === 'RENEWAL_REQUESTS_TABLE_MISSING') {
        setRows([]);
        setSetupNotice(json?.error || 'Renewal Requests table is not set up yet.');
        return;
      }
      if (!res.ok || json?.error) throw new Error(json?.error || 'Failed to load renewal requests.');
      setSetupNotice('');
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (error) {
      setRows([]);
      setSetupNotice('');
      setAlert({ open: true, title: 'Load failed', message: error?.message || 'Failed to load renewal requests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openDecision = (row, nextDecision) => {
    setSelected(row);
    setDecision(nextDecision);
    setAdminRemarks('');
  };

  const closeDecision = () => {
    if (processing) return;
    setSelected(null);
    setDecision('');
    setAdminRemarks('');
  };

  const submitDecision = async () => {
    if (!selected || !decision || processing) return;
    setProcessing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/renewal-requests/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: decision, admin_remarks: adminRemarks || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Failed to update renewal request.');
      closeDecision();
      await loadRows();
      setAlert({
        open: true,
        title: 'Request updated',
        message: decision === 'approve' ? 'Renewal request approved.' : 'Renewal request marked incomplete.',
      });
    } catch (error) {
      setAlert({ open: true, title: 'Update failed', message: error?.message || 'Failed to update renewal request.' });
    } finally {
      setProcessing(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'resident',
      label: 'Beneficiary',
      render: (_, row) => (
        <div className={styles.beneficiaryCell}>
          <span className={styles.beneficiaryName}>{fullName(row.resident)}</span>
          <span className={styles.meta}>{row.resident?.control_number || row.resident?.contact_number || '-'}</span>
        </div>
      ),
    },
    {
      key: 'current_expires_at',
      label: 'Current Expiration',
      render: (value) => formatDate(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant={value === 'Approved' ? 'success' : value === 'Incomplete' ? 'danger' : 'warning'}>{value}</Badge>,
    },
    {
      key: 'updated_valid_id_url',
      label: 'Updated ID',
      render: (value) => value ? (
        <button className={styles.documentLink} type="button" onClick={() => setDocumentPreview({ open: true, url: value, path: value })}>
          View document
        </button>
      ) : '-',
    },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actionsCell}>
          <Button size="small" variant="secondary" onClick={() => openDecision(row, 'incomplete')} disabled={row.status === 'Approved'}>
            Incomplete
          </Button>
          <Button size="small" onClick={() => openDecision(row, 'approve')} disabled={row.status === 'Approved'}>
            Approve
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className={styles.page}>
      <PageHeader title="Renewal Requests" subtitle="Review and process Beneficiary ID renewal requests." />
      <Card className={styles.filterCard}>
        <div className={styles.statusTabs} role="group" aria-label="Renewal request status">
          {statusOptions.map((option) => (
            <Button
              key={option.value || 'all'}
              variant={statusFilter === option.value ? 'primary' : 'secondary'}
              size="small"
              className={`${styles.statusTab} ${statusFilter === option.value ? styles.statusTabActive : ''}`}
              onClick={() => setStatusFilter(option.value)}
              aria-pressed={statusFilter === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>
      <Card>
        {setupNotice ? (
          <div className={styles.setupNotice} role="status">
            <h2>Renewal setup required</h2>
            <p>{setupNotice}</p>
          </div>
        ) : loading ? (
          <p className={styles.meta}>Loading renewal requests...</p>
        ) : (
          <Table columns={columns} data={rows} emptyMessage="No renewal requests found." />
        )}
      </Card>

      <Modal
        isOpen={!!selected && !!decision}
        onClose={closeDecision}
        title={decision === 'approve' ? 'Approve Renewal' : 'Mark Renewal Incomplete'}
        size="medium"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={closeDecision} disabled={processing}>Cancel</Button>
            <Button onClick={submitDecision} disabled={processing}>
              {processing ? 'Saving...' : decision === 'approve' ? 'Approve' : 'Mark Incomplete'}
            </Button>
          </div>
        }
      >
        <div className={styles.modalStack}>
          <dl className={styles.detailGrid}>
            <dt>Beneficiary</dt>
            <dd>{fullName(selected?.resident)}</dd>
            <dt>Current expiration</dt>
            <dd>{formatDate(selected?.current_expires_at)}</dd>
            <dt>Remarks</dt>
            <dd>{selected?.remarks || '-'}</dd>
          </dl>
          <label>
            <span className={styles.meta}>Admin remarks</span>
            <textarea
              className={styles.remarksInput}
              value={adminRemarks}
              onChange={(event) => setAdminRemarks(event.target.value)}
              placeholder={decision === 'approve' ? 'Optional approval notes' : 'Tell the beneficiary what needs to be fixed'}
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={alert.open}
        onClose={closeAlert}
        title={alert.title || 'Notice'}
        size="small"
        footer={<Button onClick={closeAlert}>OK</Button>}
      >
        <p>{alert.message}</p>
      </Modal>

      <DocumentPreviewModal
        isOpen={documentPreview.open}
        onClose={() => setDocumentPreview({ open: false, url: '', path: '' })}
        url={documentPreview.url}
        path={documentPreview.path}
      />
    </div>
  );
}
