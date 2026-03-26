"use client";

import { useState, useMemo } from "react";
import {
  Card,
  Badge,
  Button,
  PageHeader,
  SearchInput,
  FilterBar,
  DataTableFooter,
  Modal,
  Table,
} from "@/components";
import styles from "./page.module.css";

// TODO: Replace with real data from Supabase (beneficiary signup table)
const sampleRequests = [
  {
    id: "REQ-2026-0001",
    createdAt: "2026-03-20T10:15:00Z",
    status: "Pending",
    firstName: "Maria",
    middleName: "Santos",
    lastName: "Dela Cruz",
    contactNumber: "09171234567",
    isPwd: true,
    isSeniorCitizen: false,
    isSoloParent: false,
    houseNo: "123",
    purok: "3",
    street: "Camia St.",
    barangay: "Sta. Rita",
    city: "Olongapo City",
    notes: "Walk-in signup during barangay caravan.",
  },
  {
    id: "REQ-2026-0002",
    createdAt: "2026-03-21T09:00:00Z",
    status: "Pending",
    firstName: "Juan",
    middleName: "Garcia",
    lastName: "Reyes",
    contactNumber: "09998887777",
    isPwd: false,
    isSeniorCitizen: true,
    isSoloParent: false,
    houseNo: "45-B",
    purok: "1",
    street: "Mahogany St.",
    barangay: "Sta. Rita",
    city: "Olongapo City",
    notes: "Referred by senior citizens association.",
  },
];

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
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
  const parts = [request.firstName, request.middleName, request.lastName].filter(Boolean);
  return parts.join(" ");
}

function getSectorBadges(request) {
  const sectors = [];
  if (request.isPwd) sectors.push("PWD");
  if (request.isSeniorCitizen) sectors.push("Senior Citizen");
  if (request.isSoloParent) sectors.push("Solo Parent");
  return sectors;
}

export default function AccountRequestsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState("view"); // "view" | "approve" | "reject"

  const filteredRequests = useMemo(() => {
    return sampleRequests.filter((req) => {
      const fullName = buildFullName(req).toLowerCase();
      const contact = (req.contactNumber || "").toLowerCase();
      const query = searchTerm.toLowerCase();

      const matchesSearch = !query || fullName.includes(query) || contact.includes(query);
      const matchesStatus = !statusFilter || req.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const handleOpenDetails = (request) => {
    setSelectedRequest(request);
    setModalMode("view");
  };

  const handleOpenApprove = (request) => {
    setSelectedRequest(request);
    setModalMode("approve");
  };

  const handleOpenReject = (request) => {
    setSelectedRequest(request);
    setModalMode("reject");
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    setModalMode("view");
  };

  // TODO: Replace with actual Supabase calls
  const handleConfirmApprove = async () => {
    if (!selectedRequest) return;
    console.log("Approve signup request", selectedRequest.id);
    // e.g. 1) update signup status to Approved
    //      2) create beneficiary user account linked to this record
    handleCloseModal();
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest) return;
    console.log("Reject signup request", selectedRequest.id);
    // e.g. 1) update signup status to Rejected with reason
    handleCloseModal();
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
            <span className={styles.applicantMeta}>{row.contactNumber}</span>
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
          <span>{`${row.houseNo || ""} ${row.street || ""}`.trim()}</span>
          <span className={styles.addressMeta}>{`Purok ${row.purok || "-"}, ${row.barangay}`}</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
      render: (value) => <span>{formatDate(value)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (status) => (
        <Badge
          variant={
            status === "Approved"
              ? "success"
              : status === "Rejected"
              ? "danger"
              : "warning"
          }
        >
          {status}
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
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const total = sampleRequests.length;
  const showing = filteredRequests.length;

  const isDetailsModalOpen = !!selectedRequest && modalMode === "view";
  const isApproveModalOpen = !!selectedRequest && modalMode === "approve";
  const isRejectModalOpen = !!selectedRequest && modalMode === "reject";

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
                  Submitted: {formatDate(selectedRequest.createdAt)}
                </div>
              </div>
              <Badge
                variant={
                  selectedRequest.status === "Approved"
                    ? "success"
                    : selectedRequest.status === "Rejected"
                    ? "danger"
                    : "warning"
                }
              >
                {selectedRequest.status}
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
                  <span className={styles.value}>{selectedRequest.contactNumber}</span>
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
                  <span className={styles.value}>{selectedRequest.houseNo}</span>
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
                  Reject
                </Button>
                <Button onClick={() => handleOpenApprove(selectedRequest)}>
                  Approve & Create Account
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
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleConfirmApprove}>Confirm Approve</Button>
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

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={handleCloseModal}
        title="Reject Signup Request"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReject}>
              Confirm Reject
            </Button>
          </>
        }
      >
        {selectedRequest && (
          <p className={styles.confirmText}>
            Are you sure you want to reject this signup request for
            <strong> {buildFullName(selectedRequest)} </strong>?
            You can record a reason when we connect this to the backend.
          </p>
        )}
      </Modal>
    </div>
  );
}
