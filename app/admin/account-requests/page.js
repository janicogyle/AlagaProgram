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
import { supabase } from "@/lib/supabaseClient";
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

function formatDateOnly(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function calculateAgeFromBirthday(dateString) {
  if (!dateString) return null;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
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

function parseValidIdUrls(value, fallbackValue) {
  const list = [];

  if (Array.isArray(value)) {
    list.push(...value);
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        list.push(...parsed);
      }
    } catch {
      const trimmed = value.trim();
      if (trimmed) list.push(trimmed);
    }
  }

  if (!list.length && fallbackValue) {
    list.push(fallbackValue);
  }

  return list.map((item) => String(item || "").trim()).filter(Boolean);
}

const isLikelyImage = (fileUrl) => /\.(png|jpe?g|gif|webp)$/i.test(String(fileUrl || ""));
const shouldUseInAppPreview = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches;

export default function AccountRequestsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetails, setRequestDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // "view" | "approve" | "reject" | "unarchive"
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [archiveNotes, setArchiveNotes] = useState('');
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: "" });
  const [previewZoom, setPreviewZoom] = useState(1);
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
      const headers = await getAuthHeaders();
      const response = await fetch('/api/account-requests', { headers });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.error) {
        const msg = result?.error || 'Failed to fetch account requests.';
        console.warn('Error fetching requests:', msg);
        setRequests([]);
        openAlert({ title: 'Fetch failed', message: msg, variant: 'error' });
      } else {
        const normalized = (result.data || []).map((r) =>
          r?.status === "Rejected" ? { ...r, status: "Archived" } : r,
        );
        setRequests(normalized);
      }
    } catch (error) {
      const msg = error?.message || 'Failed to fetch account requests.';
      console.warn('Failed to fetch requests:', msg);
      setRequests([]);
      openAlert({ title: 'Fetch failed', message: msg, variant: 'error' });
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

  const fetchRequestDetails = async (requestId) => {
    if (!requestId) return;

    setDetailsLoading(true);
    setRequestDetails(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/account-requests/${requestId}`, { headers });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to load signup details.');
      }

      setRequestDetails(json?.data || null);
    } catch (err) {
      console.warn('Failed to load signup details:', err?.message || err);
      setRequestDetails(null);
      openAlert({
        title: 'Load failed',
        message: err?.message || 'Failed to load signup details.',
        variant: 'error',
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenDetails = (request) => {
    setSelectedRequest(request);
    setModalMode("view");
    fetchRequestDetails(request?.id);
  };

  const openAlert = ({ title, message, variant = 'info' }) => {
    setAlertState({ open: true, title, message, variant });
  };

  const getAuthHeaders = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  const openDocument = async (pathOrUrl) => {
    if (!pathOrUrl) return;

    const useInAppPreview = shouldUseInAppPreview();
    let openedTab = null;
    try {
      const value = String(pathOrUrl);
      if (!useInAppPreview) {
        // Open synchronously so mobile Safari/Chrome do not block the popup.
        openedTab = window.open('', "_blank", "noopener,noreferrer");
        if (openedTab) {
          try {
            openedTab.opener = null;
          } catch {
            // ignore
          }
        }
      }

      if (/^https?:\/\//i.test(value)) {
        if (useInAppPreview) {
          setPreviewZoom(1);
          setDocumentPreview({ open: true, url: value });
          return;
        }
        if (!openedTab) throw new Error("Popup blocked. Please allow popups for this site.");
        openedTab.location.href = value;
        return;
      }

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/documents/view?path=${encodeURIComponent(value)}`, { headers });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.error) {
        throw new Error(json?.error || "Unable to open document.");
      }

      const url = json?.data?.url;
      if (!url) throw new Error("Unable to open document.");

      if (useInAppPreview) {
        setPreviewZoom(1);
        setDocumentPreview({ open: true, url });
        return;
      }
      if (!openedTab) throw new Error("Popup blocked. Please allow popups for this site.");
      openedTab.location.href = url;
    } catch (e) {
      try {
        openedTab?.close?.();
      } catch {
        // ignore
      }
      openAlert({
        title: "Unable to open",
        message: e?.message || "Failed to open document.",
        variant: "error",
      });
    }
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
    setRequestDetails(null);
    setDetailsLoading(false);
    setModalMode("view");
    setArchiveNotes('');
  };

  const handleConfirmApprove = async () => {
    if (!selectedRequest || processing) return;

    setProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/account-requests/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      console.warn('Approve error:', error?.message || error);
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
      console.warn('Selected request has no id:', selectedRequest);
      openAlert({
        title: 'Archive failed',
        message: 'Request ID is missing.',
        variant: 'error',
      });
      return;
    }

    setProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/account-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      console.warn('Archive error:', error?.message || error);
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
      console.warn('Selected request has no id:', selectedRequest);
      openAlert({
        title: 'Unarchive failed',
        message: 'Request ID is missing.',
        variant: 'error',
      });
      return;
    }

    setProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/account-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      console.warn('Unarchive error:', error?.message || error);
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
          <span>{`${row.house_no || row.houseNo || ""}`.trim() || "-"}</span>
          <span className={styles.addressMeta}>{`Purok ${row.purok || "-"}, ${row.barangay || "-"}`}</span>
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

  const detailsRequest = requestDetails || selectedRequest;

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
                    <span className={styles.cardControlNo}>REQ-{request.id.split('-')[0].toUpperCase()}</span>
                    <Badge
                      variant={
                        request.status === "Approved"
                          ? "success"
                          : request.status === "Archived" || request.status === "Rejected"
                          ? "secondary"
                          : "warning"
                      }
                    >
                      {request.status === "Archived" || request.status === "Rejected" ? "Archived" : request.status}
                    </Badge>
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      className={styles.viewBtn}
                      onClick={() => handleOpenDetails(request)}
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
                          onClick={() => handleOpenApprove(request)}
                          title="Approve"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button 
                          className={styles.rejectBtn}
                          onClick={() => handleOpenReject(request)}
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
                    {(request.status === "Archived" || request.status === "Rejected") && (
                      <button
                        className={styles.releaseBtn}
                        onClick={() => handleOpenUnarchive(request)}
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
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Applicant</span>
                    <span className={styles.cardValue}>{buildFullName(request)}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Contact</span>
                    <span className={styles.cardValue}>{request.contact_number || request.contactNumber}</span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Sector</span>
                    <div className={styles.cardValue}>
                      <div className={styles.sectorBadges} style={{ justifyContent: 'flex-end' }}>
                        {getSectorBadges(request).length ? (
                          getSectorBadges(request).map((sector) => (
                            <Badge key={sector} variant="secondary">
                              {sector}
                            </Badge>
                          ))
                        ) : (
                          <span className={styles.subtleText}>General</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Address</span>
                    <span className={styles.cardValue}>
                      {`${request.house_no || request.houseNo || ""}`.trim() || "-"}
                      <br/>
                      <span className={styles.addressMeta}>{`Purok ${request.purok || "-"}, ${request.barangay || "-"}`}</span>
                    </span>
                  </div>
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Submitted</span>
                    <span className={styles.cardValue}>{formatDate(request.created_at || request.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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
        {detailsRequest && (
          <div className={styles.detailsContent}>
            <div className={styles.detailsHeaderRow}>
              <div>
                <div className={styles.detailsId}>{detailsRequest.id}</div>
                <div className={styles.detailsSubmitted}>
                  Submitted: {formatDate(detailsRequest.created_at || detailsRequest.createdAt)}
                </div>
                {detailsLoading && <div className={styles.subtleText}>Loading full details…</div>}
              </div>
              <Badge
                variant={
                  detailsRequest.status === "Approved"
                    ? "success"
                    : detailsRequest.status === "Archived" || detailsRequest.status === "Rejected"
                    ? "secondary"
                    : "warning"
                }
              >
                {detailsRequest.status === "Archived" || detailsRequest.status === "Rejected"
                  ? "Archived"
                  : detailsRequest.status}
              </Badge>
            </div>

            <div className={styles.detailsSection}>
              <h3>Personal Information</h3>
              <div className={styles.detailsGrid}>
                <div>
                  <span className={styles.label}>Full Name</span>
                  <span className={styles.value}>{buildFullName(detailsRequest) || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Contact Number</span>
                  <span className={styles.value}>
                    {detailsRequest.contact_number || detailsRequest.contactNumber || "-"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Birthday</span>
                  <span className={styles.value}>
                    {formatDateOnly(detailsRequest.birthday || detailsRequest.birth_day || detailsRequest.birthDate)}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Age</span>
                  <span className={styles.value}>
                    {detailsRequest.age ?? calculateAgeFromBirthday(detailsRequest.birthday) ?? "-"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Birthplace</span>
                  <span className={styles.value}>{detailsRequest.birthplace || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Sex</span>
                  <span className={styles.value}>{detailsRequest.sex || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Citizenship</span>
                  <span className={styles.value}>{detailsRequest.citizenship || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Civil Status</span>
                  <span className={styles.value}>
                    {detailsRequest.civil_status || detailsRequest.civilStatus || "-"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Sector Classification</span>
                  <div className={styles.value}>
                    {getSectorBadges(detailsRequest).length ? (
                      getSectorBadges(detailsRequest).join(", ")
                    ) : (
                      <span className={styles.subtleText}>General</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className={styles.label}>Valid ID</span>
                  <div className={styles.value}>
                    {parseValidIdUrls(detailsRequest.valid_id_urls, detailsRequest.valid_id_url).length ? (
                      <div className={styles.validIdList}>
                        {parseValidIdUrls(detailsRequest.valid_id_urls, detailsRequest.valid_id_url).map((file, idx) => (
                          <Button
                            key={`${file}-${idx}`}
                            variant="outline"
                            size="small"
                            onClick={() => openDocument(file)}
                          >
                            {`View Valid ID ${idx + 1}`}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.subtleText}>-</span>
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
                  <span className={styles.value}>{detailsRequest.house_no || detailsRequest.houseNo || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Purok</span>
                  <span className={styles.value}>{detailsRequest.purok || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>Barangay</span>
                  <span className={styles.value}>{detailsRequest.barangay || "-"}</span>
                </div>
                <div>
                  <span className={styles.label}>City / Municipality</span>
                  <span className={styles.value}>{detailsRequest.city || "-"}</span>
                </div>
              </div>
            </div>

            {detailsRequest.notes && (
              <div className={styles.detailsSection}>
                <h3>Remarks</h3>
                <p className={styles.notes}>{detailsRequest.notes}</p>
              </div>
            )}

            {detailsRequest.status === "Pending" && (
              <div className={styles.detailsActionsRow}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenReject(detailsRequest)}
                    >
                      Archive
                    </Button>
                    <Button onClick={() => handleOpenApprove(detailsRequest)}>
                      Approve & Create Account
                    </Button>
                  </div>
                  <div className={styles.subtleText}>
                    The information provided during sign-up will be automatically reflected in the beneficiary profile after approval.
                  </div>
                </div>
              </div>
            )}

            {(detailsRequest.status === "Archived" || detailsRequest.status === "Rejected") && (
              <div className={styles.detailsActionsRow}>
                <Button variant="outline" onClick={() => handleOpenUnarchive(detailsRequest)}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p className={styles.confirmText} style={{ margin: 0 }}>
              You are about to approve this signup request and create a beneficiary account for
              <strong> {buildFullName(selectedRequest)} </strong>
              in the ALAGA Program. This can be updated later from User Management.
            </p>
            <div className={styles.subtleText}>
              The information provided during sign-up will be automatically reflected in the beneficiary profile after approval.
            </div>
          </div>
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

      <Modal
        isOpen={documentPreview.open}
        onClose={() => {
          setPreviewZoom(1);
          setDocumentPreview({ open: false, url: "" });
        }}
        title="Document Preview"
        size="large"
        footer={
          <Button
            onClick={() => {
              setPreviewZoom(1);
              setDocumentPreview({ open: false, url: "" });
            }}
          >
            Close
          </Button>
        }
      >
        {documentPreview.url ? (
          isLikelyImage(documentPreview.url) ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  >
                    -
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setPreviewZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  >
                    +
                  </Button>
                  <Button variant="secondary" size="small" onClick={() => setPreviewZoom(1)}>
                    Reset
                  </Button>
                </div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{Math.round(previewZoom * 100)}%</span>
              </div>
              <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <img
                  src={documentPreview.url}
                  alt="Uploaded document preview"
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    margin: "0 auto",
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "top center",
                  }}
                />
              </div>
            </div>
          ) : (
            <iframe
              src={documentPreview.url}
              title="Uploaded document preview"
              style={{ width: "100%", height: "70vh", border: 0 }}
            />
          )
        ) : (
          <p style={{ margin: 0 }}>No document available for preview.</p>
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
