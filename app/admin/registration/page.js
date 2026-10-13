'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Button from '@/components/Button';
import styles from './page.module.css';
import { supabase } from '@/lib/supabaseClient';
import { assistanceTypeOptions, assistanceData } from '@/lib/assistanceData';
import {
  buildRequirementsMap,
  getLocalBudgetsMap,
  getLocalRequirementsMap,
  getRequirementsForType,
  isMissingRequirementsColumn,
} from '@/lib/assistanceRequirements';
import { createOrUpdateResident } from '@/lib/residents';
import { queryNextBeneficiaryControlNumber } from '@/lib/controlNumbers';
import { getCooldownInfo } from '@/lib/requestCooldown';
import { buildEligibilityMaps, getResidentEligibility } from '@/lib/residentEligibility';
import {
  BENEFICIARY_SECTOR_OPTIONS,
  buildSectorPairFromSource,
  deriveSectorFlags,
  getSecondarySectorOptions,
} from '@/lib/beneficiarySectors';

const sexOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const civilStatusOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'annulled', label: 'Annulled' },
];

const barangayOptions = [
  { value: 'sta-rita', label: 'Sta. Rita' },
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

const MISSING_REQUIREMENTS_VERIFICATION_CODE = 'MISSING_REQUIREMENTS_VERIFICATION_COLUMNS';
const MISSING_REQUIREMENTS_VERIFICATION_ERROR =
  'Database is missing requirements verification columns. Run setup-step10.sql in Supabase SQL Editor, then try again.';
const LOCKED_CITIZENSHIP = 'Filipino';
const SOLO_PARENT_MARRIED_ERROR = 'Married civil status is not allowed for Solo Parent classification.';
const REGISTRATION_WIZARD_STEPS = [
  { number: 1, label: 'Personal' },
  { number: 2, label: 'Photo' },
  { number: 3, label: 'Assistance' },
  { number: 4, label: 'Checklist' },
  { number: 5, label: 'Review' },
];
const REGISTRATION_WIZARD_TOTAL = REGISTRATION_WIZARD_STEPS.length;

const isCheckedRequirement = (item) => {
  if (item === true || item === 'true' || item === 1 || item === '1') return true;
  const value = item?.checked;
  const completed = item?.completed;
  return (
    value === true ||
    value === 'true' ||
    value === 1 ||
    value === '1' ||
    completed === true ||
    completed === 'true' ||
    completed === 1 ||
    completed === '1'
  );
};

const toBoolean = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
};

const parseRequirementsChecklist = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore invalid legacy values
    }
  }
  return [];
};

export default function RegistrationPage() {
  const router = useRouter();
  const [controlNumber, setControlNumber] = useState('');
  const [existingResidentId, setExistingResidentId] = useState('');
  const [budgets, setBudgets] = useState({});
  const [requirementsByType, setRequirementsByType] = useState({});
  const [formData, setFormData] = useState({
    // Personal Information
    lastName: '',
    firstName: '',
    middleName: '',
    houseNo: '',
    purok: '',
    barangay: 'sta-rita',
    city: 'Olongapo',
    birthday: '',
    birthplace: '',
    sex: '',
    citizenship: LOCKED_CITIZENSHIP,
    civilStatus: '',
    contactNumber: '',
    email: '',
    accountPassword: '',
    // Sector Classification
    primarySector: '',
    secondarySector: '',
    sectors: {
      pwd: false,
      seniorCitizen: false,
      soloParent: false,
    },
    // Representative Information
    representativeName: '',
    representativeContact: '',
    representativeRelationship: '',
    // Assistance Request
    assistanceType: '',
    otherAssistanceType: '',
    assistanceAmount: '',
    dateOfRequest: new Date().toISOString().split('T')[0],
    requirementsChecklist: {},
    requirementsCompleted: false, // fallback when no checklist is defined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [contactCheck, setContactCheck] = useState({
    checking: false,
    available: true,
    error: null,
  });
  const [requestEligibility, setRequestEligibility] = useState({
    loading: false,
    canCreateRequest: true,
    cooldownInfo: getCooldownInfo(null),
    blockReason: null,
  });
  const [staffProfile, setStaffProfile] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const wizardTopRef = useRef(null);
  const selectedSectorFlags = deriveSectorFlags(formData.primarySector, formData.secondarySector);
  const isSoloParentSectorSelected = selectedSectorFlags.is_solo_parent;
  const civilStatusOptionsForSectors = civilStatusOptions.map((option) => ({
    ...option,
    disabled: option.value === 'married' && isSoloParentSectorSelected,
    label:
      option.value === 'married' && isSoloParentSectorSelected
        ? 'Married (Not allowed for Solo Parent)'
        : option.label,
  }));

  const getAuthHeaders = useCallback(async () => {
    if (!supabase) throw new Error('Supabase client not initialized.');

    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (error || !session) {
      throw new Error('Not authenticated. Please log in again.');
    }

    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraStarting(false);
    setCameraReady(false);
    setCameraOpen(false);
  }, []);

  const setSelectedPhoto = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/i.test(file.type || '')) {
      setCameraError('Use a JPG, JPEG, or PNG photo.');
      return;
    }
    setCameraError('');
    setProfilePhotoFile(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

  const startCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is unavailable on this device. Upload a photo instead.');
      return;
    }

    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;
    setCameraStarting(true);

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (error) {
        if (error?.name !== 'OverconstrainedError') throw error;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      if (cameraRequestRef.current !== requestId) return;
      if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        setCameraError('Camera permission is blocked. Allow camera access in the address bar, then try again.');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setCameraError('No camera was found. Connect a camera or upload a photo instead.');
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setCameraError('The camera is being used by another app. Close that app and try again.');
      } else {
        setCameraError('The camera could not be started. Check browser permission or upload a photo instead.');
      }
    } finally {
      if (cameraRequestRef.current === requestId) setCameraStarting(false);
    }
  };

  useEffect(() => {
    if (!cameraOpen) return undefined;

    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return undefined;

    let cancelled = false;
    const markReady = () => {
      if (cancelled || !video.videoWidth || !video.videoHeight) return;
      setCameraReady(true);
      setCameraError('');
    };
    const handleVideoError = () => {
      if (!cancelled) {
        setCameraError('The camera preview could not be displayed. Restart the camera or upload a photo.');
      }
    };

    video.srcObject = stream;
    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('error', handleVideoError);
    void video.play().then(markReady).catch(handleVideoError);

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('error', handleVideoError);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [cameraOpen]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!cameraReady || !video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is still starting. Please wait for the preview.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Could not prepare the photo. Please restart the camera.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Could not capture the photo. Please try again.');
        return;
      }
      setSelectedPhoto(new File([blob], `beneficiary-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    const loadStaffProfile = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/profile', { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error) throw new Error(payload?.error || 'Unable to verify staff role.');
        if (!cancelled) setStaffProfile(payload.data);
      } catch (error) {
        if (!cancelled) setStatus({ type: 'error', message: error.message || 'Unable to verify staff role.' });
      }
    };
    void loadStaffProfile();
    return () => { cancelled = true; };
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!staffProfile || staffProfile.role === 'Admin') return;
    const allowed = Array.isArray(staffProfile.sector_access) ? staffProfile.sector_access : [];
    if (allowed.length !== 1) return;
    const primarySector = allowed[0];
    const flags = deriveSectorFlags(primarySector, '');
    setFormData((previous) => ({
      ...previous,
      primarySector,
      secondarySector: '',
      sectors: { pwd: flags.is_pwd, seniorCitizen: flags.is_senior_citizen, soloParent: flags.is_solo_parent },
    }));
  }, [staffProfile]);
  // Check whether a contact number is already registered (walk-in duplicate check)
  const checkContactAvailability = async (contactDigits) => {
    if (!contactDigits || contactDigits.length !== 11) {
      setContactCheck({ checking: false, available: true, error: null });
      return true;
    }

    // If editing an existing resident, exclude their own ID from the check
    if (existingResidentId) {
      setContactCheck({ checking: false, available: true, error: null });
      return true;
    }

    setContactCheck({ checking: true, available: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ contact: contactDigits });
      if (existingResidentId) {
        params.set('excludeResidentId', existingResidentId);
      }

      const res = await fetch(`/api/residents/check-contact?${params.toString()}`, { headers });
      const json = await res.json().catch(() => ({}));

      const available = !!json?.available;
      const error = json?.error || null;

      setContactCheck({ checking: false, available, error });
      return available;
    } catch {
      // On network error, allow submission (server-side will still block)
      setContactCheck({ checking: false, available: true, error: null });
      return true;
    }
  };

  const buildAddress = (resident) => {
    const barangayLabel = resident?.barangay === 'sta-rita' ? 'Sta. Rita' : resident?.barangay;
    const purokPart = resident?.purok ? `Purok ${resident.purok}` : '';
    return [resident?.house_no, purokPart, barangayLabel, resident?.city]
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  const buildResidentFullName = (data = formData) =>
    [data.firstName, data.middleName, data.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');

  const buildResidentAddress = (data = formData) => {
    const barangayLabel = data.barangay === 'sta-rita' ? 'Sta. Rita' : data.barangay;
    const purokPart = data.purok ? `Purok ${data.purok}` : '';
    return [data.houseNo, purokPart, barangayLabel, data.city]
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  const refreshResidentControlNumber = useCallback(async () => {
    const next = await queryNextBeneficiaryControlNumber(supabase);
    setControlNumber(next);
  }, []);

  const assistanceRequestBlocked =
    !!existingResidentId &&
    !!formData.assistanceType &&
    !requestEligibility.loading &&
    !requestEligibility.canCreateRequest;

  const getAssistanceBlockMessage = () => {
    if (requestEligibility.blockReason === 'active') {
      const status = String(requestEligibility.activeRequest?.status || 'Pending');
      return status === 'Approved'
        ? 'This beneficiary already has an approved assistance request. It must be released before another request can be created.'
        : 'This beneficiary already has an assistance request under review. Wait for processing before creating another request.';
    }
    if (requestEligibility.blockReason === 'incomplete') {
      return 'This beneficiary has an incomplete assistance request. Edit and resubmit that existing request from Assistance Requests.';
    }
    const info = requestEligibility.cooldownInfo;
    if (info?.nextEligibleDate) {
      return `This beneficiary must wait ${info.daysRemaining} more day(s) before another assistance request. Next eligible on ${info.nextEligibleDate}.`;
    }
    return 'This beneficiary is not eligible for another assistance request yet.';
  };

  useEffect(() => {
    const loadExistingResident = async (residentId) => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/residents/${encodeURIComponent(residentId)}`, { headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.error) {
          throw new Error(json?.error || 'Failed to load beneficiary.');
        }

        const resident = json?.data?.resident;
        if (!resident?.id) {
          throw new Error('Beneficiary not found.');
        }

        const sectorPair = buildSectorPairFromSource(resident);
        const sectorFlags = deriveSectorFlags(sectorPair.primarySector, sectorPair.secondarySector);
        setExistingResidentId(String(resident.id));
        setControlNumber(resident.control_number || '');
        setFormData((prev) => ({
          ...prev,
          lastName: resident.last_name || '',
          firstName: resident.first_name || '',
          middleName: resident.middle_name || '',
          houseNo: resident.house_no || '',
          purok: resident.purok || '',
          barangay: resident.barangay || 'sta-rita',
          city: resident.city || 'Olongapo',
          birthday: resident.birthday || '',
          birthplace: resident.birthplace || '',
          sex: resident.sex || '',
          citizenship: LOCKED_CITIZENSHIP,
          civilStatus: resident.civil_status || '',
          contactNumber: resident.contact_number || '',
          email: resident.email || '',
          primarySector: sectorPair.primarySector,
          secondarySector: sectorPair.secondarySector,
          sectors: {
            pwd: sectorFlags.is_pwd,
            seniorCitizen: sectorFlags.is_senior_citizen,
            soloParent: sectorFlags.is_solo_parent,
          },
          representativeName: resident.representative_name || '',
          representativeContact: resident.representative_contact || '',
          representativeRelationship: resident.representative_relationship || '',
        }));
        setStatus({
          type: 'success',
          message: 'Existing beneficiary loaded. Add the new walk-in request below.',
        });
      } catch (error) {
        setExistingResidentId('');
        setRequestEligibility({
          loading: false,
          canCreateRequest: true,
          cooldownInfo: getCooldownInfo(null),
          blockReason: null,
        });
        setStatus({
          type: 'error',
          message: error?.message || 'Failed to load beneficiary.',
        });
        await refreshResidentControlNumber();
      }
    };

    const residentId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('residentId')
        : null;

    if (residentId) {
      void loadExistingResident(residentId);
    } else {
      void refreshResidentControlNumber();
    }
  }, [getAuthHeaders, refreshResidentControlNumber]);

  useEffect(() => {
    let cancelled = false;

    const loadRequestEligibility = async () => {
      if (!existingResidentId || !formData.assistanceType) {
        setRequestEligibility({
          loading: false,
          canCreateRequest: true,
          cooldownInfo: getCooldownInfo(null),
          blockReason: null,
        });
        return;
      }

      setRequestEligibility((prev) => ({ ...prev, loading: true }));
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/assistance-requests?residentId=${encodeURIComponent(existingResidentId)}`,
          { headers },
        );
        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : [];
        const maps = buildEligibilityMaps(rows);
        const eligibility = getResidentEligibility(existingResidentId, maps, formData.assistanceType);
        if (!cancelled) {
          setRequestEligibility({
            loading: false,
            ...eligibility,
          });
        }
      } catch {
        if (!cancelled) {
          setRequestEligibility({
            loading: false,
            canCreateRequest: true,
            cooldownInfo: getCooldownInfo(null),
            blockReason: null,
          });
        }
      }
    };

    void loadRequestEligibility();
    return () => {
      cancelled = true;
    };
  }, [existingResidentId, formData.assistanceType, getAuthHeaders]);

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        if (!supabase) {
          console.error('Database client not available');
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
            if (row.assistance_type && typeof row.ceiling === 'number') {
              map[row.assistance_type] = row.ceiling;
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

  const getRequirementsFor = (type) => getRequirementsForType(type, requirementsByType);

  // Calculate age from date of birth
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
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (name === 'civilStatus' && value === 'married' && isSoloParentSectorSelected) {
      setErrors((prev) => ({ ...prev, civilStatus: SOLO_PARENT_MARRIED_ERROR }));
      return;
    }

    // Clear error when user starts changing the field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'assistanceType') {
      const ceiling = getCeilingFor(value);
      const reqs = value ? getRequirementsFor(value) : [];

      setErrors((prev) => ({
        ...prev,
        assistanceAmount: '',
        requirementsChecklist: '',
        requirementsCompleted: '',
      }));

      setFormData((prev) => ({
        ...prev,
        assistanceType: value,
        assistanceAmount: ceiling != null ? String(ceiling) : '',
        requirementsChecklist: reqs.reduce((acc, _req, idx) => {
          acc[idx] = false;
          return acc;
        }, {}),
        // Fallback confirmation when no checklist exists.
        requirementsCompleted: false,
      }));
      return;
    }

    if (name === 'contactNumber' || name === 'representativeContact') {
      const numericValue = String(value || '').replace(/\D/g, '');
      if (numericValue.length <= 11) {
        setFormData((prev) => ({
          ...prev,
          [name]: numericValue,
        }));

        // Check for duplicate contact number when 11 digits are entered
        if (name === 'contactNumber' && numericValue.length === 11) {
          void checkContactAvailability(numericValue);
        } else if (name === 'contactNumber' && numericValue.length < 11) {
          // Reset contact check when user clears/changes the number
          setContactCheck({ checking: false, available: true, error: null });
        }
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
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

  const handleSectorSelectChange = (event) => {
    if (staffProfile && staffProfile.role !== 'Admin') return;
    const { name, value } = event.target;
    const nextPrimary = name === 'primarySector' ? value : formData.primarySector;
    let nextSecondary = name === 'secondarySector' ? value : formData.secondarySector;
    if (nextPrimary && nextSecondary === nextPrimary) nextSecondary = '';
    const flags = deriveSectorFlags(nextPrimary, nextSecondary);
    const shouldClearMarried = flags.is_solo_parent && formData.civilStatus === 'married';

    if (errors.sectors || shouldClearMarried) {
      setErrors((prev) => ({
        ...prev,
        sectors: '',
        civilStatus: shouldClearMarried ? '' : prev.civilStatus,
      }));
    }

    setFormData((prev) => ({
      ...prev,
      primarySector: nextPrimary,
      secondarySector: nextSecondary,
      civilStatus: shouldClearMarried ? '' : prev.civilStatus,
      sectors: {
        pwd: flags.is_pwd,
        seniorCitizen: flags.is_senior_citizen,
        soloParent: flags.is_solo_parent,
      },
    }));
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

  const handleAddDocument = () => {
    const trimmed = newDocument.trim();
    if (trimmed && !requiredDocuments.includes(trimmed)) {
      setRequiredDocuments((prev) => [...prev, trimmed]);
      setNewDocument('');
    }
  };

  const handleRemoveDocument = (index) => {
    setRequiredDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDocument();
    }
  };

  const getFormErrors = () => {
    const newErrors = {};

    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.houseNo.trim()) newErrors.houseNo = 'House number is required';
    if (!String(formData.purok || '').trim()) newErrors.purok = 'Purok is required';
    if (!formData.birthday) newErrors.birthday = 'Birthday is required';
    if (!formData.birthplace.trim()) newErrors.birthplace = 'Birthplace is required';
    if (!formData.sex) newErrors.sex = 'Sex is required';
    if (!formData.citizenship.trim()) newErrors.citizenship = 'Citizenship is required';
    if (!formData.civilStatus) newErrors.civilStatus = 'Civil status is required';
    if (!formData.primarySector) newErrors.sectors = 'Primary Sector is required.';
    if (formData.primarySector && formData.secondarySector && formData.primarySector === formData.secondarySector) {
      newErrors.sectors = 'Secondary Sector must be different from Primary Sector.';
    }
    if (isSoloParentSectorSelected && formData.civilStatus === 'married') {
      newErrors.civilStatus = SOLO_PARENT_MARRIED_ERROR;
    }
    if (!existingResidentId && !profilePhotoFile) newErrors.profilePhoto = 'Capture or upload the beneficiary photo.';
    if (!existingResidentId && String(formData.accountPassword || '').length < 8) newErrors.accountPassword = 'Set an account password with at least 8 characters.';

    const email = String(formData.email || '').trim();
    if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) {
      newErrors.email = 'Enter a valid Gmail address ending in @gmail.com.';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (formData.contactNumber.length !== 11) {
      newErrors.contactNumber = 'Contact number must be exactly 11 digits';
    } else if (!existingResidentId && !contactCheck.available && contactCheck.error) {
      newErrors.contactNumber = contactCheck.error;
    }

    if (!newErrors.birthday) {
      const ageValue = calculateAge(formData.birthday);
      if (ageValue === '' || Number.isNaN(ageValue) || ageValue < 0) {
        newErrors.birthday = 'Please provide a valid birthday.';
      } else if (ageValue < 18 && !selectedSectorFlags.is_pwd) {
        newErrors.birthday = 'Registrant must be at least 18 years old unless classified as PWD.';
      } else if (selectedSectorFlags.is_senior_citizen && ageValue < 60) {
        newErrors.sectors = 'Senior Citizen requires age 60 or above.';
      }
    }

    if (formData.assistanceType && assistanceRequestBlocked) {
      newErrors.assistanceType = getAssistanceBlockMessage();
    }

    // Validate representative when applying for assistance on behalf of the registrant
    if (formData.assistanceType && !assistanceRequestBlocked) {
      const norm = (v) => String(v || '').trim().toLowerCase();
      const residentName = buildResidentFullName();
      const residentContact = String(formData.contactNumber || '').trim();

      if (formData.representativeName && norm(formData.representativeName) === norm(residentName)) {
        newErrors.representativeName = 'Representative must be different from beneficiary.';
      }
      if (formData.representativeContact) {
        if (String(formData.representativeContact).replace(/\D/g, '').length !== 11) {
          newErrors.representativeContact = 'Representative contact number must be exactly 11 digits.';
        } else if (String(formData.representativeContact || '').trim() === residentContact) {
          newErrors.representativeContact = 'Representative contact must be different from beneficiary contact.';
        }
      }
    }

    if (formData.assistanceType && !formData.assistanceAmount) {
      newErrors.assistanceAmount = 'Budget ceiling is not configured for this assistance type. Please update the assistance guidelines.';
    }

    if (formData.assistanceType) {
      if (selectedAssistanceRequirements.length) {
        const allChecked = selectedAssistanceRequirements.every(
          (_req, idx) => !!formData?.requirementsChecklist?.[idx],
        );

        if (!allChecked) {
          newErrors.requirementsChecklist = 'Please verify each requirement by checking all boxes.';
        }
      } else if (!formData.requirementsCompleted) {
        newErrors.requirementsCompleted = 'Please confirm that the requirements are complete.';
      }
    }

    return newErrors;
  };

  const getWizardStepForError = (errorName) => {
    if (errorName === 'profilePhoto') return 2;
    if (errorName === 'sectors') return 1;
    if (['assistanceType', 'assistanceAmount', 'representativeName', 'representativeContact'].includes(errorName)) return 3;
    if (['requirementsChecklist', 'requirementsCompleted'].includes(errorName)) return 4;
    return 1;
  };

  const validateWizardStep = (step) => {
    const allErrors = getFormErrors();
    const stepErrors = Object.fromEntries(
      Object.entries(allErrors).filter(([name, message]) => {
        if (!message || getWizardStepForError(name) !== step) return false;
        return true;
      }),
    );

    setErrors((previous) => {
      const next = { ...previous };
      Object.keys(next).forEach((name) => {
        if (getWizardStepForError(name) === step) delete next[name];
      });
      return { ...next, ...stepErrors };
    });
    return Object.keys(stepErrors).length === 0;
  };

  const handleWizardNext = () => {
    if (!validateWizardStep(mobileStep)) return;
    setMobileStep((step) => Math.min(step + 1, REGISTRATION_WIZARD_TOTAL));
    window.requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleWizardPrevious = () => {
    setMobileStep((step) => Math.max(step - 1, 1));
    window.requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleWizardStepClick = (stepNumber) => {
    if (stepNumber >= mobileStep) return;
    setMobileStep(stepNumber);
    window.requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (mobileStep < REGISTRATION_WIZARD_TOTAL) {
      handleWizardNext();
      return;
    }
    void handleSubmit(event);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!existingResidentId && formData.contactNumber.length === 11) {
      const isAvailable = await checkContactAvailability(formData.contactNumber);
      if (!isAvailable) {
        setErrors((prev) => ({ ...prev, contactNumber: contactCheck.error || 'This contact number is already registered.' }));
        return;
      }
    }

    const formErrors = getFormErrors();
    setErrors(formErrors);
    if (Object.keys(formErrors).length) {
      setMobileStep(Math.min(...Object.keys(formErrors).map(getWizardStepForError)));
      window.requestAnimationFrame(() => {
        wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    setStatus(null);
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      let profilePhotoUrl = '';
      if (profilePhotoFile) {
        const uploadForm = new FormData();
        uploadForm.append('file', profilePhotoFile);
        uploadForm.append('contactNumber', formData.contactNumber);
        uploadForm.append('documentType', 'selfie');
        const uploadResponse = await fetch('/api/account-requests/upload-valid-id', {
          method: 'POST',
          headers,
          body: uploadForm,
        });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || uploadPayload?.error) throw new Error(uploadPayload?.error || 'Failed to upload beneficiary photo.');
        profilePhotoUrl = uploadPayload?.data?.url || uploadPayload?.data?.path || '';
      }

      const requirementsChecklist = selectedAssistanceRequirements.map((label, index) => ({
        label,
        checked: !!formData.requirementsChecklist?.[index],
      }));
      const response = await fetch('/api/admin/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          ...formData,
          existingResidentId: existingResidentId || null,
          profilePhotoUrl,
          requirementsChecklist,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) throw new Error(payload?.error || 'Failed to save registration.');

      setStatus({ type: 'success', message: 'Beneficiary account, profile photo, QR/Actual ID, and request were linked successfully.' });
      router.push('/admin/residents');
    } catch (error) {
      setStatus({ type: 'error', message: `Failed to save registration: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      lastName: '',
      firstName: '',
      middleName: '',
      houseNo: '',
      purok: '',
      barangay: 'sta-rita',
      city: 'Olongapo',
      birthday: '',
      birthplace: '',
      sex: '',
      citizenship: LOCKED_CITIZENSHIP,
      civilStatus: '',
      contactNumber: '',
      email: '',
      accountPassword: '',
      sectors: {
        pwd: false,
        seniorCitizen: false,
        soloParent: false,
      },
      representativeName: '',
      representativeContact: '',
      representativeRelationship: '',
      assistanceType: '',
      otherAssistanceType: '',
      assistanceAmount: '',
      dateOfRequest: new Date().toISOString().split('T')[0],
      requirementsChecklist: {},
      requirementsCompleted: false,
    });
    void refreshResidentControlNumber();
    setMobileStep(1);
  };

  const selectedAssistanceRequirements = formData.assistanceType
    ? getRequirementsFor(formData.assistanceType)
    : [];
  const selectedAssistanceCeiling = formData.assistanceType ? getCeilingFor(formData.assistanceType) : null;
  const isSectorRestricted = !!staffProfile && staffProfile.role !== 'Admin';
  const availableSectorOptions = isSectorRestricted ? BENEFICIARY_SECTOR_OPTIONS.filter((option) => (staffProfile.sector_access || []).includes(option.value)) : BENEFICIARY_SECTOR_OPTIONS;
  const registrationProgress = Math.round((mobileStep / REGISTRATION_WIZARD_TOTAL) * 100);

  return (
    <div className={styles.registrationPage}>
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
      <form
        onSubmit={handleFormSubmit}
        className={`${styles.formGrid} ${styles.formGridSingleStep}`}
      >
        {/* Control Number */}
        <div className={styles.controlNumberBar}>
          <div className={styles.controlNumberLabel}>Control Number</div>
          <div className={styles.controlNumberValue}>{controlNumber}</div>
        </div>

        <div ref={wizardTopRef} className={styles.mobileWizardProgress} aria-label="Registration progress">
          <div className={styles.mobileWizardProgressHeader}>
            <div>
              <span>Application progress</span>
              <strong>{REGISTRATION_WIZARD_STEPS[mobileStep - 1]?.label}</strong>
            </div>
            <span className={styles.mobileWizardCount}>Step {mobileStep} of {REGISTRATION_WIZARD_TOTAL} · {registrationProgress}%</span>
          </div>
          <div
            className={styles.mobileWizardTrack}
            role="progressbar"
            aria-label="Registration completion"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={registrationProgress}
          >
            <span style={{ width: `${registrationProgress}%` }} />
          </div>
          <div className={styles.mobileWizardSteps}>
            {REGISTRATION_WIZARD_STEPS.map((step) => (
              <button
                key={step.number}
                type="button"
                className={`${styles.mobileWizardStep} ${step.number === mobileStep ? styles.mobileWizardStepActive : ''} ${step.number < mobileStep ? styles.mobileWizardStepComplete : ''}`}
                onClick={() => handleWizardStepClick(step.number)}
                disabled={step.number > mobileStep}
                aria-current={step.number === mobileStep ? 'step' : undefined}
                aria-label={`Step ${step.number}: ${step.label}`}
              >
                <span>{step.number < mobileStep ? '✓' : step.number}</span>
                <small>{step.label}</small>
              </button>
            ))}
          </div>
        </div>

        {/* Personal Information */}
        <Card
          title="Personal Information"
          subtitle="Enter the basic information of the resident"
          className={`${styles.mainCard} ${styles.wizardPanel} ${mobileStep === 1 ? styles.wizardPanelActive : ''}`}
        >
          <div className={styles.formFields}>
            <div className={styles.row3}>
              <Input
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
                error={errors.lastName}
                required
              />
              <Input
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                error={errors.firstName}
                required
              />
              <Input
                label="Middle Name"
                name="middleName"
                value={formData.middleName}
                onChange={handleChange}
                placeholder="Enter middle name"
                optional
              />
            </div>

            <div>
              <span className={styles.label}>Sector Classification</span>
              {errors.sectors && <span className={styles.sectorError}>{errors.sectors}</span>}
              <div className={styles.row}>
                <Select
                  label="Primary Sector"
                  name="primarySector"
                  value={formData.primarySector}
                  onChange={handleSectorSelectChange}
                  options={availableSectorOptions}
                  placeholder="Select primary sector"
                  disabled={!staffProfile || isSectorRestricted}
                  required
                />
                <Select
                  label="Secondary Sector"
                  name="secondarySector"
                  value={formData.secondarySector}
                  onChange={handleSectorSelectChange}
                  options={getSecondarySectorOptions(formData.primarySector).filter((option) => availableSectorOptions.some((allowed) => allowed.value === option.value))}
                  placeholder="No secondary sector"
                  disabled={!staffProfile || isSectorRestricted}
                  allowEmptyOption
                />
              </div>
            </div>

            <div className={styles.row}>
              <Input
                label="House No."
                name="houseNo"
                value={formData.houseNo}
                onChange={handleChange}
                placeholder="House number"
                error={errors.houseNo}
                required
              />
              <Select
                label="Purok"
                name="purok"
                value={formData.purok}
                onChange={handleChange}
                options={purokOptions}
                placeholder="Select purok"
                error={errors.purok}
                required
              />
            </div>

            <div className={styles.row}>
              <Select
                label="Barangay"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                options={barangayOptions}
                placeholder="Select barangay"
                required
                disabled
              />
              <Input
                label="City/Municipality"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
                disabled
              />
            </div>

            <div className={styles.row3}>
              <Input
                label="Birthday"
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange}
                error={errors.birthday}
                required
              />
              <div className={styles.ageField}>
                <label className={styles.label}>Age</label>
                <div className={styles.ageDisplay}>
                  {calculateAge(formData.birthday) || 'Auto'}
                </div>
              </div>
              <Input
                label="Birthplace"
                name="birthplace"
                value={formData.birthplace}
                onChange={handleChange}
                placeholder="Place of birth"
                error={errors.birthplace}
                required
              />
            </div>

            <div className={styles.row}>
              <Select
                label="Sex"
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                options={sexOptions}
                placeholder="Select sex"
                error={errors.sex}
                required
              />
              <Input
                label="Citizenship"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleChange}
                readOnly
                disabled
                error={errors.citizenship}
                required
              />
            </div>

            <div className={styles.row3}>
              <Select
                label="Civil Status"
                name="civilStatus"
                value={formData.civilStatus}
                onChange={handleChange}
                options={civilStatusOptionsForSectors}
                placeholder="Select civil status"
                error={errors.civilStatus}
                required
              />
              <Input
                label="Contact Number"
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="+63 XXX XXX XXXX"
                mask="ph-contact"
                error={errors.contactNumber || (!contactCheck.available && contactCheck.error ? contactCheck.error : '')}
              />
              <Input
                label="Gmail Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@gmail.com"
                autoComplete="email"
                error={errors.email}
                optional
              />
              {contactCheck.checking && (
                <span className={styles.contactChecking}>Checking contact number...</span>
              )}
            </div>
            <Input label="Beneficiary Account Password" type="password" name="accountPassword" value={formData.accountPassword} onChange={handleChange} placeholder="At least 8 characters" error={errors.accountPassword} required={!existingResidentId} disabled={!!existingResidentId} />
          </div>
        </Card>

        {/* Side Cards */}
        <div className={styles.sideCards}>
          <Card title="Beneficiary Photo" subtitle="Capture or upload the official profile photo for the Actual ID." className={`${styles.sideCard} ${styles.photoStepCard} ${styles.wizardPanel} ${mobileStep === 2 ? styles.wizardPanelActive : ''}`}>
            <div className={styles.photoCapture}>
              {profilePhotoPreview ? <img src={profilePhotoPreview} alt="Beneficiary photo preview" className={styles.photoPreview} /> : cameraOpen ? <video ref={videoRef} autoPlay playsInline muted className={styles.photoPreview} /> : <div className={styles.photoPlaceholder}>No beneficiary photo captured</div>}
              <input ref={photoInputRef} className={styles.photoFileInput} type="file" accept="image/jpeg,image/png" onChange={(event) => setSelectedPhoto(event.target.files?.[0])} />
              <div className={styles.photoActions}>
                {!cameraOpen && !profilePhotoPreview && <Button type="button" onClick={startCamera} disabled={cameraStarting}>{cameraStarting ? 'Opening Camera…' : 'Open Camera'}</Button>}
                {cameraOpen && <Button type="button" onClick={capturePhoto} disabled={!cameraReady}>{cameraReady ? 'Take Photo' : 'Starting Camera…'}</Button>}
                {cameraOpen && <Button type="button" variant="secondary" onClick={stopCamera}>Cancel Camera</Button>}
                {!cameraOpen && <Button type="button" variant="secondary" onClick={() => photoInputRef.current?.click()}>Upload Photo</Button>}
                {profilePhotoPreview && <Button type="button" variant="secondary" onClick={() => { setProfilePhotoFile(null); setProfilePhotoPreview(''); void startCamera(); }}>Retake</Button>}
              </div>
              {cameraOpen && !cameraReady && !cameraError && <p className={styles.cameraStatus} role="status">Waiting for the camera preview…</p>}
              {cameraError && <p className={styles.errorText}>{cameraError}</p>}
              {errors.profilePhoto && <p className={styles.errorText}>{errors.profilePhoto}</p>}
            </div>
          </Card>
          {/* ATTACH REQUIREMENTS */}
            <Card
              title="ATTACH REQUIREMENTS"
              subtitle="Confirm that the resident's requirements have been completed"
              className={`${styles.sideCard} ${styles.wizardPanel} ${mobileStep === 4 ? styles.wizardPanelActive : ''}`}
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
                                checked={!!formData?.requirementsChecklist?.[idx]}
                                onChange={() => toggleRequirement(idx)}
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

                    {!selectedAssistanceRequirements.length && (
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          name="requirementsCompleted"
                          checked={!!formData.requirementsCompleted}
                          onChange={handleChange}
                        />
                        <span className={styles.checkmark}></span>
                        <span>I confirm that the requirements are complete.</span>
                      </label>
                    )}

                    {errors.requirementsChecklist && (
                      <p className={styles.errorText}>{errors.requirementsChecklist}</p>
                    )}
                    {errors.requirementsCompleted && (
                      <p className={styles.errorText}>{errors.requirementsCompleted}</p>
                    )}
                  </div>
                ) : (
                  <p className={styles.assistanceRequirementsHint}>
                    Select a Type of Assistance to view the required documents.
                  </p>
                )}
              </div>
            </Card>

          {/* Assistance Request Card */}
          <Card
            title="Initial Assistance Request"
            subtitle="Optional: log an assistance request upon registration"
            className={`${styles.sideCard} ${styles.wizardPanel} ${mobileStep === 3 ? styles.wizardPanelActive : ''}`}
          >
            <div className={styles.formFields}>
              {assistanceRequestBlocked ? (
                <div className={styles.eligibilityBanner} role="status">
                  {getAssistanceBlockMessage()}
                </div>
              ) : null}
              <Select
                label="Type of Assistance"
                name="assistanceType"
                value={formData.assistanceType}
                onChange={handleChange}
                options={[{ value: '', label: 'Select type (if any)' }, ...assistanceTypeOptions]}
                optional
                error={errors.assistanceType}
              />
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
              <Input
                label="Relationship to Beneficiary"
                name="representativeRelationship"
                value={formData.representativeRelationship}
                onChange={handleChange}
                placeholder="Parent, guardian, sibling, etc."
                disabled={!formData.assistanceType}
                optional
              />

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

          <Card
            title="Review Registration"
            subtitle="Confirm the resident and assistance details before saving"
            className={`${styles.sideCard} ${styles.wizardPanel} ${styles.wizardReview} ${mobileStep === 5 ? styles.wizardPanelActive : ''}`}
          >
            <dl className={styles.wizardReviewGrid}>
              <div><dt>Full Name</dt><dd>{buildResidentFullName() || 'Not provided'}</dd></div>
              <div><dt>Control Number</dt><dd>{controlNumber || 'Generating…'}</dd></div>
              <div><dt>Address</dt><dd>{[formData.houseNo, formData.purok && `Purok ${formData.purok}`, 'Sta. Rita', formData.city].filter(Boolean).join(', ')}</dd></div>
              <div><dt>Birthday / Age</dt><dd>{formData.birthday ? `${formData.birthday} · ${calculateAge(formData.birthday)}` : 'Not provided'}</dd></div>
              <div><dt>Birthplace</dt><dd>{formData.birthplace || 'Not provided'}</dd></div>
              <div><dt>Sex</dt><dd>{formData.sex || 'Not provided'}</dd></div>
              <div><dt>Citizenship</dt><dd>{formData.citizenship || 'Not provided'}</dd></div>
              <div><dt>Civil Status</dt><dd>{formData.civilStatus || 'Not provided'}</dd></div>
              <div><dt>Contact Number</dt><dd>{formData.contactNumber || 'Not provided'}</dd></div>
              <div><dt>Gmail Address</dt><dd>{formData.email || 'Not provided'}</dd></div>
              <div><dt>Primary Sector</dt><dd>{formData.primarySector || 'Not provided'}</dd></div>
              <div><dt>Secondary Sector</dt><dd>{formData.secondarySector || 'None'}</dd></div>
              <div><dt>Assistance</dt><dd>{formData.assistanceType || 'No initial request'}</dd></div>
              <div><dt>Budget Ceiling</dt><dd>{formData.assistanceAmount ? `₱${Number(formData.assistanceAmount).toLocaleString('en-PH')}` : 'Not applicable'}</dd></div>
              <div><dt>Representative</dt><dd>{formData.representativeName || 'None'}</dd></div>
              <div><dt>Representative Contact</dt><dd>{formData.representativeContact || 'None'}</dd></div>
              <div><dt>Relationship</dt><dd>{formData.representativeRelationship || 'None'}</dd></div>
            </dl>
          </Card>

          <div className={`${styles.actions} ${styles.mobileWizardActions}`}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            {mobileStep > 1 && (
              <Button type="button" variant="secondary" onClick={handleWizardPrevious} disabled={isSubmitting}>
                Previous
              </Button>
            )}
            {mobileStep < REGISTRATION_WIZARD_TOTAL ? (
              <Button key="wizard-next" type="button" onClick={handleWizardNext} disabled={isSubmitting || contactCheck.checking}>
                Next
              </Button>
            ) : (
              <Button
                key="wizard-submit"
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || contactCheck.checking}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`${styles.actions} ${styles.desktopActions}`}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {isSubmitting ? 'Saving...' : 'Save Registration'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
