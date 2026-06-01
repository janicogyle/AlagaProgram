'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import styles from './page.module.css';
import Modal from '../../../components/Modal';
import { getCooldownInfo } from '@/lib/requestCooldown';
import { realtimeHelpers, supabase } from '@/lib/supabaseClient';

const isEditableRequestStatus = (status) => status === 'Rejected';
const getRequestStatusLabel = (status) => {
  if (status === 'Rejected') return 'Incomplete';
  if (status === 'Resubmitted') return 'Under Review';
  return status;
};

function RequestStatusBadge({ status }) {
  const label = getRequestStatusLabel(status);
  return (
    <Badge
      variant={
        status === 'Released' || status === 'Approved'
          ? 'success'
          : status === 'Rejected'
            ? 'danger'
            : 'warning'
      }
    >
      {label}
    </Badge>
  );
}

const columns = [
  { key: 'control_number', label: 'Control No.' },
  { key: 'assistance_type', label: 'Type of Assistance' },
  {
    key: 'request_date',
    label: 'Date Requested',
  },
  {
    key: 'status',
    label: 'Status',
    render: (status) => <RequestStatusBadge status={status} />,
  },
  {
    key: 'actions',
    label: 'Action',
    render: (_, row) =>
      isEditableRequestStatus(row.status) ? (
        <Button href={`/beneficiary/requests?edit=${encodeURIComponent(row.id)}`}>Edit</Button>
      ) : (
        <span className={styles.muted}>—</span>
      ),
  },
];

export default function BeneficiaryHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [cooldownInfo, setCooldownInfo] = useState(() => getCooldownInfo(null));

  const openAlert = useCallback(({ title, message }) => {
    setAlertState({ open: true, title, message });
  }, []);

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const loadRequests = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      let residentId = null;
      if (typeof window !== 'undefined') {
        residentId = window.localStorage.getItem('beneficiaryResidentId');
      }

      if (!residentId) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/assistance-requests?residentId=${encodeURIComponent(residentId)}`);
      const result = await response.json();

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to load assistance history.');
      }

      const mapped = (result.data || []).map((row) => ({
        ...row,
        request_control_number: row.control_number,
        control_number: row.residents?.control_number || row.control_number,
      }));

      setRequests(mapped);
      const lastReleased = mapped.find(
        (row) => String(row?.status || '').toLowerCase() === 'released',
      );
      const lastDate = lastReleased?.request_date || lastReleased?.created_at || null;
      setCooldownInfo(getCooldownInfo(lastDate));
    } catch (err) {
      console.error('Failed to load assistance history:', err);
      if (!silent) {
        setRequests([]);
        openAlert({
          title: 'Load failed',
          message: err?.message || 'Failed to load assistance history. Please try again.',
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [openAlert]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return undefined;
    const residentId = window.localStorage.getItem('beneficiaryResidentId');
    if (!residentId) return undefined;

    const channel = realtimeHelpers.subscribeToTable(
      'assistance_requests',
      () => loadRequests({ silent: true }),
      `resident_id=eq.${residentId}`,
    );

    return () => {
      realtimeHelpers.unsubscribe(channel);
    };
  }, [loadRequests]);

  const tableData = requests.map((r) => ({
    ...r,
    request_date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
  }));
  const hasActiveRequest = requests.some((row) => ['Pending', 'Resubmitted'].includes(row.status));

  return (
    <div className={styles.historyPage}>
      <PageHeader
        title="Requests History"
        subtitle="View all assistance requests you have submitted"
      />

      <Card className={styles.historyCard}>
        <div className={styles.headerRow}>
          <h2>Requests</h2>
          {!hasActiveRequest && (
            <Button href="/beneficiary/requests" disabled={!cooldownInfo.isEligible}>New Request</Button>
          )}
        </div>
        <div className={styles.cooldownRow}>
          <span className={styles.cooldownLabel}>Request Eligibility</span>
          <Badge
            variant={
              cooldownInfo.status === 'Eligible'
                ? 'success'
                : cooldownInfo.status === 'Almost Eligible'
                  ? 'warning'
                  : 'danger'
            }
          >
            {cooldownInfo.status}
          </Badge>
          {!cooldownInfo.isEligible && (
            <span className={styles.cooldownMeta}>
              {cooldownInfo.daysRemaining} day(s) remaining
            </span>
          )}
        </div>

        {loading ? (
          <p className={styles.muted}>Loading your assistance history...</p>
        ) : tableData.length === 0 ? (
          <p className={styles.muted}>
            You have no assistance requests yet. Click &quot;New Request&quot; to submit one.
          </p>
        ) : (
          <>
            <div className={styles.tableView}>
              <Table columns={columns} data={tableData} />
            </div>

            <div className={styles.mobileCardView}>
              {tableData.map((row) => (
                <article key={row.id} className={styles.requestCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardControlNo}>{row.control_number}</span>
                    <RequestStatusBadge status={row.status} />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Type of Assistance</span>
                      <span className={styles.cardValue}>{row.assistance_type || '—'}</span>
                    </div>
                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Date Requested</span>
                      <span className={styles.cardValue}>{row.request_date || '—'}</span>
                    </div>
                  </div>
                  {isEditableRequestStatus(row.status) ? (
                    <div className={styles.cardFooter}>
                      <Button href={`/beneficiary/requests?edit=${encodeURIComponent(row.id)}`}>
                        Edit Request
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Alert Modal */}
      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Notice'}
        size="small"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button onClick={closeAlert}>OK</Button>
          </div>
        }
      >
        <p>{alertState.message}</p>
      </Modal>
    </div>
  );
}
