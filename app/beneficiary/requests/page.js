'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Input from '../../../components/Input';
import Select from '../../../components/Select';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import FileUpload from '../../../components/FileUpload';
import styles from './page.module.css';
import { createOrUpdateResident } from '@/lib/residents';
import { assistanceTypeOptions, assistanceData } from '@/lib/assistanceData';
import {
  buildRequirementsMap,
  getLocalBudgetsMap,
  getLocalRequirementsMap,
  getRequirementsForType,
  isMissingRequirementsColumn,
} from '@/lib/assistanceRequirements';
import { supabase } from '@/lib/supabaseClient';
import { getCooldownInfo } from '@/lib/requestCooldown';


const CONTROL_NUMBER_PAD = 3;

const formatYearSequenceControlNumber = (year, seq) => {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeSeq = Number(seq) || 1;
  return `${safeYear}-${String(Math.max(1, safeSeq)).padStart(CONTROL_NUMBER_PAD, '0')}`;
};

const getNextSequentialControlNumber = async (tableName) => {
  const year = new Date().getFullYear();
  const fallback = formatYearSequenceControlNumber(year, 1);

  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('control_number')
      .like('control_number', `${year}-%`)
      .order('control_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const last = String(data?.control_number || '').trim();
    const match = last.match(new RegExp(`^${year}-(\\d{${CONTROL_NUMBER_PAD}})$`));
    const nextSeq = match ? Number(match[1]) + 1 : 1;

    if (!Number.isFinite(nextSeq) || nextSeq < 1) return fallback;

    return formatYearSequenceControlNumber(year, nextSeq);
  } catch (err) {
    console.warn('[controlNumber] Failed to compute next control number:', err);
    return fallback;
  }
};

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

const normalizeRequirementFiles = (requirementsFilesValue, requirementsUrlsValue, fallbackValidIdValue) => {
  const rows = [];

  const parseRows = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return [];
  };

  const rawRows = parseRows(requirementsFilesValue);
  rawRows.forEach((row) => {
    if (!row) return;
    if (typeof row === 'string') {
      const fileUrl = row.trim();
      if (!fileUrl) return;
      rows.push({
        file_url: fileUrl,
        file_name: fileUrl.split('/').pop() || 'Document',
        requirement_type: null,
      });
      return;
    }
    const fileUrl = String(row.file_url || row.fileUrl || '').trim();
    if (!fileUrl) return;
    rows.push({
      file_url: fileUrl,
      file_name: String(row.file_name || row.fileName || '').trim() || fileUrl.split('/').pop() || 'Document',
      requirement_type: row.requirement_type || row.requirementType || null,
    });
  });

  const urlList = [
    ...parseLegacyRequirementUrls(requirementsUrlsValue),
    ...parseLegacyRequirementUrls(fallbackValidIdValue),
  ];
  urlList.forEach((fileUrl) => {
    rows.push({
      file_url: fileUrl,
      file_name: fileUrl.split('/').pop() || 'Document',
      requirement_type: null,
    });
  });

  const map = new Map();
  rows.forEach((row) => {
    if (!row?.file_url) return;
    map.set(row.file_url, row);
  });
  return Array.from(map.values());
};

export default function BeneficiaryRequestPage() {
  const router = useRouter();
  const [controlNumber, setControlNumber] = useState('');
  const [budgets, setBudgets] = useState({});
  const [requirementsByType, setRequirementsByType] = useState(null);
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    houseNo: '',
    purok: '',
    street: '',
    barangay: 'sta-rita',
    city: 'Olongapo',
    birthday: '',
    birthplace: '',
    sex: '',
    citizenship: 'Filipino',
    civilStatus: '',
    contactNumber: '',
    sectors: {
      pwd: false,
      seniorCitizen: false,
      soloParent: false,
    },
    representativeName: '',
    representativeContact: '',
    assistanceType: '',
    otherAssistanceType: '',
    assistanceAmount: '',
    beneficiaryName: '',
    beneficiaryContact: '',
    beneficiaryAddress: '',
    requirementsChecklist: {},
    dateOfRequest: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [requirementUploadFiles, setRequirementUploadFiles] = useState({});
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [editingAssistanceControlNumber, setEditingAssistanceControlNumber] = useState(null);
  const [existingRequirementFilesByIndex, setExistingRequirementFilesByIndex] = useState({});
  const [removedRequirementIndex, setRemovedRequirementIndex] = useState({});
  const [beneficiaryIsRequester, setBeneficiaryIsRequester] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '' });
  const [cooldownInfo, setCooldownInfo] = useState(() => getCooldownInfo(null));
  const [cooldownLoading, setCooldownLoading] = useState(true);

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => {
      setToast({ open: false, message: '' });
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast.open]);

  const refreshResidentControlNumber = async () => {
    try {
      if (typeof window !== 'undefined') {
        const residentId = window.localStorage.getItem('beneficiaryResidentId');
        if (residentId && supabase) {
          const { data } = await supabase
            .from('residents')
            .select('control_number')
            .eq('id', residentId)
            .maybeSingle();

          const existing = String(data?.control_number || '').trim();
          if (existing) {
            setControlNumber(existing);
            return;
          }
        }
      }
    } catch {
      // fall through
    }

    const next = await getNextSequentialControlNumber('residents');
    setControlNumber(next);
  };

  useEffect(() => {
    void refreshResidentControlNumber();
  }, []);

  useEffect(() => {
    const loadCooldownInfo = async () => {
      if (isEditMode) {
        setCooldownInfo(getCooldownInfo(null));
        setCooldownLoading(false);
        return;
      }

      setCooldownLoading(true);
      try {
        let residentId = null;
        if (typeof window !== 'undefined') {
          residentId = window.localStorage.getItem('beneficiaryResidentId');
        }

        if (!residentId) {
          setCooldownInfo(getCooldownInfo(null));
          return;
        }

        const response = await fetch(`/api/assistance-requests?residentId=${encodeURIComponent(residentId)}`);
        const result = await response.json();

        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Failed to load request eligibility.');
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const released = rows.find((row) => String(row?.status || '').toLowerCase() === 'released');
        const lastDate = released?.request_date || released?.created_at || null;
        setCooldownInfo(getCooldownInfo(lastDate));
      } catch (err) {
        console.warn('Failed to load request eligibility:', err);
        setCooldownInfo(getCooldownInfo(null));
      } finally {
        setCooldownLoading(false);
      }
    };

    loadCooldownInfo();
  }, [isEditMode]);

  // Auto-fill from beneficiary sign up/profile (still editable)
  useEffect(() => {
    const loadProfileDefaults = async () => {
      try {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('edit')) return; // edit-mode loads from the request itself

        const residentId = window.localStorage.getItem('beneficiaryResidentId');
        if (!residentId || !supabase) return;

        const { data, error } = await supabase
          .from('residents')
          .select(
            'id, control_number, first_name, middle_name, last_name, birthday, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, representative_name, representative_contact, is_pwd, is_senior_citizen, is_solo_parent',
          )
          .eq('id', residentId)
          .single();

        if (error) throw error;

        const normalizeBarangay = (value) => {
          const raw = String(value || '').toLowerCase();
          if (raw.includes('sta') && raw.includes('rita')) return 'sta-rita';
          if (raw === 'sta-rita') return 'sta-rita';
          return 'sta-rita';
        };

        if (data?.control_number) {
          setControlNumber(String(data.control_number));
        }

        setFormData((prev) => {
          const next = { ...prev };
          const setIfEmpty = (key, value) => {
            const cur = String(prev?.[key] ?? '').trim();
            const val = String(value ?? '').trim();
            if (!cur && val) next[key] = value;
          };

          setIfEmpty('firstName', data?.first_name || '');
          setIfEmpty('middleName', data?.middle_name || '');
          setIfEmpty('lastName', data?.last_name || '');
          setIfEmpty('houseNo', data?.house_no || '');
          setIfEmpty('purok', data?.purok || '');
          setIfEmpty('street', data?.street || '');
          if (!String(prev?.barangay || '').trim() && data?.barangay) next.barangay = normalizeBarangay(data.barangay);
          setIfEmpty('city', data?.city || '');
          if (!prev?.birthday && data?.birthday) next.birthday = data.birthday;
          setIfEmpty('birthplace', data?.birthplace || '');
          setIfEmpty('sex', data?.sex || '');
          setIfEmpty('citizenship', data?.citizenship || 'Filipino');
          setIfEmpty('civilStatus', data?.civil_status || '');
          setIfEmpty('contactNumber', data?.contact_number || '');
          setIfEmpty('representativeName', data?.representative_name || '');
          setIfEmpty('representativeContact', data?.representative_contact || '');

          const hasSector = prev?.sectors?.pwd || prev?.sectors?.seniorCitizen || prev?.sectors?.soloParent;
          if (!hasSector) {
            next.sectors = {
              pwd: !!data?.is_pwd,
              seniorCitizen: !!data?.is_senior_citizen,
              soloParent: !!data?.is_solo_parent,
            };
          }

          return next;
        });
      } catch (err) {
        console.warn('Unable to auto-fill beneficiary profile defaults:', err);
      }
    };

    void loadProfileDefaults();
  }, []);

  useEffect(() => {
    if (requirementsByType === null) return;

    const loadEditRequest = async () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      if (!editId) return;

      setIsEditMode(true);
      setIsLoadingEdit(true);

      try {
        const residentId = window.localStorage.getItem('beneficiaryResidentId');
        if (!residentId) {
          throw new Error('Missing beneficiary identity. Please log in again.');
        }

        const response = await fetch(`/api/assistance-requests?residentId=${encodeURIComponent(residentId)}`);
        const result = await response.json().catch(() => ({}));

        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Failed to load the request for editing.');
        }

        const list = result?.data || [];
        const match = list.find(
          (r) => String(r.id) === String(editId) || String(r.control_number) === String(editId),
        );

        if (!match) {
          throw new Error('Request not found.');
        }

        if (match.status !== 'Rejected') {
          throw new Error('Only incomplete requests can be edited.');
        }

        setEditingRequestId(match.id);
        setEditingAssistanceControlNumber(match.control_number);

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
                    if (item && typeof item === 'object') return String(item.file_url || item.fileUrl || '').trim();
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
        const parseChecklistRows = (value) => {
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

        const normalizeBarangay = (value) => {
          const raw = String(value || '').toLowerCase();
          if (raw.includes('sta') && raw.includes('rita')) return 'sta-rita';
          if (raw === 'sta-rita') return 'sta-rita';
          return 'sta-rita';
        };

        const normalizeAssistanceType = (value) => {
          const v = String(value || '').trim();
          if (!v) return { assistanceType: '', otherAssistanceType: '' };
          const known = assistanceTypeOptions.some((o) => o.value === v);
          if (known) return { assistanceType: v, otherAssistanceType: '' };
          return { assistanceType: 'Others', otherAssistanceType: v };
        };

        const reqs = parseRequirements(match.requirements_urls);
        const normalizedAssistanceType = normalizeAssistanceType(match.assistance_type);
        const requirementLabels = normalizedAssistanceType.assistanceType
          ? getRequirementsForType(normalizedAssistanceType.assistanceType, requirementsByType || {})
          : [];
        const mergedRequirementFiles = normalizeRequirementFiles(
          match.requirements_files,
          reqs,
          match.valid_id_url,
        );

        const byIndex = {};
        const unassigned = [...mergedRequirementFiles];
        requirementLabels.forEach((label, idx) => {
          const typed = mergedRequirementFiles.find((file) => String(file.requirement_type || '') === String(label));
          if (typed) {
            byIndex[idx] = [typed];
            const pos = unassigned.findIndex((x) => x.file_url === typed.file_url);
            if (pos >= 0) unassigned.splice(pos, 1);
          }
        });
        requirementLabels.forEach((_, idx) => {
          if (!byIndex[idx] && unassigned.length) {
            byIndex[idx] = [unassigned.shift()];
          }
        });
        setExistingRequirementFilesByIndex(byIndex);
        setRemovedRequirementIndex({});
        setRequirementUploadFiles({});

        const savedChecklist = parseChecklistRows(match.requirements_checklist);
        const savedChecklistState = savedChecklist.reduce((acc, item, idx) => {
          const checked = item?.checked;
          acc[idx] = checked === true || checked === 'true' || checked === 1 || checked === '1';
          return acc;
        }, {});

        const norm = (v) => String(v || '').trim().toLowerCase();
        const beneficiarySameAsRequester =
          !match.beneficiary_name && !match.beneficiary_contact && !match.beneficiary_address
            ? true
            : norm(match.beneficiary_name) === norm(match.requester_name) &&
              norm(match.beneficiary_contact) === norm(match.requester_contact) &&
              norm(match.beneficiary_address) === norm(match.requester_address);
        setBeneficiaryIsRequester(beneficiarySameAsRequester);

        const resident = match.residents || {};
        if (resident.control_number) {
          setControlNumber(String(resident.control_number));
        }

        const assistance = normalizedAssistanceType;

        setFormData((prev) => ({
          ...prev,
          lastName: resident.last_name || '',
          firstName: resident.first_name || '',
          middleName: resident.middle_name || '',
          houseNo: resident.house_no || '',
          purok: resident.purok || '',
          street: resident.street || '',
          barangay: normalizeBarangay(resident.barangay),
          city: resident.city || 'Olongapo',
          birthday: resident.birthday || '',
          birthplace: resident.birthplace || '',
          sex: resident.sex || '',
          citizenship: resident.citizenship || 'Filipino',
          civilStatus: resident.civil_status || '',
          contactNumber: resident.contact_number || '',
          sectors: {
            pwd: !!resident.is_pwd,
            seniorCitizen: !!resident.is_senior_citizen,
            soloParent: !!resident.is_solo_parent,
          },
          representativeName: resident.representative_name || '',
          representativeContact: resident.representative_contact || '',
          assistanceType: assistance.assistanceType,
          otherAssistanceType: assistance.otherAssistanceType,
          assistanceAmount: match.amount != null ? String(match.amount) : '',
          beneficiaryName: beneficiarySameAsRequester ? '' : match.beneficiary_name || '',
          beneficiaryContact: beneficiarySameAsRequester ? '' : match.beneficiary_contact || '',
          beneficiaryAddress: beneficiarySameAsRequester ? '' : match.beneficiary_address || '',
          requirementsChecklist: savedChecklistState,
          dateOfRequest: match.request_date || new Date().toISOString().split('T')[0],
        }));

        setRequirementUploadFiles({});
        setErrors({});
        setStatus({
          type: 'success',
          message:
            'Editing an incomplete request. Update the missing details, then click Resubmit Request.',
        });
      } catch (err) {
        console.error('Failed to load request for edit:', err);
        setIsEditMode(false);
        setEditingRequestId(null);
        setEditingAssistanceControlNumber(null);
        setExistingRequirementFilesByIndex({});
        setRemovedRequirementIndex({});
        setRequirementUploadFiles({});
        setStatus({
          type: 'error',
          message: err?.message || 'Failed to load request for editing.',
        });
      } finally {
        setIsLoadingEdit(false);
      }
    };

    void loadEditRequest();
  }, [requirementsByType]);

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client not initialized');
          setBudgets(getLocalBudgetsMap());
          setRequirementsByType(getLocalRequirementsMap());
          return;
        }

        let usedFallback = false;
        let { data, error } = await supabase
          .from('assistance_budgets')
          .select('assistance_type, ceiling, requirements');

        if (error && isMissingRequirementsColumn(error)) {
          const fallback = await supabase
            .from('assistance_budgets')
            .select('assistance_type, ceiling');
          data = fallback.data;
          error = fallback.error;
          usedFallback = true;
        }

        if (error) {
          console.error('Error loading assistance budgets', error.message);
          setBudgets(getLocalBudgetsMap());
          setRequirementsByType(getLocalRequirementsMap());
          return;
        }

        if (data) {
          const map = {};
          data.forEach((row) => {
            const ceiling = Number(row.ceiling);
            if (row.assistance_type && Number.isFinite(ceiling)) {
              map[row.assistance_type] = ceiling;
            }
          });
          setBudgets(map);
          setRequirementsByType(
            usedFallback ? getLocalRequirementsMap() : buildRequirementsMap(data),
          );
        }
      } catch (err) {
        console.error('Unexpected error loading assistance budgets', err);
        setBudgets(getLocalBudgetsMap());
        setRequirementsByType(getLocalRequirementsMap());
      }
    };

    loadBudgets();
  }, []);

  const getCeilingFor = (type) => {
    if (!type) return null;
    const override = budgets[type];
    if (typeof override === 'number') return override;
    const base = assistanceData[type]?.ceiling;
    return typeof base === 'number' ? base : null;
  };

  const getRequirementsFor = (type) => getRequirementsForType(type, requirementsByType || {});

  const getCooldownVariant = (statusLabel) => {
    if (statusLabel === 'Eligible') return 'success';
    if (statusLabel === 'Almost Eligible') return 'warning';
    return 'danger';
  };

  const getCooldownMessage = (info) => {
    if (!info) return 'Checking request eligibility...';
    if (info.isEligible) return 'You can submit a new request now.';
    if (info.nextEligibleDate) {
      return `Please wait ${info.daysRemaining} day(s). Next eligible on ${info.nextEligibleDate}.`;
    }
    return `Please wait ${info.daysRemaining} day(s) before submitting another request.`;
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'assistanceType') {
      const ceiling = getCeilingFor(value);
      setErrors((prev) => ({
        ...prev,
        assistanceAmount: '',
      }));
      setRequirementUploadFiles({});
      setRemovedRequirementIndex({});
      if (!isEditMode) {
        setExistingRequirementFilesByIndex({});
      }
      setFormData((prev) => ({
        ...prev,
        assistanceType: value,
        assistanceAmount: ceiling != null ? String(ceiling) : '',
        requirementsChecklist: {},
      }));
      return;
    }

    if (name === 'contactNumber' || name === 'representativeContact' || name === 'beneficiaryContact') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData((prev) => ({
          ...prev,
          [name]: numericValue,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAmountChange = (e) => {
    const { value } = e.target;
    const numericValue = Number(value);

    let message = '';
    if (formData.assistanceType) {
      const ceiling = getCeilingFor(formData.assistanceType);
      if (ceiling != null && Number.isFinite(numericValue) && numericValue > ceiling) {
        message = `Amount exceeds the ₱${ceiling.toLocaleString()} ceiling for this assistance type.`;
      }
    }

    setErrors((prev) => ({
      ...prev,
      assistanceAmount: message,
    }));

    setFormData((prev) => ({
      ...prev,
      assistanceAmount: value,
    }));
  };

  const handleSectorChange = (sector) => {
    if (errors.sectors) {
      setErrors((prev) => ({ ...prev, sectors: '' }));
    }

    setFormData((prev) => {
      const cleared = { pwd: false, seniorCitizen: false, soloParent: false };
      const isSelected = !!prev?.sectors?.[sector];
      return {
        ...prev,
        sectors: isSelected ? cleared : { ...cleared, [sector]: true },
      };
    });
  };

  const toggleRequirement = (index) => {
    if (errors.requirementsChecklist) {
      setErrors((prev) => ({ ...prev, requirementsChecklist: '' }));
    }

    setFormData((prev) => ({
      ...prev,
      requirementsChecklist: {
        ...(prev.requirementsChecklist || {}),
        [index]: !prev?.requirementsChecklist?.[index],
      },
    }));
  };

  const handleRequirementUploadChange = (index, files) => {
    const file = Array.isArray(files) ? files[0] || null : null;
    // Save uploaded file
    setRequirementUploadFiles((prev) => ({ ...prev, [index]: file }));

    // If a file was uploaded, mark existing as not-removed so it will be used on submit
    if (file) {
      setRemovedRequirementIndex((prev) => ({ ...prev, [index]: false }));
    }

    if (errors.validId) {
      setErrors((prev) => ({ ...prev, validId: '' }));
    }
  };

  const getExistingFilesForRequirement = (index) => {
    if (removedRequirementIndex?.[index]) return [];
    return Array.isArray(existingRequirementFilesByIndex?.[index])
      ? existingRequirementFilesByIndex[index].filter(Boolean)
      : [];
  };

  const validateForm = () => {
    const newErrors = {};

    // Beneficiary request services: simplified Personal Information UI.
    // Require only name + address fields, and ensure contact number exists (managed in Profile).
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';

    // Address is read-only here; validate it based on what exists in profile.
    if (!formData.houseNo.trim()) newErrors.houseNo = 'House number is required';
    if (!String(formData.barangay || '').trim()) newErrors.barangay = 'Barangay is required';
    if (!String(formData.city || '').trim()) newErrors.city = 'City is required';
    if (!String(formData.street || '').trim() && !String(formData.purok || '').trim()) {
      newErrors.street = 'Street or Purok is required';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is missing. Please update your profile.';
    } else if (formData.contactNumber.length !== 11) {
      newErrors.contactNumber = 'Contact number must be exactly 11 digits. Please update your profile.';
    }

    if (formData.assistanceType && !beneficiaryIsRequester) {
      if (!formData.beneficiaryName.trim()) {
        newErrors.beneficiaryName = 'Beneficiary name is required';
      }
      if (!formData.beneficiaryContact.trim()) {
        newErrors.beneficiaryContact = 'Beneficiary contact number is required';
      } else if (formData.beneficiaryContact.replace(/\D/g, '').length !== 11) {
        newErrors.beneficiaryContact = 'Beneficiary contact number must be exactly 11 digits';
      }
      if (!formData.beneficiaryAddress.trim()) {
        newErrors.beneficiaryAddress = 'Beneficiary address is required';
      }
    }

    const assistanceReqs = formData.assistanceType
      ? getRequirementsFor(formData.assistanceType)
      : [];

    // Instead of requiring the user to check boxes, infer checklist from uploaded/new/existing files.
    if (assistanceReqs.length) {
      const missingDocs = assistanceReqs.some((_req, idx) => {
        const hasNew = !!requirementUploadFiles?.[idx];
        const hasExisting = getExistingFilesForRequirement(idx).length > 0;
        return !hasNew && !hasExisting;
      });
      if (missingDocs) {
        newErrors.validId = 'Please upload one file for each requirement item.';
      }
    }

    if (formData.assistanceType && !formData.assistanceAmount) {
      newErrors.assistanceAmount = 'Budget ceiling is not configured for this assistance type. Please contact the barangay office.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!isEditMode && (cooldownLoading || (cooldownInfo && !cooldownInfo.isEligible))) {
      setStatus({
        type: 'error',
        message: cooldownLoading ? 'Checking request eligibility. Please wait.' : getCooldownMessage(cooldownInfo),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const age = calculateAge(formData.birthday);

      // IMPORTANT: in edit/resubmit mode, keep the original resident identity.
      // Updating by contact_number can accidentally create a new resident row, causing Forbidden on resubmit.
      let residentIdForRequest = null;
      let residentData = null;

      if (isEditMode) {
        if (typeof window !== 'undefined') {
          residentIdForRequest = window.localStorage.getItem('beneficiaryResidentId');
        }
        if (!residentIdForRequest) {
          throw new Error('Missing beneficiary identity. Please log in again.');
        }

        const residentPayload = {
          id: residentIdForRequest,
          last_name: formData.lastName,
          first_name: formData.firstName,
          middle_name: formData.middleName || null,
          house_no: formData.houseNo,
          street: formData.street,
          barangay: formData.barangay,
          city: formData.city,
          birthday: formData.birthday,
          birthplace: formData.birthplace,
          age: age ? parseInt(age) : null,
          sex: formData.sex,
          citizenship: formData.citizenship,
          civil_status: formData.civilStatus,
          contact_number: formData.contactNumber,
          is_pwd: formData.sectors.pwd,
          is_senior_citizen: formData.sectors.seniorCitizen,
          is_solo_parent: formData.sectors.soloParent,
          representative_name: formData.representativeName,
          representative_contact: formData.representativeContact,
          status: 'Active',
        };

        residentData = await createOrUpdateResident(residentPayload);
        residentIdForRequest = residentData?.id || residentIdForRequest;
      } else {
        let storedResidentId = null;
        if (typeof window !== 'undefined') {
          storedResidentId = window.localStorage.getItem('beneficiaryResidentId');
        }

        const baseResidentPayload = {
          last_name: formData.lastName,
          first_name: formData.firstName,
          middle_name: formData.middleName || null,
          house_no: formData.houseNo,
          purok: formData.purok || null,
          street: formData.street || null,
          barangay: formData.barangay,
          city: formData.city,
          contact_number: formData.contactNumber || null,
          is_pwd: formData.sectors.pwd,
          is_senior_citizen: formData.sectors.seniorCitizen,
          is_solo_parent: formData.sectors.soloParent,
          representative_name: formData.representativeName || null,
          representative_contact: formData.representativeContact || null,
          status: 'Active',
        };

        if (storedResidentId) {
          // Beneficiary already has an account/profile: update that resident by ID.
          residentData = await createOrUpdateResident({ id: storedResidentId, ...baseResidentPayload });
          residentIdForRequest = residentData?.id || storedResidentId;
        } else {
          const residentControlNumber = controlNumber || (await getNextSequentialControlNumber('residents'));
          if (!controlNumber) {
            setControlNumber(residentControlNumber);
          }

          const residentPayload = {
            control_number: residentControlNumber,
            ...baseResidentPayload,
            birthday: formData.birthday || null,
            birthplace: formData.birthplace || null,
            age: age ? parseInt(age) : null,
            sex: formData.sex || null,
            citizenship: formData.citizenship || null,
            civil_status: formData.civilStatus || null,
          };

          residentData = await createOrUpdateResident(residentPayload);
          residentIdForRequest = residentData?.id || null;
        }
      }

      if (formData.assistanceType && residentIdForRequest) {
        if (!supabase) {
          throw new Error('Database client not available');
        }

        if (isEditMode && !editingAssistanceControlNumber) {
          throw new Error('Missing request reference number. Please go back and try again.');
        }

        const assistanceControlNumber = isEditMode
          ? editingAssistanceControlNumber
          : await getNextSequentialControlNumber('assistance_requests');

        const buildAddress = () => {
          const barangayLabel = formData.barangay === 'sta-rita' ? 'Sta. Rita' : formData.barangay;
          return [formData.houseNo, formData.purok, formData.street, barangayLabel, formData.city]
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .join(', ');
        };

        const assistanceReqs = formData.assistanceType
          ? getRequirementsFor(formData.assistanceType)
          : [];
        const requirementFileDetails = [];

        for (let idx = 0; idx < assistanceReqs.length; idx++) {
          const requirementLabel = assistanceReqs[idx];
          const replacementFile = requirementUploadFiles?.[idx];
          if (replacementFile) {
            const form = new FormData();
            form.append('file', replacementFile);
            form.append('controlNumber', assistanceControlNumber);

            const uploadRes = await fetch('/api/beneficiary/upload-valid-id', {
              method: 'POST',
              body: form,
              headers: {
                ...(isEditMode ? { 'x-resident-id': String(residentIdForRequest) } : {}),
              },
            });

            const uploadJson = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok || uploadJson?.error) {
              throw new Error(
                uploadJson?.error ||
                  'ATTACH REQUIREMENTS upload failed. Ensure your Supabase Storage bucket is named "document" and SUPABASE_SERVICE_ROLE_KEY is configured.',
              );
            }

            const path = uploadJson?.data?.path || null;
            if (!path) {
              throw new Error('ATTACH REQUIREMENTS upload failed. Please try again.');
            }
            requirementFileDetails.push({
              file_url: path,
              file_name: replacementFile.name || String(path).split('/').pop() || `Document ${idx + 1}`,
              requirement_type: requirementLabel,
            });
            continue;
          }

          const existingForIndex = getExistingFilesForRequirement(idx);
          if (existingForIndex.length) {
            const kept = existingForIndex[0];
            requirementFileDetails.push({
              file_url: kept.file_url,
              file_name: kept.file_name || String(kept.file_url).split('/').pop() || `Document ${idx + 1}`,
              requirement_type: requirementLabel,
            });
          }
        }
        const requirementPaths = requirementFileDetails.map((x) => x.file_url).filter(Boolean);

        const cleanId = (v) => {
          const s = String(v ?? '').trim();
          if (!s || s === 'undefined' || s === 'null') return null;
          return s;
        };

        const patchId = isEditMode
          ? cleanId(editingRequestId) || cleanId(editingAssistanceControlNumber)
          : null;

        if (isEditMode && !patchId) {
          throw new Error('Missing request reference. Please go back to History and click Edit again.');
        }

        const requesterName = `${formData.firstName} ${formData.lastName}`.trim();
        const requesterContact = formData.contactNumber;
        const requesterAddress = buildAddress();

        // Build requirements checklist from actual uploaded/existing files (locked for user).
        const presentLabels = new Set(requirementFileDetails.map((r) => String(r.requirement_type || '').trim()));
        const requirementsChecklist = assistanceReqs.map((label) => ({
          label,
          checked: presentLabels.has(String(label)),
        }));
        const requirementsCompleted = requirementsChecklist.length
          ? requirementsChecklist.every((row) => !!row?.checked)
          : false;

        const requestPayload = {
          control_number: assistanceControlNumber,
          resident_id: residentIdForRequest,
          requester_name: requesterName,
          requester_contact: requesterContact,
          requester_address: requesterAddress,
          beneficiary_name: beneficiaryIsRequester ? requesterName : formData.beneficiaryName,
          beneficiary_contact: beneficiaryIsRequester ? requesterContact : formData.beneficiaryContact,
          beneficiary_address: beneficiaryIsRequester ? requesterAddress : formData.beneficiaryAddress,
          assistance_type:
            formData.assistanceType === 'Others'
              ? formData.otherAssistanceType
              : formData.assistanceType,
          amount: formData.assistanceAmount || 0,
          request_date: formData.dateOfRequest,
          request_source: 'online',
          requirements_urls: requirementPaths,
          requirements_files: requirementFileDetails,
          // Keep legacy column populated for older UIs/queries
          valid_id_url:
            requirementPaths.length > 1 ? JSON.stringify(requirementPaths) : requirementPaths?.[0] || null,
          // Checklist for admin verification
          requirements_checklist: requirementsChecklist,
          requirements_completed: requirementsCompleted,
        };

        const response = await fetch(
          isEditMode
            ? `/api/beneficiary/assistance-requests/${encodeURIComponent(patchId)}`
            : '/api/assistance-requests',
          {
            method: isEditMode ? 'PATCH' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(isEditMode ? { 'x-resident-id': String(residentIdForRequest) } : {}),
            },
            body: JSON.stringify(requestPayload),
          },
        );

        const result = await response.json();
        if (!response.ok || result?.error) {
          if (result?.code === 'REQUEST_COOLDOWN' && result?.cooldown) {
            setCooldownInfo(result.cooldown);
          }
          throw new Error(result?.error || 'Failed to submit assistance request.');
        }

        if (isEditMode) {
          setToast({
            open: true,
            message: 'Request resubmitted successfully.',
          });
          setStatus({
            type: 'success',
            message: 'Request updated and resubmitted successfully!',
          });
          setTimeout(() => {
            router.push('/beneficiary/history');
          }, 1200);
          return;
        }

      }

      // Persist basic beneficiary identity locally for dashboard/profile views
      if (typeof window !== 'undefined' && residentData && !isEditMode) {
        try {
          window.localStorage.setItem('beneficiaryResidentId', String(residentData.id));
          window.localStorage.setItem('beneficiaryContactNumber', formData.contactNumber);
          window.localStorage.setItem('beneficiaryName', `${formData.firstName} ${formData.lastName}`);
        } catch (storageError) {
          console.warn('Unable to persist beneficiary identity in localStorage:', storageError);
        }
      }

      setFormData((prev) => ({
        ...prev,
        lastName: '',
        firstName: '',
        middleName: '',
        houseNo: '',
        purok: '',
        street: '',
        barangay: 'sta-rita',
        city: 'Olongapo',
        birthday: '',
        birthplace: '',
        sex: '',
        citizenship: 'Filipino',
        civilStatus: '',
        contactNumber: '',
        sectors: {
          pwd: false,
          seniorCitizen: false,
          soloParent: false,
        },
        representativeName: '',
        representativeContact: '',
        assistanceType: '',
        otherAssistanceType: '',
        assistanceAmount: '',
        beneficiaryName: '',
        beneficiaryContact: '',
        beneficiaryAddress: '',
        requirementsChecklist: {},
        dateOfRequest: new Date().toISOString().split('T')[0],
      }));
      void refreshResidentControlNumber();
      setStatus({
        type: 'success',
        message: isEditMode
          ? 'Request updated and resubmitted successfully!'
          : 'Request submitted successfully! Your reference number has been generated.',
      });
      if (!isEditMode) {
        setToast({
          open: true,
          message: 'Request submitted successfully.',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus({
        type: 'error',
        message:
          error?.message || 'Failed to submit request. Please review the form and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isEditMode) {
      router.push('/beneficiary/history');
      return;
    }

    setFormData({
      lastName: '',
      firstName: '',
      middleName: '',
      houseNo: '',
      purok: '',
      street: '',
      barangay: 'sta-rita',
      city: 'Olongapo',
      birthday: '',
      birthplace: '',
      sex: '',
      citizenship: 'Filipino',
      civilStatus: '',
      contactNumber: '',
      sectors: {
        pwd: false,
        seniorCitizen: false,
        soloParent: false,
      },
      representativeName: '',
      representativeContact: '',
      assistanceType: '',
      otherAssistanceType: '',
      assistanceAmount: '',
      beneficiaryName: '',
      beneficiaryContact: '',
      beneficiaryAddress: '',
      requirementsChecklist: {},
      dateOfRequest: new Date().toISOString().split('T')[0],
    });
    void refreshResidentControlNumber();
    setRequirementUploadFiles({});
    setExistingRequirementFilesByIndex({});
    setRemovedRequirementIndex({});
  };

  const selectedAssistanceRequirements = formData.assistanceType
    ? getRequirementsFor(formData.assistanceType)
    : [];
  const selectedAssistanceCeiling = formData.assistanceType ? getCeilingFor(formData.assistanceType) : null;
  const cooldownVariant = cooldownLoading ? 'secondary' : getCooldownVariant(cooldownInfo?.status);
  const isCooldownBlocked = !isEditMode && !cooldownLoading && cooldownInfo && !cooldownInfo.isEligible;
  const isSubmitDisabled =
    isSubmitting || isLoadingEdit || (!isEditMode && (cooldownLoading || isCooldownBlocked));

  return (
    <div className={styles.registrationPage}>
      {toast.open && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
      <PageHeader title={isEditMode ? 'Edit Incomplete Request' : 'Request Assistance'} />
      {status && (
        <div
          role="alert"
          className={`${styles.statusBanner} ${
            status.type === 'success' ? styles.statusBannerSuccess : styles.statusBannerError
          }`}
        >
          {status.message}
        </div>
      )}
      {!isEditMode && (
        <div className={styles.cooldownBanner} role="status" aria-live="polite">
          <div className={styles.cooldownContent}>
            <div className={styles.cooldownTitle}>Request Eligibility</div>
            <div className={styles.cooldownMessage}>
              {cooldownLoading ? 'Checking request eligibility...' : getCooldownMessage(cooldownInfo)}
            </div>
          </div>
          <Badge variant={cooldownVariant}>
            {cooldownLoading ? 'Checking' : cooldownInfo?.status || 'Eligible'}
          </Badge>
        </div>
      )}
      <form onSubmit={handleSubmit} className={styles.formGrid}>
        <div className={styles.controlNumberBar}>
          <div className={styles.controlNumberLabel}>Control Number</div>
          <div className={styles.controlNumberValue}>
            {controlNumber || editingAssistanceControlNumber || '—'}
          </div>
        </div>

        <Card title="Personal Information" className={styles.mainCard}>
          <div className={styles.formFields}>
            <div className={styles.row}>
              <Input
                label="Full Name"
                name="fullName"
                value={[formData.firstName, formData.middleName, formData.lastName]
                  .map((s) => String(s || '').trim())
                  .filter(Boolean)
                  .join(' ')}
                onChange={() => {}}
                disabled
                placeholder="Set this in My Profile"
              />
              <Input
                label="Address"
                name="address"
                value={(() => {
                  const barangayLabel = formData.barangay === 'sta-rita' ? 'Sta. Rita' : formData.barangay;
                  return [formData.houseNo, formData.purok, formData.street, barangayLabel, formData.city]
                    .map((s) => String(s || '').trim())
                    .filter(Boolean)
                    .join(', ');
                })()}
                onChange={() => {}}
                disabled
                placeholder="Set this in My Profile"
              />
            </div>

            {(errors.firstName ||
              errors.lastName ||
              errors.houseNo ||
              errors.street ||
              errors.barangay ||
              errors.city ||
              errors.contactNumber) && (
              <p className={styles.errorText} style={{ marginTop: -6 }}>
                {errors.contactNumber ||
                  errors.firstName ||
                  errors.lastName ||
                  errors.houseNo ||
                  errors.street ||
                  errors.barangay ||
                  errors.city}
              </p>
            )}
          </div>
        </Card>

        <div className={styles.sideCards}>
          <Card
            title="ATTACH REQUIREMENTS"
            subtitle="Upload a clear photo or scan of your requirements for verification"
          >
            <div className={styles.formFields}>
              {formData.assistanceType ? (
                <div className={styles.assistanceRequirementsPanel}>
                  <div className={styles.assistanceRequirementsHeader}>
                    <span className={styles.assistanceRequirementsTitle}>
                      Requirements for {formData.assistanceType}
                    </span>
                    {typeof selectedAssistanceCeiling === 'number' && (
                      <span className={styles.assistanceRequirementsCeiling}>
                        Ceiling: ₱{Number(selectedAssistanceCeiling).toLocaleString('en-PH')}
                      </span>
                    )}
                  </div>
                  <ul className={styles.assistanceRequirementsList}>
                    {selectedAssistanceRequirements.length ? (
                      selectedAssistanceRequirements.map((req, idx) => (
                        <li key={idx} className={styles.assistanceRequirementItem}>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={!!requirementUploadFiles?.[idx] || getExistingFilesForRequirement(idx).length > 0}
                              disabled
                            />
                            <span className={styles.checkmark}></span>
                            <span>{req}</span>
                          </label>
                        </li>
                      ))
                    ) : (
                      <li className={styles.assistanceRequirementItemEmpty}>
                        No checklist available for this assistance type.
                      </li>
                    )}
                  </ul>
                  {errors.requirementsChecklist && (
                    <p className={styles.errorText}>{errors.requirementsChecklist}</p>
                  )}
                </div>
              ) : (
                <p className={styles.assistanceRequirementsHint}>
                  Select a Type of Assistance to view the required documents.
                </p>
              )}

              {selectedAssistanceRequirements.length ? (
                <div className={styles.requirementUploads}>
                  {selectedAssistanceRequirements.map((req, idx) => {
                    const existingFiles = getExistingFilesForRequirement(idx);
                    const uploadedFile = requirementUploadFiles?.[idx] || null;
                    return (
                      <div key={`${req}-${idx}`} className={styles.requirementUploadItem}>
                        <div className={styles.requirementUploadHeader}>
                          <span className={styles.requirementUploadLabel}>{req}</span>
                          <span className={styles.requirementUploadLimit}>Upload limit: 1 file</span>
                        </div>
                        {existingFiles.length > 0 && !uploadedFile && (
                          <div className={styles.existingFileRow}>
                            <span className={styles.existingFileName}>
                              Existing: {existingFiles[0]?.file_name || `Document ${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              className={styles.removeExistingFileBtn}
                              onClick={() => setRemovedRequirementIndex((prev) => ({ ...prev, [idx]: true })) }
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <FileUpload
                          label={existingFiles.length ? 'Replace file (optional)' : 'Required'}
                          documentType="validId"
                          multiple={false}
                          files={uploadedFile ? [uploadedFile] : []}
                          onChange={(files) => handleRequirementUploadChange(idx, files)}
                          required={!existingFiles.length}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {errors.validId && <p className={styles.errorText}>{errors.validId}</p>}
            </div>
          </Card>

          <Card
            title="Assistance Request"
            subtitle="Log an assistance request"
          >
            <div className={styles.formFields}>
              <Select
                label="Type of Assistance"
                name="assistanceType"
                value={formData.assistanceType}
                onChange={handleChange}
                options={[{ value: '', label: 'Select type (if any)' }, ...assistanceTypeOptions]}
                optional
              />
              {formData.assistanceType === 'Others' && (
                <Input
                  label="Please specify"
                  name="otherAssistanceType"
                  value={formData.otherAssistanceType}
                  onChange={handleChange}
                  placeholder="Specify other assistance"
                  required
                />
              )}
              <Input
                label="Representative Name"
                name="representativeName"
                value={formData.representativeName}
                onChange={handleChange}
                placeholder="Enter representative's full name"
                disabled={!formData.assistanceType}
                optional
              />
              <Input
                label="Representative Contact"
                type="tel"
                name="representativeContact"
                value={formData.representativeContact}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                disabled={!formData.assistanceType}
                optional
              />

              <div style={{ opacity: formData.assistanceType ? 1 : 0.6 }}>
                <span className={styles.label}>Sector Classification (choose one)</span>
                <div className={styles.sectorList}>
                  {errors.sectors && <span className={styles.sectorError}>{errors.sectors}</span>}
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.pwd}
                      onChange={() => handleSectorChange('pwd')}
                      disabled={!formData.assistanceType}
                    />
                    <span className={styles.checkmark}></span>
                    <span>PWD (Person with Disability)</span>
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.seniorCitizen}
                      onChange={() => handleSectorChange('seniorCitizen')}
                      disabled={!formData.assistanceType}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Senior Citizen (60 years old and above)</span>
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.sectors.soloParent}
                      onChange={() => handleSectorChange('soloParent')}
                      disabled={!formData.assistanceType}
                    />
                    <span className={styles.checkmark}></span>
                    <span>Solo Parent</span>
                  </label>
                </div>
              </div>

              <label className={styles.checkbox} style={{ marginTop: 6, opacity: formData.assistanceType ? 1 : 0.6 }}>
                <input
                  type="checkbox"
                  checked={beneficiaryIsRequester}
                  onChange={(e) => setBeneficiaryIsRequester(e.target.checked)}
                  disabled={!formData.assistanceType}
                />
                <span className={styles.checkmark}></span>
                <span>Beneficiary is the same as requester</span>
              </label>
              {beneficiaryIsRequester ? (
                <p className={styles.muted} style={{ margin: '6px 0 0' }}>
                  Beneficiary details will be taken from Personal Information.
                </p>
              ) : (
                <>
                  <Input
                    label="Beneficiary Name"
                    name="beneficiaryName"
                    value={formData.beneficiaryName}
                    onChange={handleChange}
                    placeholder="Enter beneficiary's full name"
                    error={errors.beneficiaryName}
                    disabled={!formData.assistanceType}
                    required={!!formData.assistanceType && !beneficiaryIsRequester}
                  />
                  <Input
                    label="Beneficiary Contact"
                    type="tel"
                    name="beneficiaryContact"
                    value={formData.beneficiaryContact}
                    onChange={handleChange}
                    placeholder="+63 XXX XXX XXXX"
                    mask="ph-contact"
                    error={errors.beneficiaryContact}
                    disabled={!formData.assistanceType}
                    required={!!formData.assistanceType && !beneficiaryIsRequester}
                  />
                  <Input
                    label="Beneficiary Address"
                    name="beneficiaryAddress"
                    value={formData.beneficiaryAddress}
                    onChange={handleChange}
                    placeholder="House No., Street, Barangay, City"
                    error={errors.beneficiaryAddress}
                    disabled={!formData.assistanceType}
                    required={!!formData.assistanceType && !beneficiaryIsRequester}
                  />
                </>
              )}
              <Input
                label="Budget Ceiling"
                name="assistanceAmount"
                type="number"
                value={formData.assistanceAmount}
                placeholder="Auto-filled from assistance type"
                error={errors.assistanceAmount}
                disabled={!formData.assistanceType}
                readOnly
              />
            </div>
          </Card>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? 'Submitting...' : isEditMode ? 'Resubmit Request' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
