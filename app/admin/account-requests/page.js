"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  PageHeader,
  SearchInput,
  FilterBar,
  DataTableFooter,
  Modal,
  Table,
} from "@/components";
import styles from "./page.module.css";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Archived", label: "Archived" },
];

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildFullName(request) {
  const parts = [request.first_name || request.firstName, request.middle_name || request.middleName, request.last_name || request.lastName].filter(Boolean);
  return parts.join(" ");
}

function getSectorBadges(request) {
  const sectors = [];
  if (request.is_pwd || request.isPwd) sectors.push("PWD");
  if (request.is_senior_citizen || request.isSeniorCitizen) sectors.push("Senior Citizen");
  if (request.is_solo_parent || request.isSoloParent) sectors.push("Solo Parent");
  return sectors;
}

export default function AccountRequestsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState("view"); // "view" | "approve" | "reject" | "unarchive"
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [archiveNotes, setArchiveNotes] = useState('');
  const [alertState, setAlertState] = useState({
    open: false,
    title: '',
    message: '',
    variant: 'info', // info | success | error
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/account-requests');
      const result = await response.json();
      
      if (result.error) {
        console.error('Error fetching requests:', result.error);
        setRequests([]);
      } else {
        const normalized = (result.data || []).map((r) =>
          r?.status === "Rejected" ? { ...r, status: "Archived" } : r,
        );
        setRequests(normalized);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const fullName = buildFullName(req).toLowerCase();
      const contact = (req.contact_number || req.contactNumber || "").toLowerCase();
      const query = searchTerm.toLowerCase();

      const matchesSearch = !query || fullName.includes(query) || contact.includes(query);
      const matchesStatus = !statusFilter || req.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const handleOpenDetails = (request) => {
    setSelectedRequest(request);
    setModalMode("view");
  };

  const openAlert = ({ title, message, variant = 'info' }) => {
    setAlertState({ open: true, title, message, variant });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const handleOpenApprove = (request) => {
    setSelectedRequest(request);
    setModalMode("approve");
  };

  const handleOpenReject = (request) => {
    setSelectedRequest(request);
    setArchiveNotes('');
    setModalMode("reject");
  };

  const handleOpenUnarchive = (request) => {
    setSelectedRequest(request);
    setArchiveNotes('');
    setModalMode('unarchive');
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    setModalMode("view");
    setArchiveNotes('');
  };

  const handleConfirmApprove = async () => {
    if (!selectedRequest || processing) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/account-requests/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          processedBy: 'Admin', // TODO: Get from actual user session
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to approve request');
      }

      handleCloseModal();
      await fetchRequests();
      openAlert({
        title: 'Approved',
        message: 'Request approved and beneficiary account created successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Approve error:', error);
      openAlert({
        title: 'Approve failed',
        message: error.message || 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || processing) return;

    const requestId = selectedRequest.id;
    if (!requestId) {
      console.error('Selected request has no id:', selectedRequest);
      openAlert({
        title: 'Archive failed',
        message: 'Request ID is missing.',
        variant: 'error',
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/account-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'archive',
          processedBy: 'Admin', // TODO: Get from actual user session
          notes: archiveNotes || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to archive request');
      }

      handleCloseModal();
      await fetchRequests();
      openAlert({
        title: 'Archived',
        message: 'Request archived successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Archive error:', error);
      openAlert({
        title: 'Archive failed',
        message: error.message || 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmUnarchive = async () => {
    if (!selectedRequest || processing) return;

    const requestId = selectedRequest.id;
    if (!requestId) {
      console.error('Selected request has no id:', selectedRequest);
      openAlert({
        title: 'Unarchive failed',
        message: 'Request ID is missing.',
        variant: 'error',
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/account-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unarchive',
          processedBy: 'Admin', // TODO: Get from actual user session
          notes: archiveNotes || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to unarchive request');
      }

      handleCloseModal();
      await fetchRequests();
      openAlert({
        title: 'Unarchived',
        message: 'Request moved back to Pending.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Unarchive error:', error);
      openAlert({
        title: 'Unarchive failed',
        message: error.message || 'Unknown error',
        variant: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    {
      key: "applicant",
      label: "Applicant",
      render: (_, row) => (
        <div className={styles.applicantCell}>
          <div className={styles.avatar}>{
            buildFullName(row)
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
          }</div>
          <div className={styles.applicantInfo}>
            <span className={styles.applicantName}>{buildFullName(row)}</span>
            <span className={styles.applicantMeta}>{row.contact_number || row.contactNumber}</span>
          </div>
        </div>
      ),
    },
    {
      key: "sector",
      label: "Sector",
      render: (_, row) => {
        const sectors = getSectorBadges(row);
        if (!sectors.length) return <span className={styles.subtleText}>General</span>;
        return (
          <div className={styles.sectorBadges}>
            {sectors.map((sector) => (
              <Badge key={sector} variant="secondary">
                {sector}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "address",
      label: "Address",
      render: (_, row) => (
        <div className={styles.addressCell}>
          <span>{`${row.house_no || row.houseNo || ""} ${row.street || ""}`.trim()}</span>
          <span className={styles.addressMeta}>{`Purok ${row.purok || "-"}, ${row.barangay}`}</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
      render: (_, row) => <span>{formatDate(row.created_at || row.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (status) => (
        <Badge
          variant={
            status === "Approved"
              ? "success"
              : status === "Archived" || status === "Rejected"
              ? "secondary"
              : "warning"
          }
        >
          {status === "Archived" || status === "Rejected" ? "Archived" : status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <div className={styles.actionsCell}>
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleOpenDetails(row)}
          >
            View
          </Button>
          {row.status === "Pending" && (
            <>
              <Button
                variant="outline"
                size="small"
                onClick={() => handleOpenApprove(row)}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleOpenReject(row)}
              >
                Archive
              </Button>
            </>
          )}

          {(row.status === "Archived" || row.status === "Rejected") && (
            <Button
              variant="outline"
              size="small"
              onClick={() => handleOpenUnarchive(row)}
            >
              Unarchive
            </Button>
          )}
        </div>
      ),
    },
  ];

  const total = requests.length;
  const showing = filteredRequests.length;

  const isDetailsModalOpen = !!selectedRequest && modalMode === "view";
  const isApproveModalOpen = !!selectedRequest && modalMode === "approve";
  const isRejectModalOpen = !!selectedRequest && modalMode === "reject";
  const isUnarchiveModalOpen = !!selectedRequest && modalMode === "unarchive";
  const isAlertModalOpen = !!alertState.open;

  return (
    <div className={styles.page}>
      <Card padding={false}>
        <PageHeader
          title="Account Requests"
          subtitle="Review beneficiary signups and approve accounts for the ALAGA Program"
        />

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name or contact number..."
          />
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        <Table columns={columns} data={filteredRequests} />

        <DataTableFooter
          showing={showing}
          total={total}
          itemName="requests"
        />
      </Card>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseModal}
        title="Signup Details"
      >
        {selectedRequest && (
          <div className={styles.detailsContent}>
            <div className={styles.detailsHeaderRow}>
              <div>
                <div className={styles.detailsId}>{selectedRequest.id}</div>
                <div className={styles.detailsSubmitted}>
                  Submitted: {formatDate(selectedRequest.created_at || selectedRequest.createdAt)}
                </div>
              </div>
              <Badge
                variant={
                  selectedRequest.status === "Approved"
                    ? "success"
                    : selectedRequest.status === "Archived" || selectedRequest.status === "Rejected"
                    ? "secondary"
                    : "warning"
                }
              >
                {selectedRequest.status === "Archived" || selectedRequest.status === "Rejected"
                  ? "Archived"
                  : selectedRequest.status}
              </Badge>
            </div>

            <div className={styles.detailsSection}>
              <h3>Personal Information</h3>
              <div className={styles.detailsGrid}>
                <div>
                  <span className={styles.label}>Full Name</span>
                  <span className={styles.value}>{buildFullName(selectedRequest)}</span>
                </div>
                <div>
                  <span className={styles.label}>Contact Number</span>
                  <span className={styles.value}>{selectedRequest.contact_number || selectedRequest.contactNumber}</span>
                </div>
                <div>
                  <span className={styles.label}>Sector Classification</span>
                  <div className={styles.value}>
                    {getSectorBadges(selectedRequest).length ? (
                      getSectorBadges(selectedRequest).join(", ")
                    ) : (
                      <span className={styles.subtleText}>General</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.detailsSection}>
              <h3>Address</h3>
              <div className={styles.detailsGrid}>
                <div>
                  <span className={styles.label}>House Number</span>
                  <span className={styles.value}>{selectedRequest.house_no || selectedRequest.houseNo}</span>
                </div>
                <div>
                  <span className={styles.label}>Purok</span>
                  <span className={styles.value}>{selectedRequest.purok}</span>
                </div>
                <div>
                  <span className={styles.label}>Street / Sitio</span>
                  <span className={styles.value}>{selectedRequest.street}</span>
                </div>
                <div>
                  <span className={styles.label}>Barangay</span>
                  <span className={styles.value}>{selectedRequest.barangay}</span>
                </div>
                <div>
                  <span className={styles.label}>City / Municipality</span>
                  <span className={styles.value}>{selectedRequest.city}</span>
                </div>
              </div>
            </div>

            {selectedRequest.notes && (
              <div className={styles.detailsSection}>
                <h3>Remarks</h3>
                <p className={styles.notes}>{selectedRequest.notes}</p>
              </div>
            )}

            {selectedRequest.status === "Pending" && (
              <div className={styles.detailsActionsRow}>
                <Button
                  variant="secondary"
                  onClick={() => handleOpenReject(selectedRequest)}
                >
                  Archive
                </Button>
                <Button onClick={() => handleOpenApprove(selectedRequest)}>
                  Approve & Create Account
                </Button>
              </div>
            )}

            {(selectedRequest.status === "Archived" || selectedRequest.status === "Rejected") && (
              <div className={styles.detailsActionsRow}>
                <Button variant="outline" onClick={() => handleOpenUnarchive(selectedRequest)}>
                  Unarchive
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={handleCloseModal}
        title="Approve Signup Request"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmApprove} disabled={processing}>
              {processing ? 'Approving…' : 'Confirm Approve'}
            </Button>
          </>
        }
      >
        {selectedRequest && (
          <p className={styles.confirmText}>
            You are about to approve this signup request and create a beneficiary account for
            <strong> {buildFullName(selectedRequest)} </strong>
            in the ALAGA Program. This can be updated later from User Management.
          </p>
        )}
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={handleCloseModal}
        title="Archive Signup Request"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={processing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReject} disabled={processing}>
              {processing ? 'Archiving…' : 'Confirm Archive'}
            </Button>
          </>
        }
      >
        {selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className={styles.confirmText} style={{ margin: 0 }}>
              Are you sure you want to archive this signup request for
              <strong> {buildFullName(selectedRequest)} </strong>?
            </p>
            <Input
              label="Archive note (optional)"
              name="archiveNotes"
              value={archiveNotes}
              onChange={(e) => setArchiveNotes(e.target.value)}
              placeholder="e.g. Duplicate request"
            />
          </div>
        )}
      </Modal>

      {/* Unarchive Confirmation Modal */}
      <Modal
        isOpen={isUnarchiveModalOpen}
        onClose={handleCloseModal}
        title="Unarchive Signup Request"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUnarchive} disabled={processing}>
              {processing ? 'Unarchiving…' : 'Confirm Unarchive'}
            </Button>
          </>
        }
      >
        {selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className={styles.confirmText} style={{ margin: 0 }}>
              Move this request back to <strong>Pending</strong> for
              <strong> {buildFullName(selectedRequest)} </strong>?
            </p>
            <Input
              label="Unarchive note (optional)"
              name="unarchiveNotes"
              value={archiveNotes}
              onChange={(e) => setArchiveNotes(e.target.value)}
              placeholder="e.g. Archived by mistake"
            />
          </div>
        )}
      </Modal>

      {/* Alert Modal */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={
          <>
            <Button onClick={closeAlert}>OK</Button>
          </>
        }
      >
        <p style={{ margin: 0, color: '#374151', whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>
    </div>
  );
}
