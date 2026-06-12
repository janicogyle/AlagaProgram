'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '../../../components/PageHeader';
import KpiCard from '../../../components/KpiCard';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import styles from './page.module.css';
import Modal from '../../../components/Modal';
import { realtimeHelpers, supabase } from '@/lib/supabaseClient';
import { deleteClientCache, getClientCache, setClientCache } from '@/lib/clientCache';

const isActiveRequestStatus = (status) => status === 'Pending' || status === 'Resubmitted';
const isEditableRequestStatus = (status) => status === 'Rejected';
const RESTRICTED_ID_STATUSES = new Set(['Expired', 'Renewal Pending']);
const DASHBOARD_CACHE_MAX_AGE = 0;
const emptyStats = { total: 0, active: 0, pending: 0, completed: 0, rejected: 0, lastDate: null };

const getRequestStatusLabel = (status) => {
  if (status === 'Rejected') return 'Incomplete';
  if (status === 'Resubmitted') return 'Under Review';
  return status;
};

const getDashboardCacheKey = (residentId) => `beneficiary-dashboard:${residentId}`;

const buildDashboardState = (rows) => {
  const safeData = (rows || []).map((row) => ({
    ...row,
    request_control_number: row.control_number,
    control_number: row.residents?.control_number || row.control_number,
  }));

  if (safeData.length === 0) {
    return { requests: safeData, stats: emptyStats };
  }

  const pending = safeData.filter((r) => isActiveRequestStatus(r.status)).length;
  const completed = safeData.filter((r) => r.status === 'Released' || r.status === 'Approved').length;
  const rejected = safeData.filter((r) => r.status === 'Rejected').length;

  return {
    requests: safeData,
    stats: {
      total: safeData.length,
      active: pending,
      pending,
      completed,
      rejected,
      lastDate: safeData[0].request_date,
    },
  };
};

const columns = [
  { key: 'control_number', label: 'Control No.' },
  { key: 'assistance_type', label: 'Type of Assistance' },
  { key: 'request_date', label: 'Date Requested' },
  {
    key: 'status',
    label: 'Status',
    render: (status) => {
      const label = getRequestStatusLabel(status);
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
  const [idStatus, setIdStatus] = useState('');

  const openAlert = useCallback(({ title, message }) => {
    setAlertState({ open: true, title, message });
  }, []);

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

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    let cacheKey = null;
    let usedCachedData = false;

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
        setStats(emptyStats);
        setLoading(false);
        return;
      }

      cacheKey = getDashboardCacheKey(residentId);
      const cached = getClientCache(cacheKey, { maxAge: DASHBOARD_CACHE_MAX_AGE });

      if (cached && !silent) {
        usedCachedData = true;
        setRequests(cached.value.requests);
        setStats(cached.value.stats);
        setLoading(false);

        if (cached.isFresh) return;
      }

      if (!silent && !usedCachedData) setLoading(true);

      const response = await fetch(`/api/assistance-requests?residentId=${encodeURIComponent(residentId)}`);
      const result = await response.json();

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to load assistance requests.');
      }

      const nextState = buildDashboardState(result.data || []);
      setRequests(nextState.requests);
      setStats(nextState.stats);
      setClientCache(cacheKey, nextState);
    } catch (err) {
      console.error('Failed to load beneficiary dashboard data:', err);
      if (!silent && !usedCachedData) {
        setRequests([]);
        setStats(emptyStats);
        openAlert({
          title: 'Load failed',
          message: err?.message || 'Failed to load your dashboard data. Please try again.',
        });
      }
    } finally {
      if (!silent && !usedCachedData) setLoading(false);
    }
  }, [openAlert]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    const loadIdStatus = async () => {
      try {
        const response = await fetch('/api/beneficiary-cards/me', {
          method: 'GET',
          credentials: 'include',
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && !payload?.error) {
          setIdStatus(payload?.data?.idStatus || payload?.data?.residentStatus || '');
        }
      } catch {
        if (!cancelled) setIdStatus('');
      }
    };

    void loadIdStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('alaga-dashboard-loading', {
        detail: { loading },
      }),
    );
  }, [loading]);

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return undefined;
    const residentId = window.localStorage.getItem('beneficiaryResidentId');
    if (!residentId) return undefined;

    const channel = realtimeHelpers.subscribeToTable(
      'assistance_requests',
      () => {
        deleteClientCache(getDashboardCacheKey(residentId));
        loadDashboard({ silent: true });
      },
      `resident_id=eq.${residentId}`,
    );

    return () => {
      realtimeHelpers.unsubscribe(channel);
    };
  }, [loadDashboard]);

  const isActiveStatus = isActiveRequestStatus;
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
      return 'Your request is incomplete. Please edit and resubmit it.';
    }
    return 'Status updated by the barangay office.';
  };

  const activeRequest = requests.find((r) => isActiveStatus(r.status));
  const editableRequest = requests.find((r) => isEditableRequestStatus(r.status));
  const hasActiveRequest = !!activeRequest;
  const isIdRestricted = RESTRICTED_ID_STATUSES.has(idStatus);

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
        className={styles.mobileHeroHeader}
      />

      <div className={styles.topSection}>
        <div className={styles.statsGrid}>
          <KpiCard title="Total Requests" value={stats.total} color="blue" icon="file" compact />
          <KpiCard title="Active Requests" value={stats.active} color="green" icon="assistance" compact />
          <KpiCard title="Completed Requests" value={stats.completed} color="orange" icon="completion" compact />
          <KpiCard title="Incomplete Requests" value={stats.rejected} color="purple" icon="incomplete" compact />
        </div>

        <Card className={styles.nextStepsCard} fillHeight>
          <div className={styles.nextStepsBody}>
          <div className={styles.requestMain}>
            {loading ? (
              <p className={styles.muted}>Loading your latest request...</p>
            ) : !currentRequest ? (
              <>
                <h3 className={styles.nextTitle}>Get Started with Assistance</h3>
                <p className={styles.muted}>
                  You have no assistance requests yet. Start a new request to access barangay services.
                </p>
              </>
            ) : (
              <>
                <div className={styles.requestHeader}>
                  <div className={styles.requestHeaderText}>
                    <h3 className={styles.nextTitle}>Your Current Request</h3>
                    <p className={styles.nextLabel}>Most recent request</p>
                  </div>
                  <Badge
                    variant={
                      isCompletedStatus(currentRequest.status)
                        ? 'success'
                        : isRejectedStatus(currentRequest.status)
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {getRequestStatusLabel(currentRequest.status)}
                  </Badge>
                </div>
                <div className={styles.requestDetails}>
                  <p className={styles.nextPrimary}>{currentRequest.assistance_type}</p>
                  <p className={styles.nextMeta}>
                    Control No. {currentRequest.control_number}
                    {currentRequest.request_date && ` • ${currentRequest.request_date}`}
                  </p>
                  <p className={styles.statusHint}>{getStatusDescription(currentRequest.status)}</p>
                </div>
              </>
            )}
          </div>

          <div className={styles.quickActions}>
            <Button
              href={
                isIdRestricted
                  ? '/beneficiary/profile'
                  : editableRequest
                    ? `/beneficiary/requests?edit=${encodeURIComponent(editableRequest.id)}`
                    : '/beneficiary/requests'
              }
              disabled={!isIdRestricted && !editableRequest && hasActiveRequest}
            >
              {isIdRestricted ? 'Renew ID' : editableRequest ? 'Edit Incomplete Request' : 'New Request'}
            </Button>
            {!isIdRestricted && (
              <Link href="/beneficiary/history">
                <Button variant="secondary">My Requests</Button>
              </Link>
            )}
            <Link href="/beneficiary/profile">
              <Button variant="secondary">My Profile</Button>
            </Link>
          </div>
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
