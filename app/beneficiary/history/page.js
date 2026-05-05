'use client';

import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import styles from './page.module.css';
import Modal from '../../../components/Modal';
import { getCooldownInfo } from '@/lib/requestCooldown';

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
    render: (status) => {
      const label = status === 'Rejected' ? 'Incomplete' : status;
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
    },
  },
  {
    key: 'actions',
    label: 'Action',
    render: (_, row) =>
      row.status === 'Rejected' ? (
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

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    const loadRequests = async () => {
      try {
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
        setRequests([]);
        openAlert({
          title: 'Load failed',
          message: err?.message || 'Failed to load assistance history. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  const tableData = requests.map((r) => ({
    ...r,
    request_date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
  }));

  return (
    <div className={styles.historyPage}>
      <PageHeader
        title="Requests History"
        subtitle="View all assistance requests you have submitted"
      />

      <Card className={styles.historyCard}>
        <div className={styles.headerRow}>
          <h2>Requests</h2>
          <Button href="/beneficiary/requests">New Request</Button>
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
          <Table columns={columns} data={tableData} />
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
