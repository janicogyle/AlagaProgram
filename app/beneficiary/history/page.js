'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Table from '../../../components/Table';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import styles from './page.module.css';
import Modal from '../../../components/Modal';
import { getCooldownInfo } from '@/lib/requestCooldown';
import { realtimeHelpers, supabase } from '@/lib/supabaseClient';
import { resolveAssistanceAmount } from '@/lib/assistanceAmounts.mjs';

const isEditableRequestStatus = (status) => status === 'Rejected' || status === 'Incomplete';
const RESTRICTED_ID_STATUSES = new Set(['Expired', 'Renewal Pending']);
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

const parseListValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [value].filter(Boolean);

  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    return [parsed].filter(Boolean);
  } catch {
    return [raw];
  }
};

const getDocumentFileName = (url, fallback = 'Document') => {
  const clean = String(url || '').split('?')[0];
  const name = clean.split('/').pop();
  return name ? decodeURIComponent(name) : fallback;
};

const getRequirementDocuments = (request) => {
  const documents = [];

  parseListValue(request?.requirements_files).forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      documents.push({
        url: item,
        name: getDocumentFileName(item),
        requirementType: '',
      });
      return;
    }

    const url = String(item.file_url || item.fileUrl || item.url || '').trim();
    if (!url) return;
    documents.push({
      url,
      name: String(item.file_name || item.fileName || '').trim() || getDocumentFileName(url),
      requirementType: String(item.requirement_type || item.requirementType || '').trim(),
    });
  });

  [...parseListValue(request?.requirements_urls), ...parseListValue(request?.valid_id_url)].forEach((item) => {
    if (!item) return;
    const url = typeof item === 'string' ? item.trim() : String(item.file_url || item.fileUrl || item.url || '').trim();
    if (!url) return;
    documents.push({
      url,
      name: getDocumentFileName(url),
      requirementType: '',
    });
  });

  const unique = new Map();
  documents.forEach((doc) => {
    if (!doc.url) return;
    unique.set(doc.url, doc);
  });
  return Array.from(unique.values());
};

const formatCurrency = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH')}`;

export default function BeneficiaryHistoryPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [autoOpenRequestRef, setAutoOpenRequestRef] = useState('');
  const [cooldownInfo, setCooldownInfo] = useState(() => getCooldownInfo(null));
  const [idStatus, setIdStatus] = useState('');
  const autoOpenHandledRef = useRef('');

  const openAlert = useCallback(({ title, message }) => {
    setAlertState({ open: true, title, message });
  }, []);

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const openRequestDetails = useCallback((request) => {
    setSelectedRequest(request);
  }, []);

  const closeRequestDetails = () => {
    setSelectedRequest(null);
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setAutoOpenRequestRef(params.get('request') || '');
  }, []);

  useEffect(() => {
    if (!autoOpenRequestRef || loading || !requests.length) return;
    if (autoOpenHandledRef.current === autoOpenRequestRef) return;

    const match = requests.find((row) => (
      String(row.id || '') === autoOpenRequestRef
      || String(row.control_number || '') === autoOpenRequestRef
      || String(row.request_control_number || '') === autoOpenRequestRef
    ));

    if (match) {
      setSelectedRequest(match);
      autoOpenHandledRef.current = autoOpenRequestRef;
    }
  }, [autoOpenRequestRef, loading, requests]);

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
    amount_display: formatCurrency(resolveAssistanceAmount(r.assistance_type, r.amount)),
  }));
  const hasActiveRequest = requests.some((row) => ['Pending', 'Resubmitted'].includes(row.status));
  const selectedDocuments = selectedRequest ? getRequirementDocuments(selectedRequest) : [];
  const selectedAmount = selectedRequest
    ? resolveAssistanceAmount(selectedRequest.assistance_type, selectedRequest.amount)
    : 0;
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
      render: (_, row) => (
        <div className={styles.actionGroup}>
          <Button type="button" variant="secondary" onClick={() => openRequestDetails(row)}>
            View Details
          </Button>
          {isEditableRequestStatus(row.status) ? (
            <Button href={`/beneficiary/requests?edit=${encodeURIComponent(row.id)}`}>Edit</Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (RESTRICTED_ID_STATUSES.has(idStatus)) {
    return (
      <div className={styles.historyPage}>
        <PageHeader title="Requests History" subtitle="Beneficiary ID renewal is required." />
        <Card title="Beneficiary ID Renewal Required">
          <p className={styles.muted}>
            Your Beneficiary ID must be renewed before viewing or creating assistance requests.
          </p>
          <Button href="/beneficiary/profile">Renew ID</Button>
        </Card>
      </div>
    );
  }

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
                    <div className={styles.cardRow}>
                      <span className={styles.cardLabel}>Amount</span>
                      <span className={styles.cardValue}>{row.amount_display}</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <Button type="button" variant="secondary" onClick={() => openRequestDetails(row)}>
                      View Details
                    </Button>
                    {isEditableRequestStatus(row.status) ? (
                      <Button href={`/beneficiary/requests?edit=${encodeURIComponent(row.id)}`}>
                        Edit Request
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={!!selectedRequest}
        onClose={closeRequestDetails}
        title="Request Details"
        size="large"
        footer={
          <div className={styles.modalFooterActions}>
            {selectedRequest && isEditableRequestStatus(selectedRequest.status) ? (
              <Button href={`/beneficiary/requests?edit=${encodeURIComponent(selectedRequest.id)}`}>
                Edit Request
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={closeRequestDetails}>
              Close
            </Button>
          </div>
        }
      >
        {selectedRequest ? (
          <div className={styles.detailsContent}>
            <div className={styles.detailsGrid}>
              <section className={styles.detailPanel}>
                <div className={styles.detailPanelHeader}>
                  <h3>Request</h3>
                  <RequestStatusBadge status={selectedRequest.status} />
                </div>
                <dl className={styles.detailRows}>
                  <div>
                    <dt>Request Control No.</dt>
                    <dd>{selectedRequest.request_control_number || selectedRequest.control_number || '—'}</dd>
                  </div>
                  <div>
                    <dt>Beneficiary Control No.</dt>
                    <dd>{selectedRequest.control_number || '—'}</dd>
                  </div>
                  <div>
                    <dt>Type of Assistance</dt>
                    <dd>{selectedRequest.assistance_type || '—'}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatCurrency(selectedAmount)}</dd>
                  </div>
                  <div>
                    <dt>Date Requested</dt>
                    <dd>{selectedRequest.request_date || '—'}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.detailPanel}>
                <h3>Beneficiary</h3>
                <dl className={styles.detailRows}>
                  <div>
                    <dt>Name</dt>
                    <dd>{selectedRequest.beneficiary_name || selectedRequest.requester_name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{selectedRequest.beneficiary_contact || selectedRequest.requester_contact || '—'}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedRequest.beneficiary_address || '—'}</dd>
                  </div>
                  <div>
                    <dt>Requester</dt>
                    <dd>{selectedRequest.requester_name || '—'}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className={`${styles.detailPanel} ${styles.detailPanelFull}`}>
              <h3>Uploaded Requirement Documents</h3>
              {selectedDocuments.length ? (
                <ul className={styles.documentList}>
                  {selectedDocuments.map((document, index) => (
                    <li key={`${document.url}-${index}`} className={styles.documentItem}>
                      <div className={styles.documentMeta}>
                        <span className={styles.documentName}>{document.name || `Document ${index + 1}`}</span>
                        {document.requirementType ? (
                          <span className={styles.documentType}>{document.requirementType}</span>
                        ) : null}
                      </div>
                      <a href={document.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>No uploaded requirement documents were saved for this request.</p>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

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
