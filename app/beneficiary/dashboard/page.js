'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import styles from './page.module.css';
import Modal from '../../../components/Modal';

const columns = [
  { key: 'control_number', label: 'Control No.' },
  { key: 'assistance_type', label: 'Type of Assistance' },
  { key: 'request_date', label: 'Date Requested' },
  {
    key: 'status',
    label: 'Status',
    render: (status) => {
      const label = status === 'Rejected' ? 'Incomplete' : status;
      return (
        <Badge variant={status === 'Released' || status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning'}>
          {label}
        </Badge>
      );
    },
  },
];

export default function BeneficiaryDashboardPage() {
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | active | completed | rejected
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    rejected: 0,
    lastDate: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        let residentId = null;
        let storedName = '';

        if (typeof window !== 'undefined') {
          residentId = window.localStorage.getItem('beneficiaryResidentId');
          storedName = window.localStorage.getItem('beneficiaryName') || '';
        }

        if (storedName) {
          setBeneficiaryName(storedName);
        }

        if (!residentId) {
          setRequests([]);
          setStats({ total: 0, active: 0, pending: 0, completed: 0, rejected: 0, lastDate: null });
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/assistance-requests?residentId=${encodeURIComponent(residentId)}`);
        const result = await response.json();

        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Failed to load assistance requests.');
        }

        const safeData = (result.data || []).map((row) => ({
          ...row,
          request_control_number: row.control_number,
          control_number: row.residents?.control_number || row.control_number,
        }));
        setRequests(safeData);

        if (safeData.length > 0) {
          const total = safeData.length;
          const pending = safeData.filter((r) => r.status === 'Pending').length;
          const completed = safeData.filter((r) => r.status === 'Released' || r.status === 'Approved').length;
          const rejected = safeData.filter((r) => r.status === 'Rejected').length;
          const lastDate = safeData[0].request_date;

          setStats({ total, active: pending, pending, completed, rejected, lastDate });
        } else {
          setStats({ total: 0, active: 0, pending: 0, completed: 0, rejected: 0, lastDate: null });
        }
      } catch (err) {
        console.error('Failed to load beneficiary dashboard data:', err);
        setRequests([]);
        setStats({ total: 0, active: 0, pending: 0, completed: 0, rejected: 0, lastDate: null });
        openAlert({
          title: 'Load failed',
          message: err?.message || 'Failed to load your dashboard data. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const isActiveStatus = (status) => status === 'Pending';
  const isCompletedStatus = (status) => status === 'Released' || status === 'Approved';
  const isRejectedStatus = (status) => status === 'Rejected';

  const getStatusDescription = (status) => {
    if (isActiveStatus(status)) {
      return 'Your request is being reviewed by the barangay office.';
    }
    if (isCompletedStatus(status)) {
      return 'Your assistance request has been approved and released.';
    }
    if (isRejectedStatus(status)) {
      return 'Your request is incomplete. Please see details or contact the barangay.';
    }
    return 'Status updated by the barangay office.';
  };

  const handleCopyControlNumber = (controlNumber) => {
    if (!controlNumber) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(controlNumber)
        .catch((err) => console.error('Failed to copy control number:', err));
    }
  };

  const hasActiveRequest = requests.some((r) => isActiveStatus(r.status));

  const currentRequestRaw = requests[0] || null;
  const currentRequest = currentRequestRaw
    ? {
        ...currentRequestRaw,
        request_date: currentRequestRaw.request_date
          ? new Date(currentRequestRaw.request_date).toLocaleDateString()
          : '',
      }
    : null;

  const filteredRequests = requests.filter((r) => {
    if (filter === 'active') return isActiveStatus(r.status);
    if (filter === 'completed') return isCompletedStatus(r.status);
    if (filter === 'rejected') return isRejectedStatus(r.status);
    return true;
  });

  const recentRequests = filteredRequests.slice(0, 5).map((r) => ({
    ...r,
    request_date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
  }));

  return (
    <div className={styles.dashboardPage}>
      <PageHeader
        title={beneficiaryName ? `Welcome, ${beneficiaryName}` : 'Beneficiary Dashboard'}
        subtitle="View your ALAGA assistance requests and next steps"
      />

      <div className={styles.topSection}>
        <div className={styles.statsGrid}>
          <StatCard title="Total Requests" value={stats.total} subtitle="All assistance requests you have submitted" />
          <StatCard title="Active" value={stats.active} subtitle="Requests currently under review" />
          <StatCard title="Completed" value={stats.completed} subtitle="Approved and released assistance" />
          <StatCard title="Incomplete" value={stats.rejected} subtitle="Requests that were not approved" />
        </div>

        <Card className={styles.nextStepsCard}>
          <h3 className={styles.nextTitle}>
            {currentRequest ? 'Your Current Request' : 'Get Started with Assistance'}
          </h3>
          {loading ? (
            <p className={styles.muted}>Loading your latest request...</p>
          ) : !currentRequest ? (
            <p className={styles.muted}>
              You have no assistance requests yet. Start a new request to access barangay services.
            </p>
          ) : (
            <div className={styles.nextBody}>
              <div>
                <p className={styles.nextLabel}>Most recent request</p>
                <p className={styles.nextPrimary}>{currentRequest.assistance_type}</p>
                <p className={styles.nextMeta}>
                  <span className={styles.controlNumberRow}>
                    <span>Control No. {currentRequest.control_number}</span>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() => handleCopyControlNumber(currentRequest.control_number)}
                    >
                      Copy
                    </button>
                  </span>
                  {currentRequest.request_date && ` • ${currentRequest.request_date}`}
                </p>
                <Badge
                  variant={
                    isCompletedStatus(currentRequest.status)
                      ? 'success'
                      : isRejectedStatus(currentRequest.status)
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {currentRequest.status === 'Rejected' ? 'Incomplete' : currentRequest.status}
                </Badge>
                <p className={styles.statusHint}>{getStatusDescription(currentRequest.status)}</p>
              </div>
            </div>
          )}

          <div className={styles.quickActions}>
            <Link href="/beneficiary/requests">
              <Button>New Request</Button>
            </Link>
            <Link href="/beneficiary/history">
              <Button variant="secondary">My Requests</Button>
            </Link>
            <Link href="/beneficiary/profile">
              <Button variant="secondary">My Profile</Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className={styles.infoRow}>
        <Card className={styles.infoCard}>
          <h3 className={styles.infoTitle}>How ALAGA Assistance Works</h3>
          <ol className={styles.infoList}>
            <li>Submit a new assistance request form with complete details.</li>
            <li>The barangay office reviews your request and supporting documents.</li>
            <li>You are notified once your request is approved, released, or if more information is needed.</li>
          </ol>
        </Card>
        <Card className={styles.supportCard}>
          <h3 className={styles.infoTitle}>Need Help?</h3>
          <p className={styles.muted}>
            If you have questions about your request, you can visit the barangay office during office hours or contact the
            barangay staff.
          </p>
        </Card>
      </div>

      <Card className={styles.requestsCard}>
        <div className={styles.requestsHeader}>
          <h2>My Recent Requests</h2>
          {stats.lastDate && (
            <p className={styles.lastUpdated}>Last request: {new Date(stats.lastDate).toLocaleDateString()}</p>
          )}
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'all' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'active' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'completed' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${filter === 'rejected' ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Incomplete
          </button>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading requests...</p>
        ) : recentRequests.length === 0 ? (
          <p className={styles.muted}>No requests found. Submit your first request to see it here.</p>
        ) : (
          <Table columns={columns} data={recentRequests} />
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
