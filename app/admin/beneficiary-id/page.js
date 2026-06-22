'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Button, PageHeader, Modal, Badge, Table, DocumentPreviewModal } from '@/components';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { isLikelyImage } from '@/lib/documentPreview';

function buildName(resident) {
  if (!resident) return '';
  return [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(' ');
}

function displayValue(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatAddress(resident) {
  if (!resident) return '-';
  const parts = [];
  if (resident.house_no) parts.push(resident.house_no);
  if (resident.purok) parts.push(`Purok ${resident.purok}`);
  if (resident.barangay) parts.push(resident.barangay);
  if (resident.city) parts.push(resident.city);
  return parts.length ? parts.join(', ') : '-';
}

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

function formatAmount(value) {
  return (Number(value) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeAge(birthday, storedAge) {
  const parsed = Number(storedAge);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function getSectors(resident) {
  if (!resident) return [];
  const sectors = [];
  if (resident.is_pwd) sectors.push('PWD');
  if (resident.is_senior_citizen) sectors.push('Senior Citizen');
  if (resident.is_solo_parent) sectors.push('Solo Parent');
  return sectors;
}

function getAssistanceTypeLabel(row) {
  return String(row?.assistance_type || row?.service_type || '').trim() || 'Assistance';
}

function isCheckedRequirement(item) {
  if (item === true || item === 'true' || item === 1 || item === '1') return true;
  const value = item?.checked;
  const completed = item?.completed;
  return (
    value === true ||
    value === 'true' ||
    value === 1 ||
    value === '1' ||
    completed === true ||
    completed === 'true' ||
    completed === 1 ||
    completed === '1'
  );
}

function toBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
}

function getRequirementsCompleted(checklist, fallbackValue) {
  if (Array.isArray(checklist) && checklist.length > 0) {
    return checklist.every(isCheckedRequirement);
  }

  return toBoolean(fallbackValue) === true;
}

function parseChecklist(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [];
}

function parseRequirements(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.file_url || item.fileUrl || '').trim();
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') return String(item.file_url || item.fileUrl || '').trim();
            return '';
          })
          .filter(Boolean);
      }
    } catch {
      // ignore
    }
  }
  return [];
}

function parseRequirementFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [];
}

function parseLegacyRequirementUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v.trim();
        if (v && typeof v === 'object') return String(v.file_url || v.fileUrl || '').trim();
        return '';
      })
      .filter(Boolean);
  }
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => {
          if (typeof v === 'string') return v.trim();
          if (v && typeof v === 'object') return String(v.file_url || v.fileUrl || '').trim();
          return '';
        })
        .filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [raw];
}

function getFileNameFromUrl(fileUrl) {
  const raw = String(fileUrl || '').trim();
  if (!raw) return 'Document';
  const cleaned = raw.split('?')[0];
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Document';
}

function getRequirementFiles(request) {
  if (!request) return [];

  const requirements = parseRequirements(request.requirements_urls);
  const requirementFileRows = parseRequirementFiles(request.requirements_files);
  const legacySingle = parseLegacyRequirementUrls(request.valid_id_url);
  const requirementUrls = requirements.length ? requirements : legacySingle;
  const requirementMap = new Map();

  requirementUrls.forEach((url) => {
    const fileUrl = String(url || '').trim();
    if (!fileUrl) return;
    requirementMap.set(fileUrl, {
      file_url: fileUrl,
      file_name: getFileNameFromUrl(fileUrl),
      requirement_type: null,
    });
  });

  requirementFileRows.forEach((row) => {
    const fileUrl = String(row?.file_url || row?.fileUrl || '').trim();
    if (!fileUrl) return;
    requirementMap.set(fileUrl, {
      file_url: fileUrl,
      file_name: String(row?.file_name || row?.fileName || '').trim() || getFileNameFromUrl(fileUrl),
      requirement_type: row?.requirement_type || row?.requirementType || null,
    });
  });

  return Array.from(requirementMap.values());
}

function getRequestStatusLabel(status) {
  if (status === 'Rejected') return 'Incomplete';
  if (status === 'Resubmitted') return 'Under Review';
  return displayValue(status);
}

function getRequestStatusVariant(status) {
  if (status === 'Released' || status === 'Approved') return 'success';
  if (status === 'Rejected') return 'danger';
  if (status === 'Pending' || status === 'Resubmitted') return 'warning';
  return 'secondary';
}

function formatProcessedBy(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw.includes('@') ? raw.split('@')[0] : raw;
}

function isIncompleteStatus(status) {
  return status === 'Rejected' || status === 'Archived' || status === 'Incomplete';
}

function normalizeCardReferenceInput(value) {
  const text = String(value || '');
  return text.includes('.') ? text.trim() : text.trim().toUpperCase();
}

function InfoRow({ label, value }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.k}>{label}</span>
      <span className={styles.v}>{value}</span>
    </div>
  );
}

export default function BeneficiaryIdVerifyPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSession, setScanSession] = useState(0);
  const [showLatestRequestModal, setShowLatestRequestModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: '', path: '' });

  const openAlert = ({ title, message }) => setAlertState({ open: true, title, message });
  const closeAlert = () => setAlertState((prev) => ({ ...prev, open: false }));

  const openDocumentPreview = (url, path = '') => {
    setDocumentPreview({
      open: true,
      url,
      path,
    });
  };

  const closeDocumentPreview = () => {
    setDocumentPreview({ open: false, url: '', path: '' });
  };

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) throw new Error('Not authenticated. Please log in again.');

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const handleScanDetected = async (text) => {
    const scanned = String(text || '').trim();
    if (!scanned) return;

    setToken(scanned);
    setScanOpen(false);

    try {
      await handleVerify(scanned);
    } catch {
      // handleVerify already surfaces errors via modal
    }
  };

  const handleVerify = async (overrideToken) => {
    const toVerify = String(overrideToken ?? token).trim();
    if (!toVerify || loading) return;

    setLoading(true);
    setResult(null);
    try {
      const headers = await getAuthHeaders();

      const response = await fetch('/api/beneficiary-cards/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ token: toVerify }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        openAlert({ title: 'Verification failed', message: String(payload?.error || 'Verification failed.') });
        return;
      }

      setResult(payload?.data || null);
    } catch (err) {
      const msg = String(err?.message || err || 'Unknown error');
      console.warn('Verify card failed:', msg);
      openAlert({ title: 'Verification failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const openDecisionModal = (type) => {
    setDecisionType(type);
    setRemarks('');
    setShowDecisionModal(true);
  };

  const openRequirementDocument = async (pathOrUrl) => {
    if (!pathOrUrl) return;

    try {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        openDocumentPreview(pathOrUrl, pathOrUrl);
        return;
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/documents/view?path=${encodeURIComponent(pathOrUrl)}`, {
        headers,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Unable to open document.');
      }

      const url = payload?.data?.url;
      if (!url) throw new Error('Unable to open document.');

      openDocumentPreview(url, pathOrUrl);
    } catch (err) {
      openAlert({
        title: 'Open document failed',
        message: err?.message || 'Unable to open the uploaded document. Please try again.',
      });
    }
  };

  const toggleVerificationRequirement = (index) => {
    setResult((prev) => {
      const currentRequest = prev?.latestAssistanceRequest;
      if (!currentRequest) return prev;

      const current = parseChecklist(currentRequest.requirements_checklist);
      const next = current.map((item, idx) =>
        idx === index
          ? {
              ...item,
              checked: !isCheckedRequirement(item),
            }
          : item,
      );

      return {
        ...prev,
        latestAssistanceRequest: {
          ...currentRequest,
          requirements_checklist: next,
          requirements_completed: getRequirementsCompleted(next, currentRequest.requirements_completed),
        },
      };
    });
  };

  const getDecisionTitle = () =>
    decisionType === 'approve'
      ? 'Approve Request'
      : decisionType === 'archive'
        ? 'Mark Incomplete Request'
        : decisionType === 'unarchive'
          ? 'Reopen Request'
          : 'Mark as Released';

  const getDecisionQuestion = () =>
    decisionType === 'approve'
      ? 'Approve this assistance request?'
      : decisionType === 'archive'
        ? 'Mark this assistance request as incomplete?'
        : decisionType === 'unarchive'
          ? 'Reopen this assistance request?'
          : 'Mark this assistance request as released?';

  const getConfirmLabel = () =>
    decisionType === 'approve'
      ? 'Confirm Approval'
      : decisionType === 'archive'
        ? 'Confirm Mark Incomplete'
        : decisionType === 'unarchive'
          ? 'Confirm Reopen'
          : 'Confirm Release';

  const handleConfirmDecision = async () => {
    if (!latestAssistanceRequest || !decisionType || isUpdatingStatus) return;

    const newStatus =
      decisionType === 'approve'
        ? 'Approved'
        : decisionType === 'archive'
          ? 'Rejected'
          : decisionType === 'unarchive'
            ? 'Pending'
            : 'Released';

    const currentStatus = latestAssistanceRequest.status;
    if (
      (decisionType === 'approve' || decisionType === 'archive') &&
      !['Pending', 'Resubmitted'].includes(currentStatus)
    ) {
      openAlert({
        title: 'Action not allowed',
        message: 'Only pending/resubmitted requests can be approved or marked incomplete.',
      });
      return;
    }

    if (decisionType === 'release' && currentStatus !== 'Approved') {
      openAlert({
        title: 'Action not allowed',
        message: 'Only approved requests can be marked as released.',
      });
      return;
    }

    if (decisionType === 'unarchive' && !isIncompleteStatus(currentStatus)) {
      openAlert({
        title: 'Action not allowed',
        message: 'Only incomplete requests can be reopened.',
      });
      return;
    }

    const requestKey = latestAssistanceRequest.id || latestAssistanceRequest.control_number;
    if (!requestKey) {
      openAlert({
        title: 'Action failed',
        message: 'Missing request id. Please verify the QR again and try once more.',
      });
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/assistance-requests/${encodeURIComponent(requestKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          status: newStatus,
          decision_remarks: remarks || null,
          control_number: latestAssistanceRequest.control_number || null,
          resident_control_number: resident?.control_number || null,
          request_id: latestAssistanceRequest.id || null,
          requirements_checklist: parseChecklist(latestAssistanceRequest.requirements_checklist),
          requirements_completed: getRequirementsCompleted(
            parseChecklist(latestAssistanceRequest.requirements_checklist),
            latestAssistanceRequest.requirements_completed,
          ),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Failed to update assistance request.');
      }

      setShowDecisionModal(false);
      setShowLatestRequestModal(false);
      setDecisionType(null);
      setRemarks('');
      await handleVerify(token);
      openAlert({
        title: 'Request updated',
        message: `Request ${latestAssistanceRequest.control_number || requestKey} has been ${getRequestStatusLabel(newStatus).toLowerCase()}.`,
      });
    } catch (err) {
      openAlert({
        title: 'Action failed',
        message: String(err?.message || err || 'Failed to update assistance request.'),
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const badge = result?.valid ? styles.badgeValid : styles.badgeInvalid;
  const resident = result?.resident;
  const releasedHistory = Array.isArray(result?.releasedHistory) ? result.releasedHistory : [];
  const latestAssistanceRequest = result?.latestAssistanceRequest || null;
  const sectors = getSectors(resident);
  const latestRequestFooter = latestAssistanceRequest ? (
    ['Pending', 'Resubmitted'].includes(latestAssistanceRequest.status) ? (
      <div className={styles.modalFooter}>
        <Button variant="secondary" onClick={() => setShowLatestRequestModal(false)}>
          Close
        </Button>
        <Button variant="secondary" onClick={() => openDecisionModal('archive')}>
          Mark Incomplete
        </Button>
        <Button onClick={() => openDecisionModal('approve')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Approve
        </Button>
      </div>
    ) : isIncompleteStatus(latestAssistanceRequest.status) ? (
      <div className={styles.modalFooter}>
        <Button variant="secondary" onClick={() => setShowLatestRequestModal(false)}>
          Close
        </Button>
        <Button onClick={() => openDecisionModal('unarchive')}>Reopen</Button>
      </div>
    ) : latestAssistanceRequest.status === 'Approved' ? (
      <div className={styles.modalFooter}>
        <Button variant="secondary" onClick={() => setShowLatestRequestModal(false)}>
          Close
        </Button>
        <Button onClick={() => openDecisionModal('release')}>Mark as Released</Button>
      </div>
    ) : (
      <Button variant="secondary" onClick={() => setShowLatestRequestModal(false)}>
        Close
      </Button>
    )
  ) : (
    <Button variant="secondary" onClick={() => setShowLatestRequestModal(false)}>
      Close
    </Button>
  );

  const historyColumns = [
    {
      key: 'control_number',
      label: 'Control No.',
      render: (value) => <span className={styles.historyControlNo}>{value || '-'}</span>,
    },
    {
      key: 'assistance_type',
      label: 'Type',
      render: (_, row) => getAssistanceTypeLabel(row),
    },
    { key: 'requester_name', label: 'Requester' },
    { key: 'beneficiary_name', label: 'Beneficiary' },
    {
      key: 'request_date',
      label: 'Date',
      render: (_, row) => formatDate(row.request_date || row.created_at),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => <span className={styles.historyAmount}>₱{formatAmount(value)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <Badge variant="success">Released</Badge>,
    },
  ];

  const historyRows = releasedHistory.map((row) => ({
    id: row.id,
    control_number: row.control_number,
    assistance_type: getAssistanceTypeLabel(row),
    requester_name: row.requester_name || '-',
    beneficiary_name: row.beneficiary_name || '-',
    request_date: row.request_date || row.created_at,
    amount: row.amount,
    status: row.status,
  }));

  return (
    <div className={styles.page}>
      <PageHeader
        title="Verify Beneficiary ID (QR)"
        subtitle="Scan the QR or enter the card reference number to verify if the beneficiary ID is valid and not expired/revoked."
      />

      <Card>
        <label className={styles.label} htmlFor="cardRef">
          Card Reference
        </label>
        <input
          id="cardRef"
          className={styles.input}
          type="text"
          value={token}
          onChange={(e) => setToken(normalizeCardReferenceInput(e.target.value))}
          placeholder="Enter card reference"
        />

        <div className={styles.actions}>
          <Button
            onClick={() => {
              setScanSession((value) => value + 1);
              setScanOpen(true);
            }}
            disabled={loading}
          >
            Scan QR
          </Button>
          <Button onClick={() => handleVerify()} disabled={loading || !token.trim()}>
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setToken('');
              setResult(null);
            }}
            disabled={loading}
          >
            Clear
          </Button>
        </div>

        {result && (
          <div className={styles.resultBox}>
            <div className={styles.resultHeader}>
              <span className={`${styles.badge} ${badge}`}>{result.valid ? 'VALID' : 'INVALID'}</span>
              {!result.valid && result.reason && (
                <span className={styles.reason}>
                  Reason:{' '}
                  {result.reason === 'not_setup'
                    ? 'QR ID not enabled (setup required)'
                    : result.reason === 'card_not_found'
                    ? 'Card reference not found'
                    : String(result.reason).replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {result.profileWarning ? (
              <p className={styles.profileWarning}>{result.profileWarning}</p>
            ) : null}

            {result.card && (
              <div className={styles.grid} style={{ marginBottom: 12 }}>
                <div>
                  <div className={styles.k}>Issued</div>
                  <div className={styles.v}>{formatDateTime(result.card.issued_at)}</div>
                </div>
                <div>
                  <div className={styles.k}>Expires</div>
                  <div className={styles.v}>{formatDateTime(result.card.expires_at)}</div>
                </div>
              </div>
            )}

            {resident ? (
              <>
                <div className={styles.profileHeader}>
                  <div>
                    <h2 className={styles.profileName}>{buildName(resident)}</h2>
                    <p className={styles.profileMeta}>
                      Control No. {displayValue(resident.control_number)} · Contact{' '}
                      {displayValue(resident.contact_number)}
                    </p>
                  </div>
                  <Badge variant={resident.status === 'Active' ? 'success' : 'secondary'}>
                    {displayValue(resident.status)}
                  </Badge>
                </div>

                <section className={styles.latestRequestSection}>
                  <div className={styles.historyHeader}>
                    <h3 className={styles.sectionTitle}>Latest Assistance Request</h3>
                    <div className={styles.latestRequestActions}>
                      {latestAssistanceRequest?.status ? (
                        <Badge variant={getRequestStatusVariant(latestAssistanceRequest.status)}>
                          {getRequestStatusLabel(latestAssistanceRequest.status)}
                        </Badge>
                      ) : null}
                      {latestAssistanceRequest ? (
                        <button
                          type="button"
                          className={styles.latestRequestActionButton}
                          onClick={() => setShowLatestRequestModal(true)}
                          title="View Details"
                          aria-label="View assistance request details"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {latestAssistanceRequest ? (
                    <div className={styles.infoGrid}>
                      <InfoRow label="Request Control No." value={displayValue(latestAssistanceRequest.control_number)} />
                      <InfoRow label="Assistance Type" value={getAssistanceTypeLabel(latestAssistanceRequest)} />
                      <InfoRow label="Requester" value={displayValue(latestAssistanceRequest.requester_name)} />
                      <InfoRow label="Beneficiary" value={displayValue(latestAssistanceRequest.beneficiary_name)} />
                      <InfoRow label="Amount" value={`₱${formatAmount(latestAssistanceRequest.amount)}`} />
                      <InfoRow label="Request Date" value={formatDate(latestAssistanceRequest.request_date)} />
                      <InfoRow label="Request Source" value={displayValue(latestAssistanceRequest.request_source)} />
                      <InfoRow label="Processed By" value={displayValue(latestAssistanceRequest.processed_by)} />
                      <InfoRow label="Created" value={formatDateTime(latestAssistanceRequest.created_at)} />
                      <InfoRow label="Remarks" value={displayValue(latestAssistanceRequest.decision_remarks)} />
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>No assistance request found.</p>
                  )}
                </section>

                <div className={styles.infoSections}>
                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Address</h3>
                    <div className={styles.infoGrid}>
                      <InfoRow label="Complete Address" value={formatAddress(resident)} />
                      <InfoRow label="House No." value={displayValue(resident.house_no)} />
                      <InfoRow label="Purok" value={displayValue(resident.purok)} />
                      <InfoRow label="Barangay" value={displayValue(resident.barangay)} />
                      <InfoRow label="City/Municipality" value={displayValue(resident.city)} />
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Personal Information</h3>
                    <div className={styles.infoGrid}>
                      <InfoRow label="Birthday" value={formatDate(resident.birthday)} />
                      <InfoRow label="Birthplace" value={displayValue(resident.birthplace)} />
                      <InfoRow label="Sex" value={displayValue(resident.sex)} />
                      <InfoRow label="Citizenship" value={displayValue(resident.citizenship)} />
                      <InfoRow label="Civil Status" value={displayValue(resident.civil_status)} />
                      <InfoRow
                        label="Age"
                        value={(() => {
                          const age = computeAge(resident.birthday, resident.age);
                          return age == null ? '-' : String(age);
                        })()}
                      />
                      <InfoRow label="Registered" value={formatDate(resident.created_at)} />
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <h3 className={styles.sectionTitle}>Sector Classification</h3>
                    {sectors.length ? (
                      <div className={styles.sectorBadges}>
                        {sectors.map((sector) => (
                          <Badge key={sector} variant="secondary">
                            {sector}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyHint}>General</p>
                    )}
                  </section>

                  {(resident.representative_name || resident.representative_contact) && (
                    <section className={styles.infoSection}>
                      <h3 className={styles.sectionTitle}>Representative</h3>
                      <div className={styles.infoGrid}>
                        <InfoRow label="Name" value={displayValue(resident.representative_name)} />
                        <InfoRow label="Contact" value={displayValue(resident.representative_contact)} />
                      </div>
                    </section>
                  )}
                </div>

                <section className={styles.historySection}>
                  <div className={styles.historyHeader}>
                    <h3 className={styles.sectionTitle}>Released Assistance History</h3>
                    <span className={styles.historyCount}>
                      {releasedHistory.length} record{releasedHistory.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {releasedHistory.length ? (
                    <div className={styles.historyTableWrap}>
                      <Table columns={historyColumns} data={historyRows} />
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>No released assistance requests on record.</p>
                  )}
                </section>
              </>
            ) : null}
          </div>
        )}
      </Card>

      <Modal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan QR"
        footer={
          <Button variant="secondary" onClick={() => setScanOpen(false)}>
            Close
          </Button>
        }
      >
        {scanOpen ? (
          <QrScanner
            key={`scan-${scanSession}`}
            onDetected={handleScanDetected}
            onClose={() => setScanOpen(false)}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={showLatestRequestModal && !!latestAssistanceRequest}
        onClose={() => setShowLatestRequestModal(false)}
        title="Request Details"
        size="large"
        footer={latestRequestFooter}
      >
        {latestAssistanceRequest ? (
          <div className={styles.requestDetails}>
            {(() => {
              const norm = (v) => String(v || '').trim().toLowerCase();
              const residentName = buildName(resident);
              const residentAddress = formatAddress(resident);
              const beneficiary = latestAssistanceRequest.beneficiary_name || residentName || '';
              const beneficiaryContact =
                latestAssistanceRequest.beneficiary_contact || resident?.contact_number || '';
              const beneficiaryAddress =
                latestAssistanceRequest.beneficiary_address || residentAddress || '';
              let requester = latestAssistanceRequest.requester_name || beneficiary;
              let requesterContact = latestAssistanceRequest.requester_contact || beneficiaryContact;
              let requesterAddress = latestAssistanceRequest.requester_address || beneficiaryAddress;

              if (
                (!requester || norm(requester) === norm(beneficiary)) &&
                resident?.representative_name &&
                norm(resident.representative_name) !== norm(beneficiary)
              ) {
                requester = resident.representative_name;
                if (!requesterContact || norm(requesterContact) === norm(beneficiaryContact)) {
                  requesterContact = resident.representative_contact || requesterContact;
                }
              }

              const samePerson =
                norm(requester) === norm(beneficiary) &&
                norm(requesterContact) === norm(beneficiaryContact) &&
                norm(requesterAddress) === norm(beneficiaryAddress);
              const latestChecklist = parseChecklist(latestAssistanceRequest.requirements_checklist);
              const verificationCompleted = getRequirementsCompleted(
                latestChecklist,
                latestAssistanceRequest.requirements_completed,
              );
              const requirementFiles = getRequirementFiles(latestAssistanceRequest);
              const requestSource = String(latestAssistanceRequest.request_source || 'online').toLowerCase();
              const sectorText = sectors.length ? sectors.join(', ') : 'None';

              return (
                <>
                  <div className={styles.detailsHeader}>
                    <div className={styles.controlNumber}>
                      {displayValue(latestAssistanceRequest.control_number)}
                    </div>
                    <Badge variant={getRequestStatusVariant(latestAssistanceRequest.status)}>
                      {getRequestStatusLabel(latestAssistanceRequest.status)}
                    </Badge>
                  </div>

                  {samePerson ? (
                    <div className={styles.detailsGrid}>
                      <div className={styles.detailSection}>
                        <h4>Beneficiary (Self-request)</h4>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Name:</span>
                          <span className={styles.detailValue}>{displayValue(requester)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Contact:</span>
                          <span className={styles.detailValue}>{displayValue(requesterContact)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Address:</span>
                          <span className={styles.detailValue}>{displayValue(requesterAddress)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Note:</span>
                          <span className={styles.detailValue}>
                            No representative. The beneficiary requested directly.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.detailsGrid}>
                      <div className={styles.detailSection}>
                        <h4>Representative Information</h4>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Name:</span>
                          <span className={styles.detailValue}>{displayValue(requester)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Contact:</span>
                          <span className={styles.detailValue}>{displayValue(requesterContact)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Address:</span>
                          <span className={styles.detailValue}>{displayValue(requesterAddress)}</span>
                        </div>
                      </div>

                      <div className={styles.detailSection}>
                        <h4>Beneficiary Information</h4>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Name:</span>
                          <span className={styles.detailValue}>{displayValue(beneficiary)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Contact:</span>
                          <span className={styles.detailValue}>{displayValue(beneficiaryContact)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Address:</span>
                          <span className={styles.detailValue}>{displayValue(beneficiaryAddress)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={styles.detailSection}>
                    <h4>Beneficiary Personal Information</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Control No:</span>
                      <span className={styles.detailValue}>{displayValue(resident?.control_number)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Birthday:</span>
                      <span className={styles.detailValue}>{formatDate(resident?.birthday)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Birthplace:</span>
                      <span className={styles.detailValue}>{displayValue(resident?.birthplace)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Sex:</span>
                      <span className={styles.detailValue}>{displayValue(resident?.sex)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Citizenship:</span>
                      <span className={styles.detailValue}>{displayValue(resident?.citizenship)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Civil Status:</span>
                      <span className={styles.detailValue}>{displayValue(resident?.civil_status)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Sectors:</span>
                      <span className={styles.detailValue}>{sectorText}</span>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h4>Remarks</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Decision Remarks:</span>
                      <span className={styles.detailValue}>
                        {displayValue(latestAssistanceRequest.decision_remarks || 'None')}
                      </span>
                    </div>
                  </div>

                  <div className={styles.assistanceInfo}>
                    <div className={styles.infoCard}>
                      <span className={styles.infoLabel}>Type of Assistance</span>
                      <span className={styles.infoValue}>
                        {getAssistanceTypeLabel(latestAssistanceRequest)}
                      </span>
                    </div>
                    <div className={styles.infoCard}>
                      <span className={styles.infoLabel}>Amount</span>
                      <span className={styles.infoValue}>₱{formatAmount(latestAssistanceRequest.amount)}</span>
                    </div>
                    <div className={styles.infoCard}>
                      <span className={styles.infoLabel}>Date Filed</span>
                      <span className={styles.infoValue}>
                        {formatDate(latestAssistanceRequest.request_date || latestAssistanceRequest.created_at)}
                      </span>
                    </div>
                    <div className={styles.infoCard}>
                      <span className={styles.infoLabel}>Processed By</span>
                      <span className={styles.infoValue}>
                        {formatProcessedBy(latestAssistanceRequest.processed_by)}
                      </span>
                    </div>
                    <div className={`${styles.infoCard} ${styles.wideInfoCard}`}>
                      <span className={styles.infoLabel}>Requirements Verification</span>
                      <div className={`${styles.infoValue} ${styles.requirementsContent}`}>
                        <div className={styles.verificationPanel}>
                          <p className={styles.verificationHeading}>Requirements Verification Checklist</p>
                          <div className={styles.verificationChecklist}>
                            {latestChecklist.length ? (
                              latestChecklist.map((item, idx) => (
                                <label key={String(item?.label || idx)} className={styles.verificationRow}>
                                  <input
                                    type="checkbox"
                                    checked={isCheckedRequirement(item)}
                                    onChange={() => toggleVerificationRequirement(idx)}
                                  />
                                  <span>{item?.label || `Requirement ${idx + 1}`}</span>
                                </label>
                              ))
                            ) : (
                              <span className={styles.verificationEmpty}>
                                No checklist available for this request.
                              </span>
                            )}
                          </div>
                          <div className={styles.verificationStatus}>
                            Status: {verificationCompleted ? 'COMPLETED' : 'INCOMPLETE'}
                          </div>
                        </div>

                        {requestSource === 'online' ? (
                          <div className={styles.uploadedDocsSection}>
                            <p className={styles.uploadedDocsHeading}>
                              Attached Documents: View all submitted files for verification.
                            </p>
                            {requirementFiles.length ? (
                              <div className={styles.uploadedDocsList}>
                                {requirementFiles.map((file, idx) => (
                                  <div key={`${file.file_url}-${idx}`} className={styles.uploadedDocItem}>
                                    <div className={styles.uploadedDocMeta}>
                                      <span className={styles.uploadedDocName}>
                                        {file.file_name || `Document ${idx + 1}`}
                                      </span>
                                      <span className={styles.uploadedDocType}>
                                        {isLikelyImage(file.file_url) ? 'Image' : 'Document'}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className={styles.validIdLink}
                                      onClick={() => openRequirementDocument(file.file_url)}
                                    >
                                      View Document {idx + 1}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.verificationEmpty}>
                                No uploaded files found for this online request.
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className={styles.walkInNotice}>
                            Requirements submitted physically (walk-in). Please verify each item.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <DocumentPreviewModal
        isOpen={documentPreview.open}
        onClose={closeDocumentPreview}
        url={documentPreview.url}
        path={documentPreview.path}
      />

      <Modal
        isOpen={showDecisionModal && !!latestAssistanceRequest}
        onClose={() => {
          if (!isUpdatingStatus) setShowDecisionModal(false);
        }}
        title={getDecisionTitle()}
        size="small"
        footer={
          <div className={styles.modalFooter}>
            <Button
              variant="secondary"
              onClick={() => setShowDecisionModal(false)}
              disabled={isUpdatingStatus}
            >
              Cancel
            </Button>
            <Button
              variant={decisionType === 'archive' ? 'secondary' : 'primary'}
              onClick={handleConfirmDecision}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? 'Saving...' : getConfirmLabel()}
            </Button>
          </div>
        }
      >
        {latestAssistanceRequest ? (
          <div className={styles.decisionContent}>
            <div
              className={styles.decisionIcon}
              style={{
                backgroundColor:
                  decisionType === 'approve'
                    ? '#dcfce7'
                    : decisionType === 'archive'
                      ? '#fee2e2'
                      : '#dbeafe',
                color:
                  decisionType === 'approve'
                    ? '#16a34a'
                    : decisionType === 'archive'
                      ? '#dc2626'
                      : '#2563eb',
              }}
            >
              {decisionType === 'approve' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : decisionType === 'archive' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : decisionType === 'unarchive' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8v13H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M12 12v5" />
                  <path d="M9 15l3 3 3-3" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3h5a4 4 0 0 1 0 8H8" />
                  <line x1="8" y1="3" x2="8" y2="21" />
                  <line x1="8" y1="7" x2="16" y2="7" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                </svg>
              )}
            </div>
            <h4 className={styles.decisionTitle}>{getDecisionQuestion()}</h4>
            <p className={styles.decisionDesc}>
              Control No: <strong>{displayValue(latestAssistanceRequest.control_number)}</strong>
              <br />
              Requester: <strong>{displayValue(latestAssistanceRequest.requester_name)}</strong>
              <br />
              Amount: <strong>₱{formatAmount(latestAssistanceRequest.amount)}</strong>
              {decisionType === 'archive' ? (
                <>
                  <br />
                  <br />
                  The request will be marked incomplete, not deleted. You can reopen it from the Incomplete list.
                </>
              ) : null}
            </p>
            <div className={styles.remarksSection}>
              <label className={styles.remarksLabel} htmlFor="qrDecisionRemarks">
                Remarks (Optional)
              </label>
              <textarea
                id="qrDecisionRemarks"
                className={styles.remarksInput}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  decisionType === 'approve'
                    ? 'Add any notes for this approval...'
                    : decisionType === 'archive'
                      ? 'List missing documents or requirements (sent via SMS)...'
                      : 'Add any notes (optional)...'
                }
                rows={3}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={<Button onClick={closeAlert}>OK</Button>}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>
    </div>
  );
}

function QrScanner({ onDetected, onClose }) {
  const [starting, setStarting] = useState(true);
  const [scannerError, setScannerError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    let active = true;

    const stop = (resetReader = true) => {
      try {
        controlsRef.current?.stop?.();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      try {
        if (resetReader) readerRef.current?.reset?.();
      } catch {
        // ignore
      }
      try {
        const video = videoRef.current;
        const stream = video?.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // ignore
            }
          });
        }
        if (video) video.srcObject = null;
      } catch {
        // ignore
      }
    };

    const choosePreferredCamera = (devices) => {
      if (!devices?.length) return '';
      const preferred =
        devices.find((d) => /back|rear|environment/i.test(String(d.label || ''))) ||
        devices[devices.length - 1] ||
        devices[0];
      return preferred?.deviceId || '';
    };

    const startWithDevice = async (deviceId) => {
      const reader = readerRef.current;
      if (!reader || !videoRef.current) return;

      stop(false);

      controlsRef.current = await reader.decodeFromVideoDevice(deviceId || undefined, videoRef.current, (scanResult) => {
        if (!active) return;
        if (scanResult) {
          stop();
          onDetected?.(scanResult.getText());
        }
      });
    };

    const getFallbackVideoDevices = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    };

    const formatScannerError = (e) => {
      const name = String(e?.name || '');
      const rawMsg = String(e?.message || e || 'Failed to start scanner.');

      if (name === 'NotAllowedError') {
        return 'Camera permission denied. Allow camera access in your browser settings, then try again.';
      }
      if (name === 'NotFoundError') {
        return 'No camera found on this device.';
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'Your camera is busy. Close other apps or browser tabs using the camera (Zoom, Teams, Camera, another Chrome tab), wait a few seconds, then tap Retry.';
      }
      if (!window.isSecureContext) {
        return 'Camera requires HTTPS or localhost.';
      }
      if (rawMsg.toLowerCase().includes('video source')) {
        return 'Could not start the camera. Close other apps using it, wait a few seconds, then tap Retry.';
      }
      if (rawMsg.toLowerCase().includes('no camera devices')) {
        return 'No camera found on this device.';
      }
      return rawMsg;
    };

    const start = async () => {
      setScannerError('');
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support camera access.');
        }

        const mod = await import('@zxing/browser');
        const { BrowserQRCodeReader } = mod;

        readerRef.current = new BrowserQRCodeReader();

        let devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (!devices?.length) {
          devices = await getFallbackVideoDevices();
        }
        const preferredId = choosePreferredCamera(devices);

        setCameras(devices || []);
        setSelectedDeviceId(preferredId || '');
        await startWithDevice(preferredId);
        if (active) setStarting(false);
      } catch (e) {
        if (!active) return;
        setStarting(false);
        stop();
        setScannerError(formatScannerError(e));
      }
    };

    start();

    return () => {
      active = false;
      stop();
    };
  }, [onDetected, retryKey]);

  const switchCamera = async (deviceId) => {
    const nextId = String(deviceId || '');
    if (!nextId || nextId === selectedDeviceId || !readerRef.current || !videoRef.current) return;

    setStarting(true);
    setSelectedDeviceId(nextId);
    try {
      try {
        controlsRef.current?.stop?.();
      } catch {
        // ignore
      }
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(nextId, videoRef.current, (scanResult) => {
        if (scanResult) {
          try {
            controlsRef.current?.stop?.();
          } catch {
            // ignore
          }
          try {
            readerRef.current?.reset?.();
          } catch {
            // ignore
          }
          onDetected?.(scanResult.getText());
        }
      });
    } catch (e) {
      setScannerError(String(e?.message || e || 'Failed to switch camera.'));
    } finally {
      setStarting(false);
    }
  };

  const handleFlip = async () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedDeviceId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cameras.length : 0;
    await switchCamera(cameras[nextIndex]?.deviceId);
  };

  if (scannerError) {
    return (
      <div className={styles.scannerWrap}>
        <p className={styles.scannerError}>{scannerError}</p>
        <div className={styles.scannerErrorActions}>
          <Button
            type="button"
            onClick={() => {
              setScannerError('');
              setStarting(true);
              setRetryKey((value) => value + 1);
            }}
          >
            Retry
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scannerWrap}>
      <div className={styles.scannerControls}>
        <select
          className={styles.cameraSelect}
          value={selectedDeviceId}
          onChange={(e) => switchCamera(e.target.value)}
          disabled={starting || cameras.length === 0}
        >
          {cameras.length === 0 ? (
            <option value="">No camera detected</option>
          ) : (
            cameras.map((device, index) => {
              const optionKey = `${device.deviceId || device.label || 'camera'}-${index}`;

              return (
                <option key={optionKey} value={device.deviceId || ''}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              );
            })
          )}
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={handleFlip}
          disabled={starting || cameras.length < 2}
        >
          Flip Camera
        </Button>
      </div>
      <video ref={videoRef} className={styles.video} />
      <div className={styles.scanHint}>
        {starting
          ? 'Starting camera…'
          : 'Point the camera at the QR code. Verification will start automatically.'}
      </div>
    </div>
  );
}
