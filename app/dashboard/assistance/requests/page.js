'use client';

import { useState } from 'react';
import Link from 'next/link';
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

// Sample pending requests - Replace with actual data from Supabase
const sampleRequests = [
  { 
    id: 1, 
    controlNo: 'AST-2024-00003', 
    requester: 'Ana Reyes Garcia', 
    requesterContact: '09171234567',
    requesterAddress: 'Purok 2, Barangay Sta. Rita',
    beneficiary: 'Pedro Garcia Sr.', 
    beneficiaryContact: '09181234567',
    beneficiaryAddress: 'Purok 2, Barangay Sta. Rita',
    type: 'Burial Assistance', 
    date: '2024-02-01', 
    amount: '₱1,000', 
    status: 'Pending',
    processedBy: 'Maria Santos',
  },
  { 
    id: 2, 
    controlNo: 'AST-2024-00006', 
    requester: 'Carlos Mendoza', 
    requesterContact: '09191234567',
    requesterAddress: 'Purok 3, Barangay Sta. Rita',
    beneficiary: 'Carlos Mendoza', 
    beneficiaryContact: '09191234567',
    beneficiaryAddress: 'Purok 3, Barangay Sta. Rita',
    type: 'Medicine Assistance', 
    date: '2024-02-12', 
    amount: '₱450', 
    status: 'Pending',
    processedBy: 'Juan Dela Cruz',
  },
  { 
    id: 3, 
    controlNo: 'AST-2024-00007', 
    requester: 'Elena Santos', 
    requesterContact: '09201234567',
    requesterAddress: 'Purok 1, Barangay Sta. Rita',
    beneficiary: 'Roberto Santos', 
    beneficiaryContact: '09211234567',
    beneficiaryAddress: 'Purok 1, Barangay Sta. Rita',
    type: 'Confinement Assistance', 
    date: '2024-02-14', 
    amount: '₱1,000', 
    status: 'Pending',
    processedBy: 'Maria Santos',
  },
];

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
  { value: 'Rejected', label: 'Rejected' },
];

export default function RequestsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requests, setRequests] = useState(sampleRequests);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState(null);
  const [remarks, setRemarks] = useState('');

  // Filter requests
  const filteredRequests = requests.filter((record) => {
    const matchesSearch = 
      record.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.controlNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || record.type === typeFilter;
    const matchesStatus = !statusFilter || record.status === statusFilter;
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

  const handleConfirmDecision = () => {
    // Update request status
    setRequests(prev => prev.map(req => 
      req.id === selectedRequest.id 
        ? { ...req, status: decisionType === 'approve' ? 'Approved' : 'Rejected' }
        : req
    ));
    
    alert(`Request ${selectedRequest.controlNo} has been ${decisionType === 'approve' ? 'approved' : 'rejected'}.`);
    setShowDecisionModal(false);
    setShowViewModal(false);
    setSelectedRequest(null);
    setRemarks('');
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Pending': 'warning',
      'Approved': 'primary',
      'Released': 'success',
      'Rejected': 'danger',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const columns = [
    { key: 'controlNo', label: 'Control No.' },
    { key: 'requester', label: 'Requester' },
    { key: 'beneficiary', label: 'Beneficiary' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge>{type}</Badge>,
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
                onClick={() => handleOpenDecision(row, 'reject')}
                title="Reject"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
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
            <span className={styles.summaryLabel}>Rejected</span>
          </div>
        </div>
      </div>

      <Card padding={false}>
        <PageHeader
          title="Assistance Requests"
          subtitle="Review and process pending assistance requests"
        >
          <Link href="/dashboard/assistance">
            <Button variant="secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Records
            </Button>
          </Link>
        </PageHeader>

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
          <Table columns={columns} data={filteredRequests} />
        </div>

        {/* Mobile Card View */}
        <div className={styles.mobileCardView}>
          {filteredRequests.length === 0 ? (
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
                          onClick={() => handleOpenDecision(request, 'reject')}
                          title="Reject"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </>
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
                    <Badge>{request.type}</Badge>
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
              <Button variant="danger" onClick={() => handleOpenDecision(selectedRequest, 'reject')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject
              </Button>
              <Button onClick={() => handleOpenDecision(selectedRequest, 'approve')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
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
                  <span className={styles.detailValue}>{selectedRequest.requester}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Contact:</span>
                  <span className={styles.detailValue}>{selectedRequest.requesterContact}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Address:</span>
                  <span className={styles.detailValue}>{selectedRequest.requesterAddress}</span>
                </div>
              </div>

              <div className={styles.detailSection}>
                <h4>Beneficiary Information</h4>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Name:</span>
                  <span className={styles.detailValue}>{selectedRequest.beneficiary}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Contact:</span>
                  <span className={styles.detailValue}>{selectedRequest.beneficiaryContact}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Address:</span>
                  <span className={styles.detailValue}>{selectedRequest.beneficiaryAddress}</span>
                </div>
              </div>
            </div>

            <div className={styles.assistanceInfo}>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Type of Assistance</span>
                <span className={styles.infoValue}>{selectedRequest.type}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoLabel}>Amount Requested</span>
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
            </div>
          </div>
        )}
      </Modal>

      {/* Decision Confirmation Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={decisionType === 'approve' ? 'Approve Request' : 'Reject Request'}
        size="small"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setShowDecisionModal(false)}>
              Cancel
            </Button>
            <Button 
              variant={decisionType === 'approve' ? 'primary' : 'danger'} 
              onClick={handleConfirmDecision}
            >
              {decisionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </div>
        }
      >
        {selectedRequest && (
          <div className={styles.decisionContent}>
            <div 
              className={styles.decisionIcon}
              style={{ 
                backgroundColor: decisionType === 'approve' ? '#dcfce7' : '#fee2e2',
                color: decisionType === 'approve' ? '#16a34a' : '#dc2626'
              }}
            >
              {decisionType === 'approve' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <h4 className={styles.decisionTitle}>
              {decisionType === 'approve' 
                ? 'Approve this assistance request?' 
                : 'Reject this assistance request?'}
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
                placeholder={decisionType === 'approve' 
                  ? 'Add any notes for this approval...' 
                  : 'Please provide a reason for rejection...'}
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
