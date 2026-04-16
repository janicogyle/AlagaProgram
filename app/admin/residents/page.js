"use client";

import { useEffect, useMemo, useState } from "react";
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
import { supabase } from '@/lib/supabaseClient';

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function buildFullName(resident) {
  if (!resident) return "-";
  const parts = [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || "-";
}

function getSectorBadges(resident) {
  if (!resident) return [];
  const sectors = [];
  if (resident.is_pwd) sectors.push("PWD");
  if (resident.is_senior_citizen) sectors.push("Senior Citizen");
  if (resident.is_solo_parent) sectors.push("Solo Parent");
  return sectors;
}

export default function ResidentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResident, setSelectedResident] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [issuingCard, setIssuingCard] = useState(false);
  const [issuedCard, setIssuedCard] = useState(null); // { token, card, qrUrl }
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) throw new Error('Not authenticated. Please log in again.');

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchResidents = async () => {
    try {
      const response = await fetch("/api/residents");
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to fetch beneficiaries");
      }

      setResidents(result.data || []);
    } catch (error) {
      console.error("Failed to fetch beneficiaries:", error);
      setResidents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredResidents = useMemo(() => {
    const query = searchTerm.toLowerCase();

    return residents.filter((r) => {
      const fullName = buildFullName(r).toLowerCase();
      const contact = String(r.contact_number || "").toLowerCase();
      const control = String(r.control_number || "").toLowerCase();

      const matchesSearch = !query || fullName.includes(query) || contact.includes(query) || control.includes(query);
      const matchesStatus = !statusFilter || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [residents, searchTerm, statusFilter]);

  const columns = [
    {
      key: "beneficiary",
      label: "Beneficiary",
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{buildFullName(row)}</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{row.contact_number || "-"}</div>
        </div>
      ),
    },
    {
      key: "control_number",
      label: "Control No.",
      render: (value) => (
        <span style={{ fontFamily: "'Courier New', monospace" }}>{value || "-"}</span>
      ),
    },
    {
      key: "sector",
      label: "Sector",
      render: (_, row) => {
        const sectors = getSectorBadges(row);
        if (!sectors.length) return <span style={{ color: "#6b7280" }}>General</span>;
        return (
          <div className={styles.badges}>
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
        <div>
          <div>{`${row.house_no || ""} ${row.street || ""}`.trim() || "-"}</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {`Purok ${row.purok || "-"}, ${row.barangay || "-"}`}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (status) => (
        <Badge variant={status === "Active" ? "success" : "secondary"}>{status || "-"}</Badge>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (value) => <span>{formatDate(value)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <Button variant="secondary" size="small" onClick={() => setSelectedResident(row)}>
          View
        </Button>
      ),
    },
  ];

  const handleOpenReset = () => {
    setResetPassword('');
    setResetPasswordConfirm('');
    setResetModalOpen(true);
  };

  const handleCloseReset = () => {
    setResetModalOpen(false);
    setResetPassword('');
    setResetPasswordConfirm('');
  };

  const handleConfirmReset = async () => {
    if (!selectedResident || processing) return;

    if (!resetPassword || resetPassword.length < 8) {
      openAlert({ title: 'Reset failed', message: 'Password must be at least 8 characters.' });
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      openAlert({ title: 'Reset failed', message: 'Passwords do not match.' });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/residents/${selectedResident.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Failed to reset password');
      }

      handleCloseReset();
      openAlert({ title: 'Password reset', message: 'Beneficiary password updated successfully.' });
    } catch (error) {
      console.error('Reset resident password error:', error);
      openAlert({ title: 'Reset failed', message: error.message || 'Unknown error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleIssueCard = async () => {
    if (!selectedResident || issuingCard) return;

    setIssuingCard(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/beneficiary-cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ residentId: selectedResident.id, expiresInDays: 365 }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        const msg = String(payload?.error || 'Failed to issue ID card.');
        openAlert({ title: 'Issue failed', message: msg });
        return;
      }

      const token = payload?.data?.token;
      const card = payload?.data?.card;
      if (!token || !card) {
        openAlert({ title: 'Issue failed', message: 'Card issued but token missing.' });
        return;
      }

      const qrcodeMod = await import('qrcode');
      const QRCode = qrcodeMod.default ?? qrcodeMod;
      const qrUrl = await QRCode.toDataURL(token, { margin: 1, width: 260 });

      setIssuedCard({ token, card, qrUrl });
      setCardModalOpen(true);
    } catch (error) {
      const msg = String(error?.message || error || 'Unknown error');
      // Avoid console.error in dev overlay; we already show the message to the user.
      console.warn('Issue card failed:', msg);
      openAlert({ title: 'Issue failed', message: msg });
    } finally {
      setIssuingCard(false);
    }
  };

  return (
    <div className={styles.residentsPage}>
      <Card padding={false}>
        <PageHeader
          title="Beneficiaries"
          subtitle="View beneficiary accounts created from approved signup requests"
        />

        <FilterBar>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name, contact number, or control number..."
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

        {loading && <p style={{ padding: 16 }}>Loading beneficiaries…</p>}
        {!loading && <Table columns={columns} data={filteredResidents} />}

        <DataTableFooter
          showing={filteredResidents.length}
          total={residents.length}
          itemName="beneficiaries"
        />
      </Card>

      <Modal
        isOpen={!!selectedResident}
        onClose={() => {
          setSelectedResident(null);
          handleCloseReset();
        }}
        title="Beneficiary Details"
        footer={
          selectedResident ? (
            <>
              <Button variant="secondary" onClick={handleOpenReset} disabled={processing || issuingCard}>
                Reset Password
              </Button>
              <Button variant="secondary" onClick={handleIssueCard} disabled={processing || issuingCard}>
                {issuingCard ? 'Issuing…' : 'Issue ID QR'}
              </Button>
              <Button onClick={() => setSelectedResident(null)} disabled={processing || issuingCard}>
                Close
              </Button>
            </>
          ) : null
        }
      >
        {selectedResident && (
          <div className={styles.assistanceModalContent}>
            <div className={styles.assistanceResidentInfo}>
              <div className={styles.assistanceResidentHeader}>
                <div>
                  <p className={styles.assistanceResidentName}>{buildFullName(selectedResident)}</p>
                  <div className={styles.assistanceResidentMeta}>
                    <span className={styles.assistanceResidentDetail}>
                      Contact: {selectedResident.contact_number || "-"}
                    </span>
                    <span className={styles.assistanceResidentDetail}>
                      Control: {selectedResident.control_number || "-"}
                    </span>
                  </div>
                </div>
                <Badge variant={selectedResident.status === "Active" ? "success" : "secondary"}>
                  {selectedResident.status || "-"}
                </Badge>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px" }}>Address</h3>
              <p style={{ margin: 0, color: "#374151" }}>
                {`${selectedResident.house_no || ""} ${selectedResident.street || ""}`.trim() || "-"}
              </p>
              <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
                {`Purok ${selectedResident.purok || "-"}, ${selectedResident.barangay || "-"}, ${
                  selectedResident.city || "-"
                }`}
              </p>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px" }}>Sector Classification</h3>
              {getSectorBadges(selectedResident).length ? (
                <div className={styles.badges}>
                  {getSectorBadges(selectedResident).map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#6b7280" }}>General</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!selectedResident && resetModalOpen}
        onClose={handleCloseReset}
        title="Reset Beneficiary Password"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseReset} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReset} disabled={processing}>
              {processing ? 'Saving…' : 'Save Password'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="New Password"
            name="newPassword"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={resetPasswordConfirm}
            onChange={(e) => setResetPasswordConfirm(e.target.value)}
          />
        </div>
      </Modal>

      {/* Issued ID Card Modal */}
      <Modal
        isOpen={!!selectedResident && cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        title="Beneficiary ID (QR)"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (!issuedCard?.qrUrl) return;
                const a = document.createElement('a');
                a.href = issuedCard.qrUrl;
                a.download = `${selectedResident?.control_number || 'beneficiary'}_id_qr.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              disabled={!issuedCard?.qrUrl}
            >
              Download QR
            </Button>
            <Button onClick={() => setCardModalOpen(false)}>Close</Button>
          </>
        }
      >
        {issuedCard ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <img
              src={issuedCard.qrUrl}
              alt="Beneficiary ID QR"
              style={{ width: 260, height: 260, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white' }}
            />
            <div style={{ minWidth: 240 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{buildFullName(selectedResident)}</p>
              <p style={{ margin: '0 0 8px', color: '#6b7280' }}>
                Expires: {issuedCard.card?.expires_at ? new Date(issuedCard.card.expires_at).toLocaleDateString() : '-'}
              </p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                Tip: You can verify this QR on the “Verify Beneficiary ID” page.
              </p>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No card issued yet.</p>
        )}
      </Modal>

      {/* Alert Modal */}
      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={
          <>
            <Button onClick={closeAlert}>OK</Button>
          </>
        }
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>
    </div>
  );
}
