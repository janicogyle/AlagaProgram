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
  const parts = [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean);
  return parts.join(" ");
}

function getSectorBadges(resident) {
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
              <Button variant="secondary" onClick={handleOpenReset} disabled={processing}>
                Reset Password
              </Button>
              <Button onClick={() => setSelectedResident(null)} disabled={processing}>
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
