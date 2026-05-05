'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  buildRequirementsMap,
  getLocalRequirementsMap,
  getRequirementsForType,
  isMissingRequirementsColumn,
} from '@/lib/assistanceRequirements';
import {
  Card,
  Select,
  Table,
  Badge,
  Button,
  PageHeader,
  SearchInput,
  FilterBar,
  DataTableFooter,
  Modal,
} from '@/components';
import styles from './page.module.css';

// Requests are loaded from the `assistance_requests` table in Supabase.
// Shape in state: { id, controlNo, requester, requesterContact, beneficiary, beneficiaryContact, type, amount, rawAmount, status, date, processedBy }

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'Medicine Assistance', label: 'Medicine Assistance' },
  { value: 'Confinement Assistance', label: 'Confinement Assistance' },
  { value: 'Burial Assistance', label: 'Burial Assistance' },
  { value: 'Others', label: 'Others' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Resubmitted', label: 'Resubmitted' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Released', label: 'Released' },
  { value: 'Incomplete', label: 'Incomplete' },
];

const isCheckedRequirement = (item) => {
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
};

const toBoolean = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
};

const getRequirementsCompleted = (checklist, fallbackValue) => {
  if (Array.isArray(checklist) && checklist.length > 0) {
    return checklist.every(isCheckedRequirement);
  }

  return toBoolean(fallbackValue) === true;
};

const getExpectedChecklist = (assistanceType, requirementsByType) => {
  const expected = getRequirementsForType(assistanceType, requirementsByType);

  return expected.map((label) => ({
    label,
    checked: true,
  }));
};

const parseRequirementFiles = (value) => {
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
};

const getFileNameFromUrl = (fileUrl) => {
  const raw = String(fileUrl || '').trim();
  if (!raw) return 'Document';
  const cleaned = raw.split('?')[0];
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Document';
};

const isLikelyImage = (fileUrl) => /\.(png|jpe?g|gif|webp)$/i.test(String(fileUrl || ''));

const parseLegacyRequirementUrls = (value) => {
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
};

export default function RequestsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [alertState, setAlertState] = useState({
    open: false,
    title: '',
    message: '',
    variant: 'info', // info | success | error
  });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [requirementsByType, setRequirementsByType] = useState({});

  useEffect(() => {
    const loadRequirements = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, requirements');

        if (error) {
          if (isMissingRequirementsColumn(error)) {
            setRequirementsByType(getLocalRequirementsMap());
            return;
          }
          console.warn('Error loading assistance requirements', error.message);
          setRequirementsByType(getLocalRequirementsMap());
          return;
        }
        setRequirementsByType(buildRequirementsMap(data || []));
      } catch (err) {
        console.warn('Unexpected error loading assistance requirements', err);
        setRequirementsByType(getLocalRequirementsMap());
      }
    };

    loadRequirements();
  }, []);

  const openAlert = ({ title, message, variant = 'info' }) => {
    setAlertState({ open: true, title, message, variant });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const getStatusLabel = (dbStatus) => (dbStatus === 'Rejected' ? 'Incomplete' : dbStatus);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const response = await fetch('/api/assistance-requests');
        const result = await response.json();

        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Failed to load assistance requests.');
        }

        const rows = Array.isArray(result.data) ? result.data : [];

        const mapped = rows.map((r) => {
          const resident = r.residents || {};

          const residentName = [resident.first_name, resident.middle_name, resident.last_name]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(' ');

          const residentAddress = [
            resident.house_no,
            resident.purok,
            resident.street,
            resident.barangay,
            resident.city,
          ]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(', ');

          const parseRequirements = (value) => {
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
                      if (item && typeof item === 'object') {
                        return String(item.file_url || item.fileUrl || '').trim();
                      }
                      return '';
                    })
                    .filter(Boolean);
                }
              } catch {
                // ignore
              }
            }
            return [];
          };

          const parseChecklist = (value) => {
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
          };

          const savedRequirementsChecklist = parseChecklist(r.requirements_checklist);
          const requirementsChecklistSource = savedRequirementsChecklist.length ? 'saved' : 'expected';
          const requirementsChecklist = savedRequirementsChecklist.length
            ? savedRequirementsChecklist
            : getExpectedChecklist(r.assistance_type, requirementsByType);
          // Completed is allowed only when every checklist item is checked.
          // Missing or partially unchecked verification data is treated as Incomplete.
          const requirementsCompleted = getRequirementsCompleted(
            requirementsChecklist,
            r.requirements_completed,
          );

          const requirements = parseRequirements(r.requirements_urls);
          const requirementFileRows = parseRequirementFiles(r.requirements_files);
          const legacySingle = parseLegacyRequirementUrls(r.valid_id_url);
          const requirementUrls = requirements.length ? requirements : legacySingle;
          const normalizedRequirementFiles = requirementFileRows
            .map((row) => {
              const fileUrl = String(row?.file_url || row?.fileUrl || '').trim();
              if (!fileUrl) return null;
              return {
                file_url: fileUrl,
                file_name: String(row?.file_name || row?.fileName || '').trim() || getFileNameFromUrl(fileUrl),
                requirement_type: row?.requirement_type || row?.requirementType || null,
              };
            })
            .filter(Boolean);

          // Merge both sources because older records can have partial requirements_files
          // while requirements_urls/legacy valid_id_url still contains the full set.
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
          normalizedRequirementFiles.forEach((file) => {
            if (!file?.file_url) return;
            requirementMap.set(file.file_url, file);
          });
          let requirementFiles = Array.from(requirementMap.values());
          const maxRequirementFiles = requirementsChecklist.length || 0;
          if (maxRequirementFiles > 0 && requirementFiles.length > maxRequirementFiles) {
            requirementFiles = requirementFiles.slice(0, maxRequirementFiles);
          }

          const sectors = {
            pwd: !!resident.is_pwd,
            seniorCitizen: !!resident.is_senior_citizen,
            soloParent: !!resident.is_solo_parent,
          };

          const sectorLabels = [];
          if (sectors.pwd) sectorLabels.push('PWD');
          if (sectors.seniorCitizen) sectorLabels.push('Senior Citizen');
          if (sectors.soloParent) sectorLabels.push('Solo Parent');

          const status = r.status || 'Pending';
          const requestKey = r.id || r.request_id || r.control_number;

          const norm = (v) => String(v || '').trim().toLowerCase();

          const beneficiary = r.beneficiary_name || residentName || '';
          const beneficiaryContact = r.beneficiary_contact || resident.contact_number || '';
          const beneficiaryAddress = r.beneficiary_address || residentAddress || '';

          let representative = r.requester_name || '';
          let representativeContact = r.requester_contact || '';
          let representativeAddress = r.requester_address || '';

          // If the request stored the beneficiary as the requester (older behavior), but the resident profile
          // has a representative, prefer that for display.
          if (
            (!representative || norm(representative) === norm(beneficiary)) &&
            resident.representative_name &&
            norm(resident.representative_name) !== norm(beneficiary)
          ) {
            representative = resident.representative_name;
            if (!representativeContact || norm(representativeContact) === norm(beneficiaryContact)) {
              representativeContact = resident.representative_contact || representativeContact;
            }
          }

          representative = representative || beneficiary;
          representativeContact = representativeContact || beneficiaryContact;
          representativeAddress = representativeAddress || beneficiaryAddress;

          return {
            id: requestKey,
            controlNo: resident.control_number || r.control_number,
            requestControlNo: r.control_number,
            requester: representative,
            requesterContact: representativeContact,
            requesterAddress: representativeAddress,
            beneficiary,
            beneficiaryContact,
            beneficiaryAddress,
            type: r.assistance_type,
            amount: r.amount,
            rawAmount: r.amount,
            requestDateRaw: r.request_date || r.created_at || null,
            validIdUrl: r.valid_id_url || null,
            requirementUrls,
            requirementFiles,
            attachmentCount: requirementFiles.length,
            requestSource: r.request_source || 'online',
            requirementsChecklist,
            requirementsCompleted,
            requirementsChecklistSource,
            status,
            statusLabel: getStatusLabel(status),
            date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
            processedBy: r.processed_by || '',
            decisionRemarks: r.decision_remarks || '',
            residentControlNumber: resident.control_number || '',
            residentBirthday: resident.birthday ? new Date(resident.birthday).toLocaleDateString() : '',
            residentBirthplace: resident.birthplace || '',
            residentSex: resident.sex || '',
            residentCitizenship: resident.citizenship || '',
            residentCivilStatus: resident.civil_status || '',
            residentRepresentativeName: resident.representative_name || '',
            residentRepresentativeContact: resident.representative_contact || '',
            sectors,
            sectorText: sectorLabels.length ? sectorLabels.join(', ') : 'None',
          };
        });

        setRequests(mapped);
      } catch (err) {
        console.error('Failed to load assistance requests:', err);
        setRequests([]);
        openAlert({
          title: 'Load failed',
          message: err?.message || 'Failed to load assistance requests. Please try again.',
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  useEffect(() => {
    if (!requirementsByType || Object.keys(requirementsByType).length === 0) return;
    setRequests((prev) =>
      prev.map((req) => {
        if (req.requirementsChecklistSource !== 'expected') return req;
        const expected = getExpectedChecklist(req.type, requirementsByType);
        return {
          ...req,
          requirementsChecklist: expected,
          requirementsCompleted: getRequirementsCompleted(expected, req.requirementsCompleted),
        };
      }),
    );
  }, [requirementsByType]);

  // Filter requests
  const filteredRequests = requests.filter((record) => {
    const matchesSearch =
      record.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.controlNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || record.type === typeFilter;
    const matchesStatus =
      !statusFilter || getStatusLabel(record.status) === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const toggleVerificationRequirement = (index) => {
    setSelectedRequest((prev) => {
      if (!prev) return prev;
      const current = Array.isArray(prev.requirementsChecklist) ? prev.requirementsChecklist : [];
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
        requirementsChecklist: next,
        requirementsCompleted: getRequirementsCompleted(next, prev.requirementsCompleted),
      };
    });
  };

  const handleOpenDecision = (request, type) => {
    setSelectedRequest(request);
    setDecisionType(type);
    setRemarks('');
    setShowDecisionModal(true);
  };

  const openValidId = async (pathOrUrl) => {
    if (!pathOrUrl) return;

    try {
      // Legacy: stored as full URL
      if (/^https?:\/\//i.test(pathOrUrl)) {
        window.open(pathOrUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Please sign in again.');
      }

      const res = await fetch(`/api/documents/view?path=${encodeURIComponent(pathOrUrl)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Unable to open document.');
      }

      const url = json?.data?.url;
      if (!url) throw new Error('Unable to open document.');

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      openAlert({
        title: 'Open document failed',
        message: err?.message || 'Unable to open the uploaded ID. Please try again.',
        variant: 'error',
      });
    }
  };

  const handleConfirmDecision = async () => {
    if (!selectedRequest || !decisionType) return;

    const newStatus =
      decisionType === 'approve'
        ? 'Approved'
        : decisionType === 'archive'
          ? 'Rejected'
          : decisionType === 'unarchive'
            ? 'Pending'
            : 'Released';

    // Extra safety guards
    if (
      (decisionType === 'approve' || decisionType === 'archive') &&
      !['Pending', 'Resubmitted'].includes(selectedRequest.status)
    ) {
      setStatus({
        type: 'error',
        message: 'Only pending/resubmitted requests can be approved or marked as incomplete.',
      });
      return;
    }

    if (decisionType === 'release' && selectedRequest.status !== 'Approved') {
      setStatus({
        type: 'error',
        message: 'Only approved requests can be marked as released.',
      });
      return;
    }

    if (decisionType === 'unarchive' && selectedRequest.status !== 'Rejected') {
      setStatus({
        type: 'error',
        message: 'Only incomplete requests can be reopened.',
      });
      return;
    }

    setStatus(null);
    setIsUpdatingStatus(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Unauthorized. Please sign in again.');
      }

      const requestKey = selectedRequest?.requestControlNo || selectedRequest?.id;
      if (!requestKey || requestKey === 'undefined' || requestKey === 'null') {
        throw new Error('Missing request id. Please refresh the page and try again.');
      }

      const response = await fetch(`/api/assistance-requests/${encodeURIComponent(requestKey)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          decision_remarks: remarks || null,
          control_number: selectedRequest?.requestControlNo || null,
          resident_control_number: selectedRequest?.controlNo || null,
          request_id: selectedRequest?.id || null,
          requirements_checklist: selectedRequest?.requirementsChecklist || [],
          requirements_completed: getRequirementsCompleted(
            selectedRequest?.requirementsChecklist,
            selectedRequest?.requirementsCompleted,
          ),
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to update request status.');
      }

      const updatedProcessedBy = result?.data?.processed_by;
      const updatedRemarks = result?.data?.decision_remarks;
      const updatedChecklist = result?.data?.requirements_checklist;
      const updatedCompleted = result?.data?.requirements_completed;

      setRequests((prev) =>
        prev.map((req) =>
          req.requestControlNo === selectedRequest.requestControlNo || req.id === selectedRequest.id
            ? {
                ...req,
                status: newStatus,
                statusLabel: getStatusLabel(newStatus),
                processedBy: updatedProcessedBy ?? req.processedBy,
                decisionRemarks: updatedRemarks ?? req.decisionRemarks,
                requirementsChecklist: Array.isArray(updatedChecklist)
                  ? updatedChecklist
                  : req.requirementsChecklist,
                requirementsCompleted: getRequirementsCompleted(
                  Array.isArray(updatedChecklist)
                    ? updatedChecklist
                    : req.requirementsChecklist,
                  updatedCompleted ?? req.requirementsCompleted,
                ),
              }
            : req,
        ),
      );

      const statusLabel = getStatusLabel(newStatus);
      setStatus({
        type: 'success',
        message: `Request ${selectedRequest.requestControlNo || selectedRequest.controlNo} has been ${
          statusLabel === 'Approved'
            ? 'approved'
            : statusLabel === 'Incomplete'
              ? 'marked as incomplete'
              : statusLabel === 'Pending'
                ? 'reopened'
                : 'marked as released'
        }.`,
      });
    } catch (err) {
      console.error('Failed to update request status:', err);
      openAlert({
        title: 'Update failed',
        message: err?.message || 'Failed to update request status. Please try again.',
        variant: 'error',
      });
      setStatus({
        type: 'error',
        message: 'Failed to update request status. Please try again.',
      });
    } finally {
      setIsUpdatingStatus(false);
      setShowDecisionModal(false);
      setShowViewModal(false);
      setSelectedRequest(null);
      setRemarks('');
    }
  };

  const getStatusBadge = (status) => {
    const label = getStatusLabel(status);
    return <Badge>{label}</Badge>;
  };

  const getTypeBadge = (type) => {
    const variants = {
      'Medicine Assistance': 'green',
      'Confinement Assistance': 'blue',
      'Burial Assistance': 'purple',
      Others: 'secondary',
    };
    return <Badge variant={variants[type] || 'default'}>{type}</Badge>;
  };



  const formatProcessedBy = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    return raw.includes('@') ? raw.split('@')[0] : raw;
  };

  const columns = [
    { key: 'controlNo', label: 'Control No.' },
    { key: 'requester', label: 'Requester' },
    { key: 'beneficiary', label: 'Beneficiary' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => getTypeBadge(type),
    },
    { key: 'date', label: 'Date' },

    { key: 'amount', label: 'Amount' },
    {
      key: 'attachmentCount',
      label: 'Files',
      render: (_, row) =>
        row.requestSource === 'online' ? (
          <Badge variant={row.attachmentCount > 0 ? 'blue' : 'secondary'}>
            {row.attachmentCount > 0 ? `${row.attachmentCount} file${row.attachmentCount > 1 ? 's' : ''}` : 'No files'}
          </Badge>
        ) : (
          <Badge variant="secondary">Walk-in</Badge>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => getStatusBadge(status),
    },
    {
      key: 'processedBy',
      label: 'Processed By',
      render: (value) => formatProcessedBy(value),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actionButtons}>
          <button 
            className={styles.viewBtn}
            onClick={() => handleViewRequest(row)}
            title="View Details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {['Pending', 'Resubmitted'].includes(row.status) && (
            <>
              <button 
                className={styles.approveBtn}
                onClick={() => handleOpenDecision(row, 'approve')}
                title="Approve"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button 
                className={styles.rejectBtn}
                onClick={() => handleOpenDecision(row, 'archive')}
                title="Mark Incomplete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8v13H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
              </button>
            </>
          )}
          {row.status === 'Rejected' && (
            <button
              className={styles.releaseBtn}
              onClick={() => handleOpenDecision(row, 'unarchive')}
              title="Reopen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M12 12v5" />
                <path d="M9 15l3 3 3-3" />
              </svg>
            </button>
          )}
          {row.status === 'Approved' && (
            <button
              className={styles.releaseBtn}
              onClick={() => handleOpenDecision(row, 'release')}
              title="Mark as Released"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = requests.filter((r) => ['Pending', 'Resubmitted'].includes(r.status)).length;

  return (
    <div className={styles.requestsPage}>
      {/* Summary Cards */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryValue}>{pendingCount}</span>
            <span className={styles.summaryLabel}>Pending / Resubmitted</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryValue}>{requests.filter(r => r.status === 'Approved').length}</span>
            <span className={styles.summaryLabel}>Approved</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryValue}>{requests.filter(r => r.status === 'Released').length}</span>
            <span className={styles.summaryLabel}>Released</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryValue}>{requests.filter(r => r.status === 'Rejected').length}</span>
            <span className={styles.summaryLabel}>Incomplete</span>
          </div>
        </div>
      </div>

      <Card padding={false}>
        <PageHeader
          title="Assistance Requests"
          subtitle="Review and process pending assistance requests"
        >
        </PageHeader>

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

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name or control number..."
          />
          <Select
            name="type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={typeOptions}
            placeholder="All Types"
          />
          <Select
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            placeholder="All Status"
          />
        </FilterBar>

        {/* Desktop Table View */}
        <div className={styles.tableView}>
          {loading ? (
            <div className={styles.emptyCard}>Loading requests...</div>
          ) : (
            <Table columns={columns} data={filteredRequests} />
          )}
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView}>
          {loading ? (
            <div className={styles.emptyCard}>Loading requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className={styles.emptyCard}>No requests found</div>
          ) : (
            filteredRequests.map((request) => (
              <div key={request.id} className={styles.requestCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span className={styles.cardControlNo}>{request.controlNo}</span>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      className={styles.viewBtn}
                      onClick={() => handleViewRequest(request)}
                      title="View Details"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {request.status === 'Pending' && (
                      <>
                        <button 
                          className={styles.approveBtn}
                          onClick={() => handleOpenDecision(request, 'approve')}
                          title="Approve"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button 
                          className={styles.rejectBtn}
                          onClick={() => handleOpenDecision(request, 'archive')}
                          title="Archive"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 8v13H3V8" />
                            <path d="M1 3h22v5H1z" />
                            <path d="M10 12h4" />
                          </svg>
                        </button>
                      </>
                    )}
                    {request.status === 'Rejected' && (
                      <button
                        className={styles.releaseBtn}
                        onClick={() => handleOpenDecision(request, 'unarchive')}
                        title="Reopen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 8v13H3V8" />
                          <path d="M1 3h22v5H1z" />
                          <path d="M12 12v5" />
                          <path d="M9 15l3 3 3-3" />
                        </svg>
                      </button>
                    )}
                    {request.status === 'Approved' && (
                      <button
                        className={styles.releaseBtn}
                        onClick={() => handleOpenDecision(request, 'release')}
                        title="Mark as Released"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Requester</span>
                    <span className={styles.cardValue}>{request.requester}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Beneficiary</span>
                    <span className={styles.cardValue}>{request.beneficiary}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Type</span>
                    {getTypeBadge(request.type)}
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Amount</span>
                    <span className={styles.cardValue}>{request.amount}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Date</span>
                    <span className={styles.cardValue}>{request.date}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Files</span>
                    <span className={styles.cardValue}>
                      {request.requestSource === 'online'
                        ? `${request.attachmentCount || 0} file${(request.attachmentCount || 0) > 1 ? 's' : ''}`
                        : 'Walk-in'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DataTableFooter
          showing={filteredRequests.length}
          total={requests.length}
          itemName="requests"
        />
      </Card>

      {/* View Request Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Request Details"
        size="large"
        footer={
          ['Pending', 'Resubmitted'].includes(selectedRequest?.status) ? (
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => handleOpenDecision(selectedRequest, 'archive')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8v13H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
                Mark Incomplete
              </Button>
              <Button onClick={() => handleOpenDecision(selectedRequest, 'approve')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
              </Button>
            </div>
          ) : selectedRequest?.status === 'Rejected' ? (
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              <Button onClick={() => handleOpenDecision(selectedRequest, 'unarchive')}>
                Reopen
              </Button>
            </div>
          ) : selectedRequest?.status === 'Approved' ? (
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              <Button onClick={() => handleOpenDecision(selectedRequest, 'release')}>
                Mark as Released
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          )
        }
      >
        {selectedRequest && (
          <div className={styles.requestDetails}>
            {(() => {
              const verificationCompleted = getRequirementsCompleted(
                selectedRequest.requirementsChecklist,
                selectedRequest.requirementsCompleted,
              );

              return (
                <>
            <div className={styles.detailsHeader}>
              <div className={styles.controlNumber}>{selectedRequest.controlNo}</div>
              {getStatusBadge(selectedRequest.status)}
            </div>

            {(() => {
              const norm = (v) => String(v || '').trim().toLowerCase();
              const samePerson =
                norm(selectedRequest.requester) === norm(selectedRequest.beneficiary) &&
                norm(selectedRequest.requesterContact) === norm(selectedRequest.beneficiaryContact) &&
                norm(selectedRequest.requesterAddress) === norm(selectedRequest.beneficiaryAddress);

              if (samePerson) {
                return (
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailSection}>
                      <h4>Beneficiary (Self-request)</h4>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Name:</span>
                        <span className={styles.detailValue}>{selectedRequest.requester || 'Not provided'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Contact:</span>
                        <span className={styles.detailValue}>{selectedRequest.requesterContact || 'Not provided'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Address:</span>
                        <span className={styles.detailValue}>{selectedRequest.requesterAddress || 'Not provided'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Note:</span>
                        <span className={styles.detailValue}>No representative. The beneficiary requested directly.</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className={styles.detailsGrid}>
                  <div className={styles.detailSection}>
                    <h4>Representative Information</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Name:</span>
                      <span className={styles.detailValue}>{selectedRequest.requester || 'Not provided'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Contact:</span>
                      <span className={styles.detailValue}>{selectedRequest.requesterContact || 'Not provided'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Address:</span>
                      <span className={styles.detailValue}>{selectedRequest.requesterAddress || 'Not provided'}</span>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h4>Beneficiary Information</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Name:</span>
                      <span className={styles.detailValue}>{selectedRequest.beneficiary || 'Not provided'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Contact:</span>
                      <span className={styles.detailValue}>{selectedRequest.beneficiaryContact || 'Not provided'}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Address:</span>
                      <span className={styles.detailValue}>{selectedRequest.beneficiaryAddress || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className={styles.detailSection}>
              <h4>Beneficiary Personal Information</h4>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Control No:</span>
                <span className={styles.detailValue}>
                  {selectedRequest.residentControlNumber || 'Not provided'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Birthday:</span>
                <span className={styles.detailValue}>{selectedRequest.residentBirthday || 'Not provided'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Birthplace:</span>
                <span className={styles.detailValue}>{selectedRequest.residentBirthplace || 'Not provided'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Sex:</span>
                <span className={styles.detailValue}>{selectedRequest.residentSex || 'Not provided'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Citizenship:</span>
                <span className={styles.detailValue}>{selectedRequest.residentCitizenship || 'Not provided'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Civil Status:</span>
                <span className={styles.detailValue}>{selectedRequest.residentCivilStatus || 'Not provided'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Sectors:</span>
                <span className={styles.detailValue}>{selectedRequest.sectorText || 'None'}</span>
              </div>
            </div>



            <div className={styles.detailSection}>
              <h4>Remarks</h4>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Decision Remarks:</span>
                <span className={styles.detailValue}>
                  {selectedRequest.decisionRemarks || 'None'}
                </span>
              </div>
            </div>

            <div className={styles.assistanceInfo}>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Type of Assistance</span>
                <span className={styles.infoValue}>{getTypeBadge(selectedRequest.type)}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Amount</span>
                <span className={styles.infoValue}>{selectedRequest.amount}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Date Filed</span>
                <span className={styles.infoValue}>{selectedRequest.date}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Processed By</span>
                <span className={styles.infoValue}>{formatProcessedBy(selectedRequest.processedBy)}</span>
              </div>
              <div className={`${styles.infoCard} ${styles.wideInfoCard}`}>
                <span className={styles.infoLabel}>Requirements Verification</span>
                <div className={`${styles.infoValue} ${styles.requirementsContent}`}>
                  <div className={styles.verificationPanel}>
                    <p className={styles.verificationHeading}>Requirements Verification Checklist</p>
                    <div className={styles.verificationChecklist}>
                      {selectedRequest.requirementsChecklist?.length ? (
                        selectedRequest.requirementsChecklist.map((item, idx) => (
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
                        <span className={styles.verificationEmpty}>No checklist available for this request.</span>
                      )}
                    </div>
                    <div className={styles.verificationStatus}>
                      Status: {verificationCompleted ? 'COMPLETED' : 'INCOMPLETE'}
                    </div>
                  </div>

                  {selectedRequest.requestSource === 'online' ? (
                    <div className={styles.uploadedDocsSection}>
                      <p className={styles.uploadedDocsHeading}>
                        Attached Documents: View all submitted files for verification.
                      </p>
                      {selectedRequest.requirementFiles?.length ? (
                        <div className={styles.uploadedDocsList}>
                          {selectedRequest.requirementFiles.map((file, idx) => (
                            <div key={`${file.file_url}-${idx}`} className={styles.uploadedDocItem}>
                              <div className={styles.uploadedDocMeta}>
                                <span className={styles.uploadedDocName}>{file.file_name || `Document ${idx + 1}`}</span>
                                <span className={styles.uploadedDocType}>
                                  {isLikelyImage(file.file_url) ? 'Image' : 'Document'}
                                </span>
                              </div>
                              <button
                                type="button"
                                className={styles.validIdLink}
                                onClick={() => openValidId(file.file_url)}
                              >
                                View Document {idx + 1}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className={styles.verificationEmpty}>No uploaded files found for this online request.</span>
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
        )}
      </Modal>

      {/* Decision Confirmation Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={
          decisionType === 'approve'
            ? 'Approve Request'
            : decisionType === 'archive'
              ? 'Archive Request'
              : decisionType === 'unarchive'
                ? 'Unarchive Request'
                : 'Mark as Released'
        }
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
              {isUpdatingStatus
                ? 'Saving...'
                : decisionType === 'approve'
                  ? 'Confirm Approval'
                  : decisionType === 'archive'
                    ? 'Confirm Incomplete'
                    : decisionType === 'unarchive'
                      ? 'Confirm Reopen'
                      : 'Confirm Release'}
            </Button>
          </div>
        }
      >
        {selectedRequest && (
          <div className={styles.decisionContent}>
            <div 
              className={styles.decisionIcon}
              style={{ 
                backgroundColor:
                  decisionType === 'approve'
                    ? '#dcfce7'
                    : decisionType === 'archive'
                      ? '#fef3c7'
                      : '#dbeafe',
                color:
                  decisionType === 'approve'
                    ? '#16a34a'
                    : decisionType === 'archive'
                      ? '#d97706'
                      : '#2563eb',
              }}
            >
              {decisionType === 'approve' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : decisionType === 'archive' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8v13H3V8" />
                  <path d="M1 3h22v5H1z" />
                  <path d="M10 12h4" />
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              )}
            </div>
            <h4 className={styles.decisionTitle}>
              {decisionType === 'approve'
                ? 'Approve this assistance request?'
                : decisionType === 'archive'
                  ? 'Archive this assistance request?'
                  : decisionType === 'unarchive'
                    ? 'Unarchive this assistance request?'
                    : 'Mark this assistance request as released?'}
            </h4>
            <p className={styles.decisionDesc}>
              Control No: <strong>{selectedRequest.controlNo}</strong><br />
              Requester: <strong>{selectedRequest.requester}</strong><br />
              Amount: <strong>{selectedRequest.amount}</strong>
            </p>
            <div className={styles.remarksSection}>
              <label className={styles.remarksLabel}>Remarks (Optional)</label>
              <textarea
                className={styles.remarksInput}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  decisionType === 'approve'
                    ? 'Add any notes for this approval...'
                    : decisionType === 'archive'
                      ? 'Add a reason (optional)...'
                      : 'Add any notes (optional)...'
                }
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Alert Modal */}
      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Notice'}
        size="small"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={closeAlert}>OK</Button>
          </div>
        }
      >
        <p>{alertState.message}</p>
      </Modal>
    </div>
  );
}
