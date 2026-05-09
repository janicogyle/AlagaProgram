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
import { getCooldownInfo, parseDateInput } from '@/lib/requestCooldown';

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const sectorOptions = [
  { value: "", label: "All Sectors" },
  { value: "PWD", label: "PWD" },
  { value: "Senior Citizen", label: "Senior Citizen" },
  { value: "Solo Parent", label: "Solo Parent" },
];

const qrOptions = [
  { value: "", label: "All QR" },
  { value: "Valid", label: "Valid" },
  { value: "Expired", label: "Expired" },
  { value: "No QR", label: "No QR" },
];

const sortOptions = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "control_desc", label: "Control No. (Newest–Oldest)" },
  { value: "control_asc", label: "Control No. (Oldest–Newest)" },
  { value: "created_desc", label: "Date Created (Newest First)" },
  { value: "created_asc", label: "Date Created (Oldest First)" },
];

const sexOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const isLikelyImage = (fileUrl) => /\.(png|jpe?g|gif|webp)$/i.test(String(fileUrl || ''));
const shouldUseInAppPreview = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;

const civilStatusOptions = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
];

const purokOptions = [
  { value: '1A', label: '1A' },
  { value: '1B', label: '1B' },
  { value: '2', label: '2' },
  { value: '3A', label: '3A' },
  { value: '3B', label: '3B' },
  { value: '3C', label: '3C' },
  { value: '3D', label: '3D' },
  { value: '3E', label: '3E' },
  { value: '3F', label: '3F' },
  { value: '4A', label: '4A' },
  { value: '4B', label: '4B' },
  { value: '4C', label: '4C' },
  { value: '4D', label: '4D' },
  { value: '4E', label: '4E' },
  { value: '5A', label: '5A' },
  { value: '5A1', label: '5A1' },
  { value: '5A2', label: '5A2' },
  { value: '5B', label: '5B' },
  { value: '5C', label: '5C' },
  { value: '5D', label: '5D' },
  { value: '5E', label: '5E' },
  { value: '5F', label: '5F' },
  { value: '6A', label: '6A' },
  { value: '6A EXT.', label: '6A EXT.' },
  { value: '6B1', label: '6B1' },
  { value: '6B2', label: '6B2' },
  { value: '6C1', label: '6C1' },
  { value: '6C2', label: '6C2' },
  { value: '6D', label: '6D' },
  { value: '6E', label: '6E' },
  { value: '7', label: '7' },
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

function parseControlNumber(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d+)$/);
  if (!match) {
    return { year: 0, seq: 0, raw };
  }
  return {
    year: Number(match[1]) || 0,
    seq: Number(match[2]) || 0,
    raw,
  };
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
  const [statusFilter, setStatusFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [qrFilter, setQrFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");
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
  const [editVerifyOpen, setEditVerifyOpen] = useState(false);
  const [editVerifyProcessing, setEditVerifyProcessing] = useState(false);
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [issuingCard, setIssuingCard] = useState(false);
  const [issuedCard, setIssuedCard] = useState(null); // { token, card, qrUrl }
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });

  const [isAdmin, setIsAdmin] = useState(false);
  const [residentDetails, setResidentDetails] = useState(null); // { resident, signup }
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRequests, setHistoryRequests] = useState([]);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editErrors, setEditErrors] = useState({ contact_number: '' });
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: '' });
  const [previewZoom, setPreviewZoom] = useState(1);
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

  const openDocumentPreview = (url) => {
    setPreviewZoom(1);
    setDocumentPreview({ open: true, url: String(url || '') });
  };

  const closeDocumentPreview = () => {
    setPreviewZoom(1);
    setDocumentPreview({ open: false, url: '' });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const formatHistoryDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatAmount = (value) =>
    (Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getAssistanceTypeLabel = (row) => {
    const value = row?.assistance_type || row?.service_type || row?.other_service || '';
    const label = String(value || '').trim();
    return label || 'Assistance';
  };

  const getHistoryTypeBadge = (type) => {
    const variants = {
      'Medicine Assistance': 'green',
      'Confinement Assistance': 'blue',
      'Burial Assistance': 'purple',
      Others: 'secondary',
    };
    return <Badge variant={variants[type] || 'default'}>{type}</Badge>;
  };

  const formatEligibilityDate = (value) => {
    const parsed = parseDateInput(value);
    if (!parsed) return null;
    return parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const getEligibilityBadge = (info) => {
    if (!info) return <Badge variant="secondary">—</Badge>;

    const variant =
      info.status === 'Eligible' ? 'success' : info.status === 'Almost Eligible' ? 'warning' : 'danger';

    const daysSuffix = info.isEligible
      ? ''
      : ` • ${info.daysRemaining} day${info.daysRemaining === 1 ? '' : 's'}`;

    const eligibleOn = info.isEligible ? null : formatEligibilityDate(info.nextEligibleDate);
    const dateSuffix = eligibleOn ? ` • Eligible on ${eligibleOn}` : '';

    return <Badge variant={variant}>{`${info.status}${daysSuffix}${dateSuffix}`}</Badge>;
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

  const loadHistory = async (residentId) => {
    if (!residentId) return;
    setHistoryLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/assistance-requests?residentId=${encodeURIComponent(residentId)}&status=Released`,
        { headers },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to load assistance history.');
      }
      const rows = Array.isArray(json?.data) ? json.data : [];
      const released = rows.filter(
        (row) => String(row?.status || '').toLowerCase() === 'released',
      );
      const normalized = released
        .map((row) => ({
          ...row,
          _historyTime: new Date(row?.request_date || row?.created_at || 0).getTime() || 0,
        }))
        .sort((a, b) => b._historyTime - a._historyTime);
      setHistoryRequests(normalized);
    } catch (err) {
      console.warn('Failed to load assistance history:', err?.message || err);
      setHistoryRequests([]);
      openAlert({
        title: 'Load failed',
        message: err?.message || 'Failed to load assistance history.',
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = () => {
    if (!selectedResident) return;
    setHistoryOpen(true);
    loadHistory(selectedResident.id);
  };

  const handleCloseHistory = () => {
    setHistoryOpen(false);
    setHistoryRequests([]);
    setHistoryLoading(false);
  };

  const openDocument = async (pathOrUrl) => {
    if (!pathOrUrl) return;

    try {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        openDocumentPreview(pathOrUrl);
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

      openDocumentPreview(url);
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
      setHistoryRequests([]);
      setHistoryLoading(false);
      return;
    }

    fetchResidentDetails(selectedResident.id);
    setHistoryRequests([]);
    loadHistory(selectedResident.id);
  }, [selectedResident, isAdmin]);

  const cooldownInfo = useMemo(() => {
    const latestReleased = historyRequests[0];
    const lastRequestDate = latestReleased?.request_date || latestReleased?.created_at || null;
    return getCooldownInfo(lastRequestDate);
  }, [historyRequests]);

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

    const matchesSector = (resident) => {
      if (!sectorFilter) return true;
      if (sectorFilter === 'PWD') return !!resident.is_pwd;
      if (sectorFilter === 'Senior Citizen') return !!resident.is_senior_citizen;
      if (sectorFilter === 'Solo Parent') return !!resident.is_solo_parent;
      return true;
    };

    const matchesQr = (resident) => {
      if (!qrFilter) return true;
      const status = String(resident?.qr_validity || 'Not Setup');
      if (qrFilter === 'No QR') {
        return status === 'No QR' || status === 'Not Setup' || status === 'Unavailable';
      }
      return status === qrFilter;
    };

    const filtered = residents.filter((r) => {
      const fullName = buildFullName(r).toLowerCase();
      const contact = String(r.contact_number || "").toLowerCase();
      const control = String(r.control_number || "").toLowerCase();

      const matchesSearch =
        !query || fullName.includes(query) || contact.includes(query) || control.includes(query);
      const matchesStatus = !statusFilter || r.status === statusFilter;

      return matchesSearch && matchesStatus && matchesSector(r) && matchesQr(r);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc' || sortBy === 'name_desc') {
        const aName = buildFullName(a).toLowerCase();
        const bName = buildFullName(b).toLowerCase();
        const cmp = aName.localeCompare(bName);
        return sortBy === 'name_asc' ? cmp : -cmp;
      }

      if (sortBy === 'control_asc' || sortBy === 'control_desc') {
        const aControl = parseControlNumber(a.control_number);
        const bControl = parseControlNumber(b.control_number);
        const yearCmp = aControl.year - bControl.year;
        const seqCmp = aControl.seq - bControl.seq;
        const cmp = yearCmp !== 0 ? yearCmp : seqCmp !== 0 ? seqCmp : aControl.raw.localeCompare(bControl.raw);
        return sortBy === 'control_asc' ? cmp : -cmp;
      }

      if (sortBy === 'created_asc' || sortBy === 'created_desc') {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        const cmp = aDate - bDate;
        return sortBy === 'created_asc' ? cmp : -cmp;
      }

      return 0;
    });

    return sorted;
  }, [residents, searchTerm, statusFilter, sectorFilter, qrFilter, sortBy]);

  const historySummary = useMemo(() => {
    const totalCount = historyRequests.length;
    const totalAmount = historyRequests.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
    const latest = historyRequests[0] || null;
    return {
      totalCount,
      totalAmount,
      lastDate: latest ? formatHistoryDate(latest.request_date || latest.created_at) : '-',
    };
  }, [historyRequests]);

  const historyColumns = [
    {
      key: 'controlNo',
      label: 'Control No.',
      render: (value) => <span className={styles.historyControlNo}>{value}</span>,
    },
    { key: 'requester', label: 'Requester' },
    { key: 'beneficiary', label: 'Beneficiary' },
    {
      key: 'type',
      label: 'Type',
      render: (value) => getHistoryTypeBadge(value),
    },
    { key: 'date', label: 'Date' },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => <span style={{ fontWeight: 600 }}>{value}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant="success">{value}</Badge>,
    },
  ];

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

  const handleOpenEditVerify = () => {
    setEditVerifyOpen(true);
  };

  const handleCloseEditVerify = () => {
    if (editVerifyProcessing) return;
    setEditVerifyOpen(false);
    setEditAdminPassword('');
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

  const handleContinueEditVerify = async () => {
    if (!editAdminPassword) {
      openAlert({ title: 'Verification required', message: 'Enter your admin password first.' });
      return;
    }

    setEditVerifyProcessing(true);
    try {
      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      const adminEmail = authUserData?.user?.email;
      if (authUserError || !adminEmail) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: editAdminPassword,
      });
      if (signInError) {
        throw new Error('Admin password verification failed.');
      }

      setEditVerifyOpen(false);
      setEditAdminPassword('');
      openEditProfile();
    } catch (error) {
      const message = error.message || 'Invalid admin password.';
      openAlert({
        title: 'Verification failed',
        message: message === 'Unauthorized.'
          ? 'Your admin session has expired. Please log in again.'
          : message,
      });
    } finally {
      setEditVerifyProcessing(false);
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
  const residentControlNo = effectiveResident?.control_number || '-';
  const historyTableData = historyRequests.map((row) => ({
    id: row?.id || row?.control_number,
    controlNo: residentControlNo,
    requester: row?.requester_name || '-',
    beneficiary: row?.beneficiary_name || '-',
    type: getAssistanceTypeLabel(row),
    date: formatHistoryDate(row?.request_date || row?.created_at),
    amount: `₱${formatAmount(row?.amount)}`,
    status: 'Released',
  }));

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
          <div className={styles.filterControls}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort By</label>
              <select
                className={styles.select}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sector</label>
              <select
                className={styles.select}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                {sectorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>QR Validity</label>
              <select
                className={styles.select}
                value={qrFilter}
                onChange={(e) => setQrFilter(e.target.value)}
              >
                {qrOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FilterBar>

        {loading && <p style={{ padding: 16 }}>Loading beneficiaries…</p>}
        {!loading && (
          <>
            <div className={styles.tableView}>
              <Table columns={columns} data={filteredResidents} />
            </div>

            <div className={styles.mobileCardView}>
              {filteredResidents.length === 0 ? (
                <div className={styles.emptyCard}>No beneficiaries found.</div>
              ) : (
                filteredResidents.map((row) => (
                  <div key={row.id} className={styles.residentCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardNameSection}>
                        <div className={styles.cardName}>{buildFullName(row)}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>
                          {row.contact_number || '-'}
                        </div>
                        <div className={styles.cardBadges}>
                          {getSectorBadges(row).map((sector) => (
                            <Badge key={sector}>{sector}</Badge>
                          ))}
                          <Badge variant={row.status === 'Active' ? 'success' : 'secondary'}>
                            {row.status || '-'}
                          </Badge>
                        </div>
                      </div>

                      <Button variant="secondary" size="small" onClick={() => setSelectedResident(row)}>
                        View
                      </Button>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardDetails}>
                        <div className={styles.cardDetail}>
                          <span className={styles.detailLabel}>Control No.</span>
                          <span
                            className={styles.detailValue}
                            style={{ fontFamily: "'Courier New', monospace" }}
                          >
                            {row.control_number || '-'}
                          </span>
                        </div>

                        <div className={styles.cardDetail}>
                          <span className={styles.detailLabel}>Address</span>
                          <span className={styles.detailValue}>{formatAddressLine(row)}</span>
                        </div>

                        <div className={styles.cardDetail}>
                          <span className={styles.detailLabel}>Created</span>
                          <span className={styles.detailValue}>{formatDate(row.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

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
          handleCloseEditVerify();
          handleCloseHistory();
        }}
        title="Beneficiary Details"
        size="xlarge"
        footer={
          selectedResident ? (
            <div className={styles.residentDetailsFooter}>
              {isAdmin ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleOpenEditVerify}
                  disabled={processing || issuingCard || detailsLoading}
                >
                  Edit Profile
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="small"
                onClick={handleOpenHistory}
                disabled={detailsLoading || historyLoading}
              >
                History
              </Button>
              {isAdmin ? (
                <>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleOpenReset}
                    disabled={processing || issuingCard}
                  >
                    Reset Password
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleIssueCard}
                    disabled={processing || issuingCard}
                  >
                    {issuingCard ? 'Issuing…' : 'Issue ID QR'}
                  </Button>
                </>
              ) : null}
            </div>
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
                    <span
                      className={`${styles.assistanceResidentDetail} ${styles.assistanceResidentDetailBreak}`}
                    >
                      Eligibility: {getEligibilityBadge(cooldownInfo)}
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

      <Modal
        isOpen={historyOpen}
        onClose={handleCloseHistory}
        title="Assistance History"
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCloseHistory}>Close</Button>
          </div>
        }
      >
        <div className={styles.assistanceModalContent}>
          <div className={styles.assistanceResidentInfo}>
            <div className={styles.assistanceResidentHeader}>
              <div>
                <p className={styles.assistanceResidentName}>
                  {buildFullName(effectiveResident)}
                </p>
                <div className={styles.assistanceResidentMeta}>
                  <span className={styles.assistanceResidentDetail}>
                    Contact: {effectiveResident?.contact_number || '-'}
                  </span>
                  <span className={styles.assistanceResidentDetail}>
                    Control: {effectiveResident?.control_number || '-'}
                  </span>
                  <span
                    className={`${styles.assistanceResidentDetail} ${styles.assistanceResidentDetailBreak}`}
                  >
                    Eligibility: {getEligibilityBadge(cooldownInfo)}
                  </span>
                </div>
              </div>
              <Badge variant={effectiveResident?.status === 'Active' ? 'success' : 'secondary'}>
                {effectiveResident?.status || '-'}
              </Badge>
            </div>
          </div>

          <div className={styles.assistanceSummaryRow}>
            <div className={styles.assistanceSummaryStat}>
              <span className={styles.assistanceSummaryValue}>{historySummary.totalCount}</span>
              <span className={styles.assistanceSummaryLabel}>Released Requests</span>
            </div>
            <div className={styles.assistanceSummaryStat}>
              <span className={styles.assistanceSummaryValue}>₱{formatAmount(historySummary.totalAmount)}</span>
              <span className={styles.assistanceSummaryLabel}>Total Amount</span>
            </div>
            <div className={styles.assistanceSummaryStat}>
              <span className={styles.assistanceSummaryValue}>{historySummary.lastDate}</span>
              <span className={styles.assistanceSummaryLabel}>Last Released</span>
            </div>
          </div>

          {historyLoading ? (
            <div className={styles.assistanceEmpty}>
              <p>Loading released requests...</p>
            </div>
          ) : historyRequests.length === 0 ? (
            <div className={styles.assistanceEmpty}>
              <p>No released assistance requests found.</p>
            </div>
          ) : (
            <Table columns={historyColumns} data={historyTableData} />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={documentPreview.open}
        onClose={closeDocumentPreview}
        title="Document Preview"
        size="large"
        footer={
          <Button onClick={closeDocumentPreview}>
            Close
          </Button>
        }
      >
        {documentPreview.url ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  disabled={!isLikelyImage(documentPreview.url)}
                >
                  -
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setPreviewZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  disabled={!isLikelyImage(documentPreview.url)}
                >
                  +
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setPreviewZoom(1)}
                  disabled={!isLikelyImage(documentPreview.url)}
                >
                  Reset
                </Button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!isLikelyImage(documentPreview.url) ? (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Zoom buttons are for images only</span>
                ) : null}
                <span style={{ fontSize: 12, color: '#6b7280' }}>{Math.round(previewZoom * 100)}%</span>
              </div>
            </div>
            {isLikelyImage(documentPreview.url) ? (
              <div style={{ maxHeight: '70vh', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <img
                  src={documentPreview.url}
                  alt="Uploaded document preview"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    margin: '0 auto',
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'top center',
                  }}
                />
              </div>
            ) : (
              <iframe
                src={documentPreview.url}
                title="Uploaded document preview"
                style={{ width: '100%', height: '70vh', border: 0 }}
              />
            )}
          </div>
        ) : (
          <p style={{ margin: 0 }}>No document available for preview.</p>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedResident && editVerifyOpen}
        onClose={handleCloseEditVerify}
        title="Verify Admin Password"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditVerify}>
              Cancel
            </Button>
            <Button onClick={handleContinueEditVerify} disabled={editVerifyProcessing}>
              {editVerifyProcessing ? 'Verifying...' : 'Continue'}
            </Button>
          </>
        }
      >
        <Input
          label="Your Password"
          name="verifyEditAdminPassword"
          type="password"
          value={editAdminPassword}
          onChange={(e) => setEditAdminPassword(e.target.value)}
          placeholder="Enter your password to continue"
          required
        />
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
            type="tel"
            name="contact_number"
            value={editForm.contact_number}
            onChange={handleEditChange}
            placeholder="+63 XXX XXX XXXX"
            mask="ph-contact"
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
            <Select
              label="Purok"
              name="purok"
              value={editForm.purok}
              onChange={handleEditChange}
              options={purokOptions}
              placeholder="Select purok"
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
