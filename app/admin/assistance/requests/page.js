'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
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
  { value: 'Approved', label: 'Approved' },
  { value: 'Released', label: 'Released' },
  { value: 'Archived', label: 'Archived' },
];


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

  const openAlert = ({ title, message, variant = 'info' }) => {
    setAlertState({ open: true, title, message, variant });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const getStatusLabel = (dbStatus) => (dbStatus === 'Rejected' ? 'Archived' : dbStatus);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const response = await fetch('/api/assistance-requests');
        const result = await response.json();

        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Failed to load assistance requests.');
        }

        const mapped = (result.data || []).map((r) => {
          const resident = r.residents || {};

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

          return {
            id: requestKey,
            controlNo: r.control_number,
            // Show exactly what was submitted in the request (avoid falling back to resident profile)
            requester: r.requester_name || '',
            requesterContact: r.requester_contact || '',
            requesterAddress: r.requester_address || '',
            beneficiary: r.beneficiary_name || '',
            beneficiaryContact: r.beneficiary_contact || '',
            beneficiaryAddress: r.beneficiary_address || '',
            type: r.assistance_type,
            amount: r.amount,
            rawAmount: r.amount,
            validIdUrl: r.valid_id_url || null,
            status,
            statusLabel: getStatusLabel(status),
            date: r.request_date ? new Date(r.request_date).toLocaleDateString() : '',
            processedBy: r.processed_by || '',
            decisionRemarks: r.decision_remarks || '',
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

  const handleOpenDecision = (request, type) => {
    setSelectedRequest(request);
    setDecisionType(type);
    setRemarks('');
    setShowDecisionModal(true);
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
    if ((decisionType === 'approve' || decisionType === 'archive') && selectedRequest.status !== 'Pending') {
      setStatus({
        type: 'error',
        message: 'Only pending requests can be approved or archived.',
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
        message: 'Only archived requests can be unarchived.',
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

      const requestKey = selectedRequest?.controlNo || selectedRequest?.id;
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
          control_number: selectedRequest?.controlNo || null,
          request_id: selectedRequest?.id || null,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to update request status.');
      }

      setRequests((prev) =>
        prev.map((req) =>
          req.controlNo === selectedRequest.controlNo || req.id === selectedRequest.id
            ? { ...req, status: newStatus, statusLabel: getStatusLabel(newStatus) }
            : req,
        ),
      );

      const statusLabel = getStatusLabel(newStatus);
      setStatus({
        type: 'success',
        message: `Request ${selectedRequest.controlNo} has been ${
          statusLabel === 'Approved'
            ? 'approved'
            : statusLabel === 'Archived'
              ? 'archived'
              : statusLabel === 'Pending'
                ? 'unarchived'
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
      key: 'status',
      label: 'Status',
      render: (status) => getStatusBadge(status),
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
          {row.status === 'Pending' && (
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
          {row.status === 'Rejected' && (
            <button
              className={styles.releaseBtn}
              onClick={() => handleOpenDecision(row, 'unarchive')}
              title="Unarchive"
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

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

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
            <span className={styles.summaryLabel}>Pending Requests</span>
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
            <span className={styles.summaryLabel}>Archived</span>
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
                        title="Unarchive"
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
          selectedRequest?.status === 'Pending' ? (
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
                Archive
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
                Unarchive
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
            <div className={styles.detailsHeader}>
              <div className={styles.controlNumber}>{selectedRequest.controlNo}</div>
              {getStatusBadge(selectedRequest.status)}
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.detailSection}>
                <h4>Requester Information</h4>
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
                <span className={styles.infoValue}>{selectedRequest.processedBy}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Valid ID</span>
                <span className={styles.infoValue}>
                  {selectedRequest.validIdUrl ? (
                    <a
                      href={selectedRequest.validIdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.validIdLink}
                    >
                      View Uploaded ID
                    </a>
                  ) : (
                    'Not available'
                  )}
                </span>
              </div>
            </div>
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
                    ? 'Confirm Archive'
                    : decisionType === 'unarchive'
                      ? 'Confirm Unarchive'
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
                      ? 'Add a reason for archiving (optional)...'
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
