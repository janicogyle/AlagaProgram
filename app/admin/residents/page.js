"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
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

const sexOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const civilStatusOptions = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Ensures values used in <input type="date" /> are always YYYY-MM-DD.
function toDateInputValue(value) {
  if (!value) return '';
  const s = String(value).trim();

  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Common formatted date: MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = pad2(mdy[1]);
    const dd = pad2(mdy[2]);
    const yyyy = mdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: parseable date string (avoid timezone shifting by using local parts)
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  return '';
}

function buildFullName(resident) {
  if (!resident) return "-";
  const parts = [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || "-";
}

function displayValue(v) {
  const s = String(v ?? '').trim();
  return s || '-';
}

function formatAddressLine(resident) {
  if (!resident) return '-';

  const houseNo = String(resident.house_no ?? '').trim();
  const purok = String(resident.purok ?? '').trim();
  const barangay = String(resident.barangay ?? '').trim();
  const city = String(resident.city ?? '').trim();

  const parts = [];
  if (houseNo) parts.push(houseNo);
  if (purok) parts.push(`Purok ${purok}`);
  if (barangay) parts.push(barangay);
  if (city) parts.push(city);

  return parts.length ? parts.join(', ') : '-';
}

function computeAgeFromBirthday(birthday) {
  if (!birthday) return null;
  const d = new Date(birthday);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
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
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [verifyResetOpen, setVerifyResetOpen] = useState(false);
  const [verifyResetProcessing, setVerifyResetProcessing] = useState(false);
  const [issuingCard, setIssuingCard] = useState(false);
  const [issuedCard, setIssuedCard] = useState(null); // { token, card, qrUrl }
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });

  const [isAdmin, setIsAdmin] = useState(false);
  const [residentDetails, setResidentDetails] = useState(null); // { resident, signup }
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editErrors, setEditErrors] = useState({ contact_number: '' });
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    birthday: '',
    birthplace: '',
    sex: '',
    citizenship: '',
    civil_status: '',
    contact_number: '',
    house_no: '',
    purok: '',
    barangay: '',
    city: '',
    is_pwd: false,
    is_senior_citizen: false,
    is_solo_parent: false,
    status: 'Active',
  });

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('adminUser') : null;
      const user = raw ? JSON.parse(raw) : null;
      setIsAdmin(user?.role === 'Admin');
    } catch {
      setIsAdmin(false);
    }

    fetchResidents();
  }, []);

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    let session = data?.session;

    const isExpired = session?.expires_at ? session.expires_at * 1000 <= Date.now() + 5000 : false;
    if (!error && session && !isExpired) {
      return { Authorization: `Bearer ${session.access_token}` };
    }

    // Session can be stale in memory; attempt refresh before failing.
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    session = refreshData?.session;
    if (refreshError || !session) throw new Error('Not authenticated. Please log in again.');

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchResidents = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/residents", { headers });
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to fetch beneficiaries");
      }

      setResidents(result.data || []);
    } catch (error) {
      console.warn("Failed to fetch beneficiaries:", error?.message || error);
      openAlert({
        title: 'Load failed',
        message: error?.message || 'Failed to fetch beneficiaries.',
      });
      setResidents([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeContactNumber = (input) => {
    const digits = String(input || '').replace(/\D/g, '');

    if (digits.length === 12 && digits.startsWith('63')) {
      return `0${digits.slice(2)}`;
    }

    if (digits.length === 10) {
      return `0${digits}`;
    }

    if (digits.length > 11) {
      return digits.slice(-11);
    }

    return digits;
  };

  const fetchResidentDetails = async (residentId) => {
    if (!residentId) return;

    setDetailsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/residents/${residentId}`, {
        headers,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to load beneficiary details.');
      }

      setResidentDetails(json?.data || null);
    } catch (err) {
      console.warn('Failed to load beneficiary details:', err?.message || err);
      setResidentDetails(null);
      openAlert({ title: 'Load failed', message: err?.message || 'Failed to load beneficiary details.' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const openDocument = async (pathOrUrl) => {
    if (!pathOrUrl) return;

    try {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        window.open(pathOrUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch(`/api/documents/view?path=${encodeURIComponent(pathOrUrl)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

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
      });
    }
  };

  useEffect(() => {
    if (!selectedResident) {
      setResidentDetails(null);
      setDetailsLoading(false);
      return;
    }

    fetchResidentDetails(selectedResident.id);
  }, [selectedResident, isAdmin]);

  const openEditProfile = () => {
    if (!isAdmin || !selectedResident) {
      openAlert({ title: 'Forbidden', message: 'Only Admin accounts can edit beneficiary profiles.' });
      return;
    }

    const base = residentDetails?.resident || selectedResident;

    setEditErrors({ contact_number: '' });
    setEditForm({
      first_name: base.first_name || '',
      middle_name: base.middle_name || '',
      last_name: base.last_name || '',
      birthday: toDateInputValue(base.birthday),
      birthplace: base.birthplace || '',
      sex: base.sex || '',
      citizenship: base.citizenship || '',
      civil_status: base.civil_status || '',
      contact_number: base.contact_number || '',
      house_no: base.house_no || '',
      purok: base.purok || '',
      barangay: base.barangay || '',
      city: base.city || '',
      is_pwd: !!base.is_pwd,
      is_senior_citizen: !!base.is_senior_citizen,
      is_solo_parent: !!base.is_solo_parent,
      status: base.status || 'Active',
    });

    setEditProfileOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, type, checked, value } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (name === 'is_pwd' || name === 'is_senior_citizen' || name === 'is_solo_parent') {
      // Only one sector classification is allowed
      setEditForm((prev) => ({
        ...prev,
        is_pwd: name === 'is_pwd' ? !!nextValue : false,
        is_senior_citizen: name === 'is_senior_citizen' ? !!nextValue : false,
        is_solo_parent: name === 'is_solo_parent' ? !!nextValue : false,
      }));
      return;
    }

    if (name === 'contact_number' && editErrors.contact_number) {
      setEditErrors((prev) => ({ ...prev, contact_number: '' }));
    }

    setEditForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleSaveProfile = async () => {
    if (!selectedResident || savingProfile) return;

    const contact = normalizeContactNumber(editForm.contact_number);
    if (!contact || contact.length !== 11) {
      setEditErrors({ contact_number: 'Contact number must be 11 digits.' });
      return;
    }

    if (!editForm.first_name?.trim() || !editForm.last_name?.trim()) {
      openAlert({ title: 'Save failed', message: 'First name and last name are required.' });
      return;
    }

    setSavingProfile(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/residents/${selectedResident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          ...editForm,
          contact_number: contact,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = json?.error || 'Failed to update beneficiary profile.';

        // Show contact-number uniqueness/validation problems inline
        if (res.status === 409 || /contact number/i.test(msg) || /already in use/i.test(msg) || /duplicate/i.test(msg)) {
          setEditErrors({ contact_number: msg });
          return;
        }

        throw new Error(msg);
      }

      // If server accepted the save but key fields remain blank, surface it loudly.
      const attempted = {
        birthplace: editForm.birthplace,
        sex: editForm.sex,
        citizenship: editForm.citizenship,
        civil_status: editForm.civil_status,
      };

      if (json?.error) {
        throw new Error(json.error);
      }

      const updated = json?.data;

      if (updated?.id) {
        setResidents((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
        setSelectedResident((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
        setResidentDetails((prev) => (prev?.resident?.id === updated.id ? { ...prev, resident: { ...prev.resident, ...updated } } : prev));
      }

      const normalize = (v) => String(v ?? '').trim();
      const stillBlank =
        (normalize(attempted.birthplace) && !normalize(updated?.birthplace)) ||
        (normalize(attempted.sex) && !normalize(updated?.sex)) ||
        (normalize(attempted.citizenship) && !normalize(updated?.citizenship)) ||
        (normalize(attempted.civil_status) && !normalize(updated?.civil_status));

      if (stillBlank) {
        openAlert({
          title: 'Saved partially',
          message:
            'Some fields could not be saved (Birthplace / Sex / Citizenship / Civil Status).\n\n' +
            "Run in Supabase SQL Editor: NOTIFY pgrst, 'reload schema'; then try saving again.",
        });
        return;
      }

      setEditProfileOpen(false);
      openAlert({ title: 'Saved', message: 'Beneficiary profile updated successfully.' });
    } catch (err) {
      openAlert({ title: 'Save failed', message: err?.message || 'Unable to save changes.' });
    } finally {
      setSavingProfile(false);
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
          <div>{formatAddressLine(row)}</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            House No.: {displayValue(row.house_no)} • Purok: {displayValue(row.purok)} • Barangay: {displayValue(row.barangay)}
          </div>
        </div>
      ),
    },
    {
      key: "qr_validity",
      label: "QR Validity",
      render: (_, row) => {
        const status = String(row?.qr_validity || 'Not Setup');
        const variant =
          status === 'Valid'
            ? 'success'
            : status === 'Expired'
              ? 'warning'
              : status === 'No QR'
                ? 'secondary'
                : status === 'Not Setup'
                  ? 'secondary'
                  : status === 'Unavailable'
                    ? 'warning'
                    : 'danger';

        const expires = row?.qr_card?.expires_at
          ? new Date(row.qr_card.expires_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })
          : null;

        return (
          <div>
            <Badge variant={variant}>{status}</Badge>
            {expires ? (
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                Expires: {expires}
              </div>
            ) : null}
          </div>
        );
      },
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
    setVerifyResetOpen(true);
  };

  const handleContinueReset = async () => {
    if (!resetAdminPassword) {
      openAlert({ title: 'Verification required', message: 'Enter your admin password first.' });
      return;
    }

    setVerifyResetProcessing(true);
    try {
      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      const adminEmail = authUserData?.user?.email;
      if (authUserError || !adminEmail) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: resetAdminPassword,
      });
      if (signInError) {
        throw new Error('Admin password verification failed.');
      }

      setResetPassword('');
      setResetPasswordConfirm('');
      setResetModalOpen(true);
      setVerifyResetOpen(false);
    } catch (error) {
      const message = error.message || 'Invalid admin password.';
      openAlert({
        title: 'Verification failed',
        message: message === 'Unauthorized.'
          ? 'Your admin session has expired. Please log in again.'
          : message,
      });
    } finally {
      setVerifyResetProcessing(false);
    }
  };

  const handleCloseReset = () => {
    setResetModalOpen(false);
    setVerifyResetOpen(false);
    setResetPassword('');
    setResetPasswordConfirm('');
    setResetAdminPassword('');
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

    if (!resetAdminPassword) {
      openAlert({ title: 'Reset failed', message: 'Your password is required for verification.' });
      return;
    }

    setProcessing(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/residents/${selectedResident.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
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

  const canSaveResetPassword =
    resetPassword.length >= 8 &&
    resetPasswordConfirm.length >= 8 &&
    resetPassword === resetPasswordConfirm &&
    !processing;

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

  const effectiveResident = residentDetails?.resident || selectedResident;
  const signupInfo = residentDetails?.signup || null;

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
          setResidentDetails(null);
          setEditProfileOpen(false);
          handleCloseReset();
        }}
        title="Beneficiary Details"
        footer={
          selectedResident ? (
            <>
              {isAdmin ? (
                <Button
                  variant="secondary"
                  onClick={openEditProfile}
                  disabled={processing || issuingCard || detailsLoading}
                >
                  Edit Profile
                </Button>
              ) : null}
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
            {detailsLoading ? (
              <p style={{ margin: 0, color: '#6b7280' }}>Loading full details…</p>
            ) : null}

            <div className={styles.assistanceResidentInfo}>
              <div className={styles.assistanceResidentHeader}>
                <div>
                  <p className={styles.assistanceResidentName}>{buildFullName(effectiveResident)}</p>
                  <div className={styles.assistanceResidentMeta}>
                    <span className={styles.assistanceResidentDetail}>
                      Contact: {effectiveResident?.contact_number || "-"}
                    </span>
                    <span className={styles.assistanceResidentDetail}>
                      Control: {effectiveResident?.control_number || "-"}
                    </span>
                  </div>
                </div>
                <Badge variant={effectiveResident?.status === "Active" ? "success" : "secondary"}>
                  {effectiveResident?.status || "-"}
                </Badge>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px" }}>Address</h3>

              <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#374151' }}>
                <div>
                  Complete Address: <strong>{formatAddressLine(effectiveResident)}</strong>
                </div>
                <div>
                  House No.: <strong>{displayValue(effectiveResident?.house_no)}</strong>
                </div>
                <div>
                  Purok: <strong>{displayValue(effectiveResident?.purok)}</strong>
                </div>
                <div>
                  Barangay: <strong>{displayValue(effectiveResident?.barangay)}</strong>
                </div>
                <div>
                  City/Municipality: <strong>{displayValue(effectiveResident?.city)}</strong>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px" }}>Personal Information</h3>
              <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#374151' }}>
                <div>
                  Birthday:{' '}
                  <strong>
                    {effectiveResident?.birthday
                      ? new Date(effectiveResident.birthday).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                        })
                      : '-'}
                  </strong>
                </div>
                <div>
                  Birthplace: <strong>{effectiveResident?.birthplace || '-'}</strong>
                </div>
                <div>
                  Sex: <strong>{effectiveResident?.sex || '-'}</strong>
                </div>
                <div>
                  Citizenship: <strong>{effectiveResident?.citizenship || '-'}</strong>
                </div>
                <div>
                  Civil Status: <strong>{effectiveResident?.civil_status || '-'}</strong>
                </div>
                <div>
                  {(() => {
                    const stored = Number(effectiveResident?.age);
                    const computed = computeAgeFromBirthday(effectiveResident?.birthday);
                    const value = Number.isFinite(stored) && stored > 0 ? stored : computed;
                    return (
                      <>
                        Age: <strong>{value == null ? '-' : value}</strong>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px" }}>Sector Classification</h3>
              {getSectorBadges(effectiveResident).length ? (
                <div className={styles.badges}>
                  {getSectorBadges(effectiveResident).map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#6b7280" }}>General</p>
              )}
            </div>

            {isAdmin ? (
              <div>
                <h3 style={{ margin: '0 0 10px' }}>Sign-up Submission</h3>
                {signupInfo ? (
                  <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#374151' }}>
                    <div>
                      Submitted:{' '}
                      <strong>
                        {signupInfo?.created_at
                          ? new Date(signupInfo.created_at).toLocaleString('en-PH', {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </strong>
                    </div>
                    <div>
                      Request Status: <strong>{signupInfo?.status || '-'}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Valid ID:</span>
                      {signupInfo?.valid_id_url ? (
                        <Button variant="secondary" size="small" onClick={() => openDocument(signupInfo.valid_id_url)}>
                          View Uploaded ID
                        </Button>
                      ) : (
                        <strong>-</strong>
                      )}
                    </div>
                    {signupInfo?.notes ? (
                      <div>
                        Notes: <strong>{signupInfo.notes}</strong>
                      </div>
                    ) : null}
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                      The submitted values are automatically reflected above.
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#6b7280' }}>
                    No sign-up record was found for this beneficiary. This usually means the beneficiary was registered
                    manually or was created before sign-up tracking was enabled.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Edit Beneficiary Profile Modal (Admin only) */}
      <Modal
        isOpen={!!selectedResident && editProfileOpen}
        onClose={() => {
          if (savingProfile) return;
          setEditProfileOpen(false);
        }}
        title={effectiveResident ? `Edit Profile: ${buildFullName(effectiveResident)}` : 'Edit Profile'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditProfileOpen(false)} disabled={savingProfile}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input
              label="First Name"
              name="first_name"
              value={editForm.first_name}
              onChange={handleEditChange}
              required
            />
            <Input
              label="Middle Name"
              name="middle_name"
              value={editForm.middle_name}
              onChange={handleEditChange}
              optional
            />
            <Input
              label="Last Name"
              name="last_name"
              value={editForm.last_name}
              onChange={handleEditChange}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Birthday"
              type="date"
              name="birthday"
              value={editForm.birthday}
              onChange={handleEditChange}
              max={new Date().toISOString().slice(0, 10)}
            />
            <Input
              label="Birthplace"
              name="birthplace"
              value={editForm.birthplace}
              onChange={handleEditChange}
              optional
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select
              label="Sex"
              name="sex"
              value={editForm.sex}
              onChange={handleEditChange}
              options={sexOptions}
              placeholder="Select sex"
            />
            <Select
              label="Civil Status"
              name="civil_status"
              value={editForm.civil_status}
              onChange={handleEditChange}
              options={civilStatusOptions}
              placeholder="Select civil status"
            />
          </div>

          <Input
            label="Citizenship"
            name="citizenship"
            value={editForm.citizenship}
            onChange={handleEditChange}
            optional
          />

          <Input
            label="Contact Number"
            name="contact_number"
            value={editForm.contact_number}
            onChange={handleEditChange}
            placeholder="09XXXXXXXXX"
            error={editErrors.contact_number}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="House No."
              name="house_no"
              value={editForm.house_no}
              onChange={handleEditChange}
              optional
            />
            <Input
              label="Purok"
              name="purok"
              value={editForm.purok}
              onChange={handleEditChange}
              optional
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Barangay"
              name="barangay"
              value={editForm.barangay}
              onChange={handleEditChange}
              optional
            />
            <Input
              label="City"
              name="city"
              value={editForm.city}
              onChange={handleEditChange}
              optional
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>Sector Classification (choose one)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}>
                <input type="checkbox" name="is_pwd" checked={!!editForm.is_pwd} onChange={handleEditChange} />
                PWD
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}>
                <input
                  type="checkbox"
                  name="is_senior_citizen"
                  checked={!!editForm.is_senior_citizen}
                  onChange={handleEditChange}
                />
                Senior Citizen
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}>
                <input
                  type="checkbox"
                  name="is_solo_parent"
                  checked={!!editForm.is_solo_parent}
                  onChange={handleEditChange}
                />
                Solo Parent
              </label>
            </div>
          </div>

          <Select
            label="Status"
            name="status"
            value={editForm.status}
            onChange={handleEditChange}
            options={statusOptions.filter((o) => o.value)}
            placeholder="Select status"
          />

          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Note: “Sign-up submission” fields are shown separately and remain as originally submitted.
          </p>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!selectedResident && verifyResetOpen}
        onClose={() => setVerifyResetOpen(false)}
        title="Verify Admin Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVerifyResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueReset} disabled={verifyResetProcessing}>
              {verifyResetProcessing ? 'Verifying...' : 'Continue'}
            </Button>
          </>
        }
      >
        <Input
          label="Your Password"
          name="verifyAdminPassword"
          type="password"
          value={resetAdminPassword}
          onChange={(e) => setResetAdminPassword(e.target.value)}
          placeholder="Enter your password to continue"
          required
        />
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
            <Button onClick={handleConfirmReset} disabled={!canSaveResetPassword}>
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
          <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
            Admin verification was completed before this step.
          </p>
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
