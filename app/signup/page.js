'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import FileUpload from '../../components/FileUpload';
import ConstellationBackground from '../../components/ConstellationBackground';
import SectionHeader from '@/components/SectionHeader';
import {
  BENEFICIARY_SECTOR_OPTIONS,
  deriveSectorFlags,
  getSecondarySectorOptions,
  getSectorLabel,
} from '@/lib/beneficiarySectors';
import styles from './page.module.css';
import { verifyFaceMatchWithFaceApi } from '@/lib/faceVerification.client';

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

const SOLO_PARENT_MARRIED_ERROR = 'Married civil status is not allowed for Solo Parent classification.';
const SENIOR_AGE_ERROR = 'Senior Citizen classification requires the beneficiary to be 60 years old or above.';
const NON_PWD_MINOR_ERROR = 'Beneficiaries below 18 years old can only register online when classified as PWD.';
const MINOR_CIVIL_STATUS_ERROR = 'Beneficiaries below 18 years old must use Single as civil status.';
const REPRESENTATIVE_PARTIAL_ERROR =
  'Complete the guardian/representative name, 11-digit contact number, and relationship, or leave all representative fields blank.';
const MIN_BIRTHDATE = '1909-01-01';
const MIN_BIRTH_YEAR = 1909;
const MAX_AGE = 116;

const getCivilStatusOptions = (isSoloParent, isMinor = false) => {
  if (isMinor) {
    return civilStatusOptions.filter((option) => option.value === 'single');
  }

  return civilStatusOptions.map((option) => ({
    ...option,
    disabled: isSoloParent && option.value === 'married',
  }));
};

const STEPS = [
  { number: 1, label: 'Beneficiary Type' },
  { number: 2, label: 'Personal Details' },
  { number: 3, label: 'Address' },
  { number: 4, label: 'Identity Verification' },
  { number: 5, label: 'Account Setup' },
  { number: 6, label: 'Review & Submit' },
];
const TOTAL_STEPS = STEPS.length;
const ESTIMATED_TOTAL_MINUTES = 8;
const MINOR_PWD_REPRESENTATIVE_ERROR =
  'Beneficiaries below 18 years old must provide a guardian or representative before registration can be completed.';
const VALID_ID_BOTH_SIDES_ERROR = 'Please upload both the front and back images of your valid ID.';
const FACE_VERIFICATION_FAILED_ERROR =
  'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.';

const sectorCardDetails = {
  senior_citizen: {
    title: 'Senior Citizen',
    description: 'For residents aged 60 and above applying for senior citizen support.',
    mark: 'SC',
  },
  pwd: {
    title: 'Person with Disability (PWD)',
    description: 'For residents registering with a disability classification or guardian support.',
    mark: 'PW',
  },
  solo_parent: {
    title: 'Solo Parent',
    description: 'For qualified solo parents requesting ALAGA Program registration.',
    mark: 'SP',
  },
};

const signupRequirements = [
  ['Estimated completion', '5-10 minutes'],
  ['Government-issued ID', 'Front and back images required'],
  ['SMS verification', 'Active mobile number required'],
  ['Final review', 'Check all details before submission'],
];

const philippinesDateFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const philippinesTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const PHILIPPINES_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const PHILIPPINES_TIME_ENDPOINTS = [
  'https://worldtimeapi.org/api/timezone/Asia/Manila',
  'https://timeapi.io/api/time/current/zone?timeZone=Asia%2FManila',
];

const getPhilippinesTimeEpochMs = (payload) => {
  if (Number.isFinite(payload?.unixtime)) return payload.unixtime * 1000;
  if (payload?.utc_datetime) return Date.parse(payload.utc_datetime);
  if (payload?.datetime) return Date.parse(payload.datetime);
  if (payload?.dateTime) {
    const year = Number(payload.year);
    const month = Number(payload.month);
    const day = Number(payload.day);
    const hour = Number(payload.hour);
    const minute = Number(payload.minute);
    const seconds = Number(payload.seconds ?? payload.second ?? 0);

    if ([year, month, day, hour, minute, seconds].every(Number.isFinite)) {
      return Date.UTC(year, month - 1, day, hour - 8, minute, seconds);
    }
  }
  return Number.NaN;
};

const validIdExamples = [
  {
    title: 'Program-specific IDs',
    items: ['PWD ID', 'Senior Citizen ID', 'Solo Parent ID'],
  },
  {
    title: 'Government photo IDs',
    items: ['PhilID / National ID', 'Philippine Passport', "Driver's License", 'UMID / SSS / GSIS ID'],
  },
  {
    title: 'Other accepted examples',
    items: ["Voter's ID", 'Postal ID', 'PRC ID', 'Barangay ID or Certificate of Residency'],
  },
];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function FaceRecognitionCapture({ onCapture, disabled = false, status, verifying = false, error = '' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState('');

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setCapturedPreviewUrl('');
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const openCamera = useCallback(async () => {
    setCameraError('');
    clearPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch {
      setCameraError('Camera access is required to capture a live selfie for face recognition.');
    }
  }, [clearPreview]);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight || disabled || verifying) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `live-selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      clearPreview();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setCapturedPreviewUrl(previewUrl);
      stopCamera();
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(openCamera, 0);
    return () => {
      window.clearTimeout(timeoutId);
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [openCamera, stopCamera]);

  const canRetry = !verifying && status && status !== 'passed';

  return (
    <div className={styles.faceRecognitionPanel}>
      <div className={styles.faceRecognitionHeader}>
        <div>
          <h4 className={styles.faceRecognitionTitle}>Face Recognition</h4>
          <p className={styles.faceRecognitionHint}>Center your face inside the frame, then capture a live selfie.</p>
        </div>
        {verifying && <span className={styles.faceRecognitionLoading}>Verifying identity...</span>}
      </div>

      <div className={styles.faceRecognitionBody}>
        <div className={styles.faceCameraFrame}>
          {capturedPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URLs cannot be optimized by next/image.
            <img src={capturedPreviewUrl} alt="Captured live selfie" className={styles.selfieVideo} />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className={styles.selfieVideo} />
          )}
          {!capturedPreviewUrl && <span className={styles.faceFrameLabel}>Frame your face</span>}
          <span className={styles.faceFrameOval} aria-hidden="true" />
        </div>
        <div className={styles.faceRecognitionActions}>
          <div className={styles.faceChecklist} aria-label="Selfie capture tips">
            <span>Use good lighting</span>
            <span>Look directly at the camera</span>
            <span>Remove mask, cap, or dark glasses</span>
          </div>
          {!capturedPreviewUrl && (
            <Button type="button" onClick={captureSelfie} disabled={disabled || verifying || !cameraReady}>
              Capture Live Selfie
            </Button>
          )}
          {canRetry && (
            <Button type="button" variant="secondary" onClick={openCamera}>
              Retake Selfie
            </Button>
          )}
          {status === 'passed' && <span className={styles.verifiedBadge}>✅ Face Match Verified</span>}
          {status && status !== 'passed' && !verifying && <p className={styles.fieldError}>❌ Face Match Failed</p>}
          {(error || cameraError) && <p className={styles.fieldError}>{error || cameraError}</p>}
        </div>
      </div>
    </div>
  );
}

export default function BeneficiarySignupPage() {
  const router = useRouter();
  const stepContainerRef = useRef(null);
  const identityUploadRef = useRef('');

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [slideDirection, setSlideDirection] = useState('next');
  const [currentPhilippinesTime, setCurrentPhilippinesTime] = useState(null);
  const [philippinesTimeStatus, setPhilippinesTimeStatus] = useState('syncing');

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [validIdFrontFiles, setValidIdFrontFiles] = useState([]);
  const [validIdBackFiles, setValidIdBackFiles] = useState([]);
  const [selfieFiles, setSelfieFiles] = useState([]);
  const [identityUrls, setIdentityUrls] = useState({ front: '', back: '', selfie: '' });
  const [faceVerification, setFaceVerification] = useState(null);
  const [identityVerifying, setIdentityVerifying] = useState(false);
  const [representativeValidIdFiles, setRepresentativeValidIdFiles] = useState([]);
  const [validIdError, setValidIdError] = useState('');
  const [representativeValidIdError, setRepresentativeValidIdError] = useState('');
  const [legalModal, setLegalModal] = useState(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    contactNumber: '',
  });
  const [toast, setToast] = useState({ open: false, message: '' });
  const [otpCode, setOtpCode] = useState('');
  const [otpStatus, setOtpStatus] = useState(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpVerifiedContact, setOtpVerifiedContact] = useState('');
  const [contactChecking, setContactChecking] = useState(false);
  const [contactUnavailable, setContactUnavailable] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthday: '',
    birthplace: '',
    sex: '',
    citizenship: 'Filipino',
    civilStatus: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
    primarySector: '',
    secondarySector: '',
    isPwd: false,
    isSeniorCitizen: false,
    isSoloParent: false,
    representativeName: '',
    representativeContact: '',
    representativeRelationship: '',
    houseNo: '',
    purok: '',
    barangay: 'Sta. Rita',
    city: 'Olongapo City',
  });

  useEffect(() => {
    let isMounted = true;
    let syncAnchor = null;

    const updateFromSyncedTime = () => {
      if (!syncAnchor || !isMounted) return;
      setCurrentPhilippinesTime(new Date(syncAnchor.epochMs + performance.now() - syncAnchor.syncedAtMs));
    };

    const syncPhilippinesTime = async () => {
      if (!syncAnchor) setPhilippinesTimeStatus('syncing');

      for (const endpoint of PHILIPPINES_TIME_ENDPOINTS) {
        try {
          const response = await fetch(endpoint, { cache: 'no-store' });
          if (!response.ok) continue;

          const payload = await response.json();
          const epochMs = getPhilippinesTimeEpochMs(payload);
          if (!Number.isFinite(epochMs)) continue;

          syncAnchor = {
            epochMs,
            syncedAtMs: performance.now(),
          };
          setPhilippinesTimeStatus('synced');
          updateFromSyncedTime();
          return;
        } catch {
          // Try the next source.
        }
      }

      if (isMounted && !syncAnchor) setPhilippinesTimeStatus('error');
    };

    syncPhilippinesTime();
    const tickTimer = window.setInterval(updateFromSyncedTime, 1000);
    const syncTimer = window.setInterval(syncPhilippinesTime, PHILIPPINES_TIME_SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(tickTimer);
      window.clearInterval(syncTimer);
    };
  }, []);

  // Computed values
  const hasSectorSelected = !!form.primarySector;
  const isOtpVerified = otpVerified && otpVerifiedContact === form.contactNumber;
  const isContactValid = /^0\d{10}$/.test(String(form.contactNumber || '').trim());
  const isContactBlocked = !!contactUnavailable;

  // ===========================
  // HELPERS
  // ===========================

  const getTodayIso = () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  };

  const parseBirthdate = (dob) => {
    const value = String(dob || '').trim();
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return { date, year, iso: value };
  };

  const calculateAge = (dob) => {
    const parsed = parseBirthdate(dob);
    if (!parsed) return '';
    const today = new Date();
    let age = today.getFullYear() - parsed.date.getUTCFullYear();
    const monthDiff = today.getMonth() - parsed.date.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.date.getUTCDate())) {
      age--;
    }
    return age;
  };

  const getBirthdayValidationError = (dob) => {
    const value = String(dob || '').trim();
    if (!value) return 'Please enter your birthday.';
    const parsed = parseBirthdate(value);
    if (!parsed) return 'Birthday must be a valid date using the date picker format.';
    if (parsed.year < MIN_BIRTH_YEAR || parsed.iso < MIN_BIRTHDATE) {
      return `Birthday cannot be earlier than ${MIN_BIRTH_YEAR}.`;
    }
    if (parsed.iso > getTodayIso()) return 'Birthday cannot be in the future.';
    const age = calculateAge(value);
    if (age === '' || Number.isNaN(age) || age < 0) return 'Please provide a valid birthday.';
    if (age > MAX_AGE) return `Maximum allowed age is ${MAX_AGE}.`;
    return '';
  };

  const ageValue = calculateAge(form.birthday);
  const requiresRepresentative = ageValue !== '' && Number(ageValue) < 18 && !!form.isPwd;
  const hasRepresentativeInfo =
    !!String(form.representativeName || '').trim() ||
    !!String(form.representativeContact || '').trim() ||
    !!String(form.representativeRelationship || '').trim();
  const shouldShowRepresentativeId = requiresRepresentative || hasRepresentativeInfo;
  const hasUploadedIdentityImages = validIdFrontFiles.length > 0 && validIdBackFiles.length > 0;
  const progressPercent = Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100);
  const remainingSteps = Math.max(0, TOTAL_STEPS - currentStep);
  const estimatedRemainingMinutes = Math.max(1, Math.ceil((remainingSteps / TOTAL_STEPS) * ESTIMATED_TOTAL_MINUTES));
  const currentStepLabel = STEPS[currentStep - 1]?.label || 'Registration';
  const currentPhilippinesDateLabel = currentPhilippinesTime
    ? philippinesDateFormatter.format(currentPhilippinesTime)
    : philippinesTimeStatus === 'error'
      ? 'Unable to sync network time'
      : 'Fetching Philippine Standard Time';
  const currentPhilippinesTimeLabel = currentPhilippinesTime
    ? philippinesTimeFormatter.format(currentPhilippinesTime)
    : 'Syncing...';

  const resetOtpState = () => {
    setOtpCode('');
    setOtpStatus(null);
    setOtpVerified(false);
    setOtpCooldown(0);
    setOtpExpiresAt(null);
    setOtpVerifiedContact('');
  };

  const formatContactForDisplay = (num) => {
    if (!num || num.length !== 11) return num || '—';
    return `+63 ${num.slice(1, 4)} ${num.slice(4, 7)} ${num.slice(7)}`;
  };

  const formatBirthday = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getSectorName = () => {
    const sectors = [getSectorLabel(form.primarySector), getSectorLabel(form.secondarySector)].filter(Boolean);
    return sectors.length ? sectors.join(', ') : '—';
  };

  const getSexDisplay = () => {
    const opt = sexOptions.find((o) => o.value === form.sex);
    return opt ? opt.label : '—';
  };

  const getCivilStatusDisplay = () => {
    const opt = civilStatusOptions.find((o) => o.value === form.civilStatus);
    return opt ? opt.label : '—';
  };

  const getFullName = () => {
    const parts = [form.firstName, form.middleName, form.lastName].filter(Boolean);
    return parts.join(' ') || '—';
  };

  const showToast = (message, type = 'success') => {
    setToast({ open: true, message, type });
  };

  const showValidationError = (message) => {
    setStatus({ type: 'error', message });
    showToast(message, 'error');
  };

  const getPersonalEligibilityError = (age = ageValue, civilStatus = form.civilStatus) => {
    const birthdayError = getBirthdayValidationError(form.birthday);
    if (birthdayError) return birthdayError;
    if (age < 18 && !form.isPwd) return NON_PWD_MINOR_ERROR;
    if (age < 18 && civilStatus !== 'single') return MINOR_CIVIL_STATUS_ERROR;
    if (form.isSeniorCitizen && age < 60) return SENIOR_AGE_ERROR;
    if (form.isSoloParent && civilStatus === 'married') return SOLO_PARENT_MARRIED_ERROR;
    return '';
  };

  const hasStep2RequiredFields = () => {
    const age = calculateAge(form.birthday);
    const repContact = String(form.representativeContact || '').trim();
    const hasRequiredPersonalDetails =
      !!form.firstName.trim() &&
      !!form.lastName.trim() &&
      !!form.birthday &&
      !getBirthdayValidationError(form.birthday) &&
      age !== '' &&
      !Number.isNaN(age) &&
      age >= 0 &&
      !!form.birthplace.trim() &&
      !!form.sex &&
      !!form.civilStatus;

    if (!hasRequiredPersonalDetails) return false;

    if (requiresRepresentative) {
      return (
        !!form.representativeName.trim() &&
        repContact.length === 11 &&
        !!form.representativeRelationship.trim()
      );
    }

    return true;
  };

  // ===========================
  // EVENT HANDLERS
  // ===========================

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    if (name && fieldErrors?.[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'contactNumber') {
      resetOtpState();
      setContactUnavailable('');
    }

    if (name === 'representativeContact') {
      setForm((prev) => ({ ...prev, [name]: String(value || '').replace(/\D/g, '').slice(0, 11) }));
      return;
    }

    if (name === 'civilStatus' && value !== 'single' && ageValue !== '' && Number(ageValue) < 18) {
      showValidationError(MINOR_CIVIL_STATUS_ERROR);
      return;
    }

    if (name === 'birthday') {
      const nextAge = calculateAge(value);
      setForm((prev) => ({
        ...prev,
        birthday: value,
        civilStatus:
          nextAge !== '' && Number(nextAge) < 18 && prev.civilStatus !== 'single'
            ? 'single'
            : prev.civilStatus,
      }));
      if (nextAge !== '' && Number(nextAge) < 18 && form.civilStatus && form.civilStatus !== 'single') {
        showValidationError(MINOR_CIVIL_STATUS_ERROR);
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleSectorSelectChange = (event) => {
    const { name, value } = event.target;
    if (validIdError) setValidIdError('');
    const selectedPrimary = name === 'primarySector' ? value : form.primarySector;
    const selectedSecondary =
      name === 'secondarySector'
        ? value
        : selectedPrimary && form.secondarySector === selectedPrimary
          ? ''
          : form.secondarySector;
    const selectedFlags = deriveSectorFlags(selectedPrimary, selectedSecondary);
    if (selectedFlags.is_senior_citizen && ageValue !== '' && Number(ageValue) < 60) {
      showValidationError(SENIOR_AGE_ERROR);
    }
    if (selectedFlags.is_solo_parent && form.civilStatus === 'married') {
      showValidationError(SOLO_PARENT_MARRIED_ERROR);
    }
    setForm((prev) => {
      const nextPrimary = name === 'primarySector' ? value : prev.primarySector;
      let nextSecondary = name === 'secondarySector' ? value : prev.secondarySector;
      if (!nextPrimary || nextSecondary === nextPrimary) nextSecondary = '';
      const flags = deriveSectorFlags(nextPrimary, nextSecondary);
      const nextIsSoloParent = flags.is_solo_parent;
      const nextIsMinor = ageValue !== '' && Number(ageValue) < 18;
      return {
        ...prev,
        primarySector: nextPrimary,
        secondarySector: nextSecondary,
        isPwd: flags.is_pwd,
        isSeniorCitizen: flags.is_senior_citizen,
        isSoloParent: flags.is_solo_parent,
        civilStatus:
          nextIsMinor && prev.civilStatus !== 'single'
            ? 'single'
            : nextIsSoloParent && prev.civilStatus === 'married'
              ? ''
            : prev.civilStatus,
      };
    });
  };

  const resetFaceVerification = () => {
    setIdentityUrls({ front: '', back: '', selfie: '' });
    setFaceVerification(null);
    setSelfieFiles([]);
  };

  const handleValidIdFrontChange = (files) => {
    setValidIdFrontFiles(files);
    resetFaceVerification();
    if (validIdError) setValidIdError('');
  };

  const handleValidIdBackChange = (files) => {
    setValidIdBackFiles(files);
    resetFaceVerification();
    if (validIdError) setValidIdError('');
  };


  const handleRepresentativeValidIdChange = (files) => {
    setRepresentativeValidIdFiles(files);
    if (representativeValidIdError) setRepresentativeValidIdError('');
  };

  // ===========================
  // EFFECTS
  // ===========================

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => {
      setToast({ open: false, message: '' });
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast.open]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (!isContactValid) {
      setContactUnavailable('');
      setContactChecking(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setContactChecking(true);
      try {
        const contactNumber = String(form.contactNumber || '').trim();
        const response = await fetch(
          `/api/account-requests/check-contact?contactNumber=${encodeURIComponent(contactNumber)}`,
          { signal: controller.signal },
        );
        const { data, error } = await response.json().catch(() => ({}));
        if (!response.ok) {
          setContactUnavailable(error || 'Unable to verify contact number.');
          return;
        }
        if (data?.available) {
          setContactUnavailable('');
          setFieldErrors((prev) => ({ ...prev, contactNumber: '' }));
        } else {
          const msg =
            data?.error ||
            'This contact number is already registered';
          setContactUnavailable(msg);
          setFieldErrors((prev) => ({ ...prev, contactNumber: msg }));
          resetOtpState();
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setContactUnavailable('');
        }
      } finally {
        if (!controller.signal.aborted) {
          setContactChecking(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.contactNumber, isContactValid]);

  // ===========================
  // LEGAL MODAL
  // ===========================

  const openLegalModal = (type) => setLegalModal(type);
  const closeLegalModal = () => setLegalModal(null);

  // ===========================
  // OTP HANDLERS
  // ===========================

  const formatOtpCooldown = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    if (total >= 3600) {
      const hours = Math.floor(total / 3600);
      const mins = Math.floor((total % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (total >= 60) {
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${total}s`;
  };

  const handleSendOtp = async () => {
    if (otpSending || otpCooldown > 0 || isContactBlocked || contactChecking) return;
    const contactNumber = String(form.contactNumber || '').trim();
    if (!/^0\d{10}$/.test(contactNumber)) {
      setFieldErrors((prev) => ({ ...prev, contactNumber: 'Contact number must be 11 digits.' }));
      setOtpStatus({ type: 'error', message: 'Please enter a valid contact number before requesting an OTP.' });
      return;
    }

    if (contactUnavailable) {
      setOtpStatus({ type: 'error', message: contactUnavailable });
      return;
    }

    setOtpSending(true);
    setOtpStatus(null);
    try {
      const response = await fetch('/api/sms/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactNumber, purpose: 'signup' }),
      });
      const { data, error, retryAfterSeconds } = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfter = Number(retryAfterSeconds || data?.retryAfterSeconds || 0);
        if (retryAfter > 0) {
          setOtpCooldown(retryAfter);
        }
        const message = error || 'Failed to send OTP. Please try again.';
        if (response.status === 409) {
          setContactUnavailable(message);
          setFieldErrors((prev) => ({ ...prev, contactNumber: message }));
          resetOtpState();
        }
        setOtpStatus({ type: 'error', message });
        return;
      }

      setOtpVerified(false);
      setOtpVerifiedContact('');
      setOtpExpiresAt(data?.expiresAt || null);

      const sendsRemaining = Number(data?.sendsRemaining);
      const lockoutMinutes = Number(data?.lockoutMinutes || 15);
      if (Number.isFinite(sendsRemaining) && sendsRemaining <= 0) {
        setOtpCooldown(lockoutMinutes * 60);
      } else {
        setOtpCooldown(Number(data?.retryAfterSeconds || 0) || 0);
      }

      setOtpStatus({ type: 'success', message: 'OTP sent. Please check your phone.' });
    } catch (err) {
      setOtpStatus({
        type: 'error',
        message: err?.message || 'Failed to send OTP. Please try again.',
      });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpVerifying) return;
    const contactNumber = String(form.contactNumber || '').trim();
    if (!/^0\d{10}$/.test(contactNumber)) {
      setFieldErrors((prev) => ({ ...prev, contactNumber: 'Contact number must be 11 digits.' }));
      setOtpStatus({ type: 'error', message: 'Please enter a valid contact number before verifying.' });
      return;
    }

    const code = String(otpCode || '').replace(/\D/g, '').slice(0, 6);
    if (code.length < 6) {
      setOtpStatus({ type: 'error', message: 'Please enter the 6-digit OTP.' });
      return;
    }

    setOtpVerifying(true);
    setOtpStatus(null);
    try {
      const response = await fetch('/api/sms/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactNumber, otp: code, purpose: 'signup' }),
      });
      const { data, error } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setOtpVerified(false);
        setOtpStatus({ type: 'error', message: error || 'OTP verification failed.' });
        return;
      }

      if (data?.verified) {
        setOtpVerified(true);
        setOtpVerifiedContact(contactNumber);
        setOtpStatus({ type: 'success', message: 'Contact number verified successfully.' });
      } else {
        setOtpVerified(false);
        setOtpStatus({ type: 'error', message: 'OTP verification failed.' });
      }
    } catch (err) {
      setOtpStatus({
        type: 'error',
        message: err?.message || 'OTP verification failed.',
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  const getIdentityUploadReference = () => {
    const contactNumber = String(form.contactNumber || '').trim();
    if (contactNumber) return contactNumber;
    if (!identityUploadRef.current) {
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      identityUploadRef.current = `signup-${randomPart}`;
    }
    return identityUploadRef.current;
  };

  const uploadIdentityFile = async (file, documentType) => {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('contactNumber', getIdentityUploadReference());
    uploadForm.append('documentType', documentType);

    const uploadResponse = await fetch('/api/account-requests/upload-valid-id', {
      method: 'POST',
      body: uploadForm,
    });
    const uploadJson = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(uploadJson.error || 'Identity document upload failed.');
    }
    const path = uploadJson?.data?.path || null;
    if (!path) throw new Error('Identity document upload failed.');
    return path;
  };

  const handleVerifyIdentity = async (capturedSelfieFile = null) => {
    if (identityVerifying) return { ok: false };
    const selfieFile = capturedSelfieFile || selfieFiles[0];
    setValidIdError('');
    setFaceVerification(null);

    if (!validIdFrontFiles.length || !validIdBackFiles.length) {
      setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
      setStatus({ type: 'error', message: VALID_ID_BOTH_SIDES_ERROR });
      return { ok: false };
    }
    if (!selfieFile) {
      const msg = 'Please capture a live selfie to verify your identity.';
      setValidIdError(msg);
      setStatus({ type: 'error', message: msg });
      return { ok: false };
    }

    setIdentityVerifying(true);
    try {
      const verification = await verifyFaceMatchWithFaceApi({
        validIdFrontImage: validIdFrontFiles[0],
        selfieImage: selfieFile,
      });
      setFaceVerification(verification);
      if (verification.status !== 'passed') {
        const msg = verification.error || FACE_VERIFICATION_FAILED_ERROR;
        setValidIdError(msg);
        setStatus({ type: 'error', message: msg });
        return { ok: false, verification };
      }

      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadIdentityFile(validIdFrontFiles[0], 'validIdFront'),
        uploadIdentityFile(validIdBackFiles[0], 'validIdBack'),
        uploadIdentityFile(selfieFile, 'selfie'),
      ]);
      const urls = { front: frontUrl, back: backUrl, selfie: selfieUrl };
      setIdentityUrls(urls);
      setStatus({ type: 'success', message: 'Face match verified.' });
      return { ok: true, urls, verification };
    } catch (error) {
      const message = error?.message || FACE_VERIFICATION_FAILED_ERROR;
      setValidIdError(message);
      setStatus({ type: 'error', message });
      return { ok: false };
    } finally {
      setIdentityVerifying(false);
    }
  };

  const handleLiveSelfieCapture = (file) => {
    setSelfieFiles([file]);
    handleVerifyIdentity(file);
  };

  // ===========================
  // STEP VALIDATION
  // ===========================

  const validateStep = (step) => {
    setStatus(null);
    setValidIdError('');

    switch (step) {
      case 1: {
        if (!hasSectorSelected) {
          setStatus({ type: 'error', message: 'Please select a sector classification to continue.' });
          return false;
        }
        if (form.secondarySector && form.secondarySector === form.primarySector) {
          showValidationError('Secondary Sector must be different from Primary Sector.');
          return false;
        }
        if (form.secondarySector && !getSecondarySectorOptions(form.primarySector).some((option) => option.value === form.secondarySector)) {
          showValidationError('Please select a valid Secondary Sector or choose No secondary sector.');
          return false;
        }
        return true;
      }
      case 2: {
        if (!form.firstName.trim()) {
          setStatus({ type: 'error', message: 'Please enter your first name.' });
          return false;
        }
        if (!form.lastName.trim()) {
          setStatus({ type: 'error', message: 'Please enter your last name.' });
          return false;
        }
        if (!form.birthday) {
          setStatus({ type: 'error', message: 'Please enter your birthday.' });
          return false;
        }
        const birthdayError = getBirthdayValidationError(form.birthday);
        if (birthdayError) {
          showValidationError(birthdayError);
          return false;
        }
        const age = calculateAge(form.birthday);
        if (!form.birthplace.trim()) {
          setStatus({ type: 'error', message: 'Please enter your birthplace.' });
          return false;
        }
        if (!form.sex) {
          setStatus({ type: 'error', message: 'Please select your sex.' });
          return false;
        }
        if (!form.civilStatus) {
          setStatus({ type: 'error', message: 'Please select your civil status.' });
          return false;
        }
        const eligibilityError = getPersonalEligibilityError(age);
        if (eligibilityError) {
          showValidationError(eligibilityError);
          return false;
        }
        if (requiresRepresentative) {
          const repContact = String(form.representativeContact || '').trim();
          if (
            !form.representativeName.trim() ||
            !repContact ||
            repContact.length !== 11 ||
            !form.representativeRelationship.trim()
          ) {
            showValidationError(MINOR_PWD_REPRESENTATIVE_ERROR);
            return false;
          }
        } else if (hasRepresentativeInfo) {
          const repContact = String(form.representativeContact || '').trim();
          if (
            !form.representativeName.trim() ||
            !repContact ||
            repContact.length !== 11 ||
            !form.representativeRelationship.trim()
          ) {
            showValidationError(REPRESENTATIVE_PARTIAL_ERROR);
            return false;
          }
        } else if (form.representativeContact && String(form.representativeContact).trim().length !== 11) {
          showValidationError('Guardian/Representative contact number must be exactly 11 digits.');
          return false;
        }
        return true;
      }
      case 3: {
        if (!form.houseNo.trim()) {
          setStatus({ type: 'error', message: 'Please enter your house number.' });
          return false;
        }
        if (!form.purok) {
          setStatus({ type: 'error', message: 'Please select your purok.' });
          return false;
        }
        return true;
      }
      case 4: {
        if (!validIdFrontFiles.length || !validIdBackFiles.length) {
          setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
          setStatus({ type: 'error', message: VALID_ID_BOTH_SIDES_ERROR });
          return false;
        }
        if (!selfieFiles.length) {
          const msg = 'Selfie/face capture is required.';
          setValidIdError(msg);
          setStatus({ type: 'error', message: msg });
          return false;
        }
        if (faceVerification?.status !== 'passed') {
          setValidIdError(FACE_VERIFICATION_FAILED_ERROR);
          setStatus({ type: 'error', message: FACE_VERIFICATION_FAILED_ERROR });
          return false;
        }
        if (requiresRepresentative && representativeValidIdFiles.length === 0) {
          setRepresentativeValidIdError(MINOR_PWD_REPRESENTATIVE_ERROR);
          setStatus({ type: 'error', message: MINOR_PWD_REPRESENTATIVE_ERROR });
          return false;
        }
        return true;
      }
      case 5: {
        const cn = String(form.contactNumber || '').trim();
        if (!/^0\d{10}$/.test(cn)) {
          setFieldErrors((prev) => ({ ...prev, contactNumber: 'Contact number must be 11 digits starting with 0.' }));
          setStatus({ type: 'error', message: 'Please enter a valid Philippine contact number.' });
          return false;
        }
        if (!form.password || form.password.length < 8) {
          setStatus({ type: 'error', message: 'Password must be at least 8 characters long.' });
          return false;
        }
        if (form.password !== form.confirmPassword) {
          setStatus({ type: 'error', message: 'Passwords do not match.' });
          return false;
        }
        if (contactUnavailable) {
          setFieldErrors((prev) => ({ ...prev, contactNumber: contactUnavailable }));
          setStatus({ type: 'error', message: contactUnavailable });
          return false;
        }
        if (!isOtpVerified) {
          setStatus({ type: 'error', message: 'Please verify your contact number via SMS OTP before continuing.' });
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const canContinueCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return hasSectorSelected;
      case 2:
        return hasStep2RequiredFields();
      case 3:
        return !!form.houseNo.trim() && !!form.purok;
      case 4:
        return (
          validIdFrontFiles.length > 0 &&
          validIdBackFiles.length > 0 &&
          selfieFiles.length > 0 &&
          faceVerification?.status === 'passed' &&
          (!requiresRepresentative || representativeValidIdFiles.length > 0)
        );
      case 5: {
        const cn = String(form.contactNumber || '').trim();
        return (
          /^0\d{10}$/.test(cn) &&
          !!form.password &&
          form.password.length >= 8 &&
          form.password === form.confirmPassword &&
          !contactUnavailable &&
          isOtpVerified
        );
      }
      default:
        return true;
    }
  };

  // ===========================
  // STEP NAVIGATION
  // ===========================

  const goToStep = (step) => {
    if (step === currentStep) return;
    setStatus(null);
    setSlideDirection(step > currentStep ? 'next' : 'prev');
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setSlideDirection('next');
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    setStatus(null);
    setSlideDirection('prev');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepClick = (stepNumber) => {
    if (stepNumber < currentStep) {
      goToStep(stepNumber);
    }
  };

  // ===========================
  // FORM SUBMISSION
  // ===========================

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (currentStep < TOTAL_STEPS) {
      goNext();
    } else {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setStatus(null);
    setFieldErrors({ contactNumber: '' });

    for (let step = 1; step < TOTAL_STEPS; step += 1) {
      if (!validateStep(step)) {
        setSlideDirection(step > currentStep ? 'next' : 'prev');
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (!hasAgreed) {
      setStatus({
        type: 'error',
        message: 'Please agree to the Data Privacy Notice and Terms & Conditions before submitting.',
      });
      return;
    }
    if (!isOtpVerified) {
      setStatus({
        type: 'error',
        message: 'Please verify your contact number via SMS OTP before submitting.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const ageValue = calculateAge(form.birthday);

      let verifiedIdentityUrls = identityUrls;
      let verifiedFace = faceVerification;
      let representativeValidIdPath = '';

      if (
        !verifiedIdentityUrls.front ||
        !verifiedIdentityUrls.back ||
        !verifiedIdentityUrls.selfie ||
        verifiedFace?.status !== 'passed'
      ) {
        const verified = await handleVerifyIdentity();
        if (!verified?.ok) return;
        verifiedIdentityUrls = verified.urls;
        verifiedFace = verified.verification;
      }

      if (representativeValidIdFiles.length > 0) {
        const uploadForm = new FormData();
        uploadForm.append('file', representativeValidIdFiles[0]);
        uploadForm.append('contactNumber', form.contactNumber);
        uploadForm.append('documentType', 'representativeValidId');

        const uploadResponse = await fetch('/api/account-requests/upload-valid-id', {
          method: 'POST',
          body: uploadForm,
        });

        const uploadJson = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
          const msg = uploadJson.error || 'Representative valid ID upload failed.';
          setRepresentativeValidIdError(msg);
          setStatus({ type: 'error', message: msg });
          return;
        }

        representativeValidIdPath = uploadJson?.data?.path || '';
        if (!representativeValidIdPath) {
          const msg = 'Representative valid ID upload failed.';
          setRepresentativeValidIdError(msg);
          setStatus({ type: 'error', message: msg });
          return;
        }
      }

      if (requiresRepresentative && !representativeValidIdPath) {
        setRepresentativeValidIdError(MINOR_PWD_REPRESENTATIVE_ERROR);
        setStatus({ type: 'error', message: MINOR_PWD_REPRESENTATIVE_ERROR });
        return;
      }

      // Submit account request
      const response = await fetch('/api/account-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          birthday: form.birthday,
          contactNumber: form.contactNumber,
          password: form.password,
          primarySector: form.primarySector,
          secondarySector: form.secondarySector,
          isPwd: form.isPwd,
          isSeniorCitizen: form.isSeniorCitizen,
          isSoloParent: form.isSoloParent,
          representativeName: form.representativeName,
          representativeContact: form.representativeContact,
          representativeRelationship: form.representativeRelationship,
          representativeValidIdUrl: representativeValidIdPath || null,
          age: ageValue !== '' ? Number(ageValue) : null,
          birthplace: form.birthplace,
          sex: form.sex,
          citizenship: form.citizenship,
          civilStatus: form.civilStatus,
          validIdUrl: verifiedIdentityUrls.front || null,
          validIdUrls: [verifiedIdentityUrls.front, verifiedIdentityUrls.back].filter(Boolean),
          validIdFrontUrl: verifiedIdentityUrls.front,
          validIdBackUrl: verifiedIdentityUrls.back,
          selfieUrl: verifiedIdentityUrls.selfie,
          faceVerificationStatus: verifiedFace?.status,
          faceVerificationScore: verifiedFace?.score ?? null,
          faceVerificationProvider: verifiedFace?.provider || null,
          faceVerifiedAt: verifiedFace?.verifiedAt || null,
          faceVerificationError: verifiedFace?.error || null,
          faceVerificationDiagnostics: verifiedFace?.diagnostics || null,
          houseNo: form.houseNo,
          purok: form.purok,
          barangay: form.barangay,
          city: form.city,
        }),
      });

      const { data, error, message } = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = error || message || 'Failed to submit sign-up request.';
        if (String(msg).toLowerCase().includes('contact number')) {
          setFieldErrors((prev) => ({ ...prev, contactNumber: msg }));
        }
        setStatus({ type: 'error', message: msg });
        return;
      }

      setStatus({
        type: 'success',
        message:
          message ||
          'PENDING APPROVAL: Your sign-up request has been submitted successfully! Please wait for admin approval before you can log in.',
      });
      setToast({
        open: true,
        message: 'Your account request is currently on process.',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      // Avoid triggering Next.js dev overlay for expected UI errors.
      console.warn('Failed to submit beneficiary sign-up:', err?.message || String(err));
      setStatus({
        type: 'error',
        message: err?.message || 'Something went wrong while submitting your sign-up. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // ===========================
  // RENDER: PROGRESS BAR
  // ===========================

  const renderProgressBar = () => (
    <div className={styles.progressBarWrapper}>
      <div className={styles.progressSummaryLine}>
        <span>Step {currentStep} of {TOTAL_STEPS}</span>
        <strong>{progressPercent}% complete</strong>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <div className={styles.progressBarScroll}>
        <div className={styles.progressBar} aria-label="Registration progress">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className={`${styles.progressStep} ${
                step.number < currentStep ? styles.progressStepClickable : ''
              } ${step.number === currentStep ? styles.progressStepActive : ''}`}
              onClick={() => handleStepClick(step.number)}
              role={step.number < currentStep ? 'button' : undefined}
              tabIndex={step.number < currentStep ? 0 : undefined}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && step.number < currentStep) {
                  e.preventDefault();
                  handleStepClick(step.number);
                }
              }}
            >
              <div
                className={`${styles.progressCircle} ${
                  step.number === currentStep ? styles.activeCircle : ''
                } ${step.number < currentStep ? styles.completedCircle : ''}`}
              >
                {step.number < currentStep ? <CheckIcon /> : step.number}
              </div>
              <span
                className={`${styles.progressLabel} ${
                  step.number <= currentStep ? styles.activeLabel : ''
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ===========================
  // RENDER: STEPS
  // ===========================

  const renderStep1 = () => (
    <section className={styles.section} aria-labelledby="sector-heading">
      <SectionHeader
        id="sector-heading"
        title="Beneficiary Type"
        subtitle="Choose the primary sector that best describes the beneficiary."
      />
      <div className={styles.sectorRow}>
        <span className={styles.sectorLabel}>Primary sector</span>
        <div className={styles.sectorChips} role="radiogroup" aria-label="Primary sector">
          {BENEFICIARY_SECTOR_OPTIONS.map((option) => {
            const detail = sectorCardDetails[option.value] || {
              title: option.label,
              description: 'Select this beneficiary classification.',
              mark: option.label.slice(0, 2),
            };
            const selected = form.primarySector === option.value;
            return (
              <label
                key={option.value}
                className={`${styles.sectorChip} ${selected ? styles.sectorChipActive : ''}`}
              >
                <input
                  type="radio"
                  name="primarySector"
                  value={option.value}
                  checked={selected}
                  onChange={handleSectorSelectChange}
                />
                <span className={styles.sectorMark}>{selected ? <CheckIcon /> : detail.mark}</span>
                <span className={styles.sectorText}>
                  <span className={styles.sectorTitle}>{detail.title}</span>
                  <span className={styles.sectorDescription}>{detail.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {hasSectorSelected && (
          <Select
            label="Secondary Sector"
            name="secondarySector"
            value={form.secondarySector}
            onChange={handleSectorSelectChange}
            options={getSecondarySectorOptions(form.primarySector)}
            placeholder="No secondary sector"
            allowEmptyOption
          />
        )}
        <p className={styles.sectorHelper}>Secondary sector is optional and appears after choosing a primary sector.</p>
      </div>
    </section>
  );

  const renderStep2 = () => (
    <section className={styles.section} aria-labelledby="personal-heading">
      <SectionHeader
        id="personal-heading"
        title="Personal Information"
        subtitle="We use these details to correctly identify you as a beneficiary."
      />
      <div className={`${styles.formGrid} ${styles.personalGrid}`}>
        <Input
          label="First Name"
          name="firstName"
          value={form.firstName}
          onChange={handleChange}
          required
        />
        <Input
          label="Middle Name"
          name="middleName"
          value={form.middleName}
          onChange={handleChange}
          optional
        />
        <Input
          label="Last Name"
          name="lastName"
          value={form.lastName}
          onChange={handleChange}
          required
        />
        <Input
          label="Birthday"
          type="date"
          name="birthday"
          value={form.birthday}
          onChange={handleChange}
          min={MIN_BIRTHDATE}
          max={getTodayIso()}
          required
        />
        <Input
          label="Age"
          type="text"
          value={calculateAge(form.birthday) || ''}
          placeholder="Auto"
          disabled
          readOnly
        />
        <Input
          label="Birthplace"
          name="birthplace"
          value={form.birthplace}
          onChange={handleChange}
          required
        />
        <Select
          label="Sex"
          name="sex"
          value={form.sex}
          onChange={handleChange}
          options={sexOptions}
          placeholder="Select sex"
          required
        />
        <Input
          label="Citizenship"
          name="citizenship"
          value={form.citizenship}
          onChange={handleChange}
          readOnly
          disabled
          required
        />
        <Select
          label="Civil Status"
          name="civilStatus"
          value={form.civilStatus}
          onChange={handleChange}
          options={getCivilStatusOptions(form.isSoloParent, ageValue !== '' && Number(ageValue) < 18)}
          placeholder="Select civil status"
          required
        />
        <Input
          label="Guardian/Representative Full Name"
          name="representativeName"
          value={form.representativeName}
          onChange={handleChange}
          placeholder="Enter guardian or representative name"
          required={requiresRepresentative}
          optional={!requiresRepresentative}
        />
        <Input
          label="Guardian/Representative Contact Number"
          type="tel"
          name="representativeContact"
          value={form.representativeContact}
          onChange={handleChange}
          placeholder="+63 XXX XXX XXXX"
          mask="ph-contact"
          required={requiresRepresentative}
          optional={!requiresRepresentative}
        />
        <Input
          label="Relationship to Beneficiary"
          name="representativeRelationship"
          value={form.representativeRelationship}
          onChange={handleChange}
          placeholder="Parent, guardian, sibling, etc."
          required={requiresRepresentative}
          optional={!requiresRepresentative}
        />
      </div>
    </section>
  );

  const renderStep3 = () => (
    <section className={styles.section} aria-labelledby="address-heading">
      <SectionHeader
        id="address-heading"
        title="Address Information"
        subtitle="Your address helps us verify your eligibility within the barangay."
      />
      <div className={`${styles.formGrid} ${styles.addressGrid}`}>
        <Input
          label="House Number"
          name="houseNo"
          value={form.houseNo}
          onChange={handleChange}
          required
        />
        <Select
          label="Purok"
          name="purok"
          value={form.purok}
          onChange={handleChange}
          options={purokOptions}
          placeholder="Select purok"
          required
        />
        <Input
          label="Barangay"
          name="barangay"
          value={form.barangay}
          readOnly
          disabled
          required
        />
        <Input
          label="City / Municipality"
          name="city"
          value={form.city}
          readOnly
          disabled
          required
        />
      </div>
    </section>
  );

  const renderOtpSection = () => (
    <div className={styles.otpSection}>
      <SectionHeader
        id="otp-heading"
        title="SMS Verification"
        subtitle="Verify your contact number before continuing."
      />
      <div className={styles.otpGrid}>
        <div className={`${styles.otpRow} ${styles.otpRowHint}`}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendOtp}
            disabled={
              otpSending ||
              otpCooldown > 0 ||
              !isContactValid ||
              isContactBlocked ||
              contactChecking ||
              isOtpVerified
            }
            size="compact"
          >
            {otpCooldown > 0
              ? `Resend in ${formatOtpCooldown(otpCooldown)}`
              : otpSending
                ? 'Sending OTP...'
                : 'Send OTP'}
          </Button>
          <span className={styles.otpHint}>
            {contactChecking
              ? 'Checking if this contact number is available...'
              : isContactBlocked
                ? contactUnavailable
                : "We'll send a 6-digit verification code to your contact number. You can request up to 2 codes, then wait 15 minutes before trying again."}
          </span>
        </div>
        <div className={`${styles.otpRow} ${styles.otpRowVerify}`}>
          <div className={styles.otpInputWrap}>
            <Input
              label="OTP Code"
              name="otpCode"
              value={otpCode}
              onChange={(event) =>
                setOtpCode(String(event.target.value || '').replace(/\D/g, '').slice(0, 6))
              }
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              required
              size="compact"
            />
          </div>
          <Button
            type="button"
            onClick={handleVerifyOtp}
            disabled={otpVerifying || otpCode.length < 6}
            size="compact"
          >
            {otpVerifying ? 'Verifying...' : 'Verify OTP'}
          </Button>
        </div>
        {otpStatus && (
          <p
            className={`${styles.otpStatus} ${
              otpStatus.type === 'success' ? styles.otpStatusSuccess : styles.otpStatusError
            }`}
          >
            {otpStatus.message}
          </p>
        )}
        {isOtpVerified && (
          <div className={styles.otpVerified}>
            <span className={styles.otpVerifiedDot} aria-hidden="true" />
            Contact number verified
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <section className={`${styles.section} ${styles.accountSection}`} aria-labelledby="account-heading">
      <SectionHeader
        id="account-heading"
        title="Account Setup"
        subtitle="Set up your contact number and password to secure your account."
      />
      <div className={`${styles.formGrid} ${styles.accountGrid}`}>
        <div className={styles.accountContactRow}>
          <Input
            label="Contact Number"
            type="tel"
            name="contactNumber"
            value={form.contactNumber}
            onChange={handleChange}
            placeholder="+63 XXX XXX XXXX"
            mask="ph-contact"
            error={fieldErrors.contactNumber}
            required
            size="compact"
            className={styles.contactField}
          />
        </div>
        <Input
          label="Password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="At least 8 characters"
          minLength={8}
          required
          size="compact"
          className={styles.passwordField}
        />
        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter your password"
          minLength={8}
          required
          size="compact"
          className={styles.passwordField}
        />
      </div>
      {renderOtpSection()}
    </section>
  );

  const renderStep5 = () => (
    <section className={styles.section} aria-labelledby="upload-heading">
      <SectionHeader
        id="upload-heading"
        title="Identity Verification"
        subtitle="Upload both sides of your valid ID and complete face capture."
      />
      <div className={styles.validIdGuide}>
        <div>
          <h4 className={styles.validIdGuideTitle}>Examples of valid IDs in the Philippines</h4>
          <p className={styles.validIdGuideText}>
            Upload a clear government-issued ID that matches the beneficiary information. For ALAGA
            registration, sector IDs are preferred when available.
          </p>
        </div>
        <div className={styles.validIdExampleGrid}>
          {validIdExamples.map((group) => (
            <div key={group.title} className={styles.validIdExampleGroup}>
              <span className={styles.validIdExampleTitle}>{group.title}</span>
              <ul className={styles.validIdExampleList}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className={styles.validIdGuideNote}>
          Make sure the name and photo are readable. Upload the front and back side when the ID has
          details on both sides.
        </p>
      </div>
      <div className={styles.validIdRow}>
        <FileUpload
          label="Front of Valid ID"
          documentType="validIdImage"
          multiple={false}
          files={validIdFrontFiles}
          onChange={handleValidIdFrontChange}
          required
        />
      </div>
      <div className={styles.validIdRow}>
        <FileUpload
          label="Back of Valid ID"
          documentType="validIdImage"
          multiple={false}
          files={validIdBackFiles}
          onChange={handleValidIdBackChange}
          required
        />
      </div>
      {hasUploadedIdentityImages && (
        <FaceRecognitionCapture
          onCapture={handleLiveSelfieCapture}
          disabled={identityVerifying}
          verifying={identityVerifying}
          status={faceVerification?.status || ''}
          error={validIdError}
        />
      )}
      {!hasUploadedIdentityImages && validIdError && <p className={styles.fieldError}>{validIdError}</p>}
      {shouldShowRepresentativeId && (
        <div className={styles.validIdRow}>
          <FileUpload
            label="Guardian/Representative Valid ID"
            documentType="validId"
            multiple={false}
            files={representativeValidIdFiles}
            onChange={handleRepresentativeValidIdChange}
            required={requiresRepresentative}
          />
          {representativeValidIdError && <p className={styles.fieldError}>{representativeValidIdError}</p>}
        </div>
      )}
    </section>
  );

  const renderReviewStep = () => {
    const age = calculateAge(form.birthday);

    return (
      <section className={styles.section} aria-labelledby="review-heading">
        <SectionHeader
          id="review-heading"
          title="Review & Consent"
          subtitle="Please review your information carefully before submitting."
        />

        <div className={styles.reviewCard}>
          {/* Beneficiary Type */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Beneficiary Type</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(1)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Sector</span>
                <span className={styles.reviewValue}>{getSectorName()}</span>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Personal Information</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(2)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={`${styles.reviewItem} ${styles.reviewItemFull}`}>
                <span className={styles.reviewLabel}>Full Name</span>
                <span className={styles.reviewValue}>{getFullName()}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Birthday</span>
                <span className={styles.reviewValue}>{formatBirthday(form.birthday)}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Age</span>
                <span className={styles.reviewValue}>{age !== '' ? age : '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Birthplace</span>
                <span className={styles.reviewValue}>{form.birthplace || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Sex</span>
                <span className={styles.reviewValue}>{getSexDisplay()}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Citizenship</span>
                <span className={styles.reviewValue}>{form.citizenship || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Civil Status</span>
                <span className={styles.reviewValue}>{getCivilStatusDisplay()}</span>
              </div>
            </div>
          </div>

          {/* Guardian / Representative */}
          {shouldShowRepresentativeId && (
            <div className={styles.reviewGroup}>
              <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Guardian / Representative</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(2)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={`${styles.reviewItem} ${styles.reviewItemFull}`}>
                <span className={styles.reviewLabel}>Full Name</span>
                <span className={styles.reviewValue}>{form.representativeName || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Contact Number</span>
                <span className={styles.reviewValue}>
                  {form.representativeContact ? formatContactForDisplay(form.representativeContact) : '—'}
                </span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Relationship</span>
                <span className={styles.reviewValue}>{form.representativeRelationship || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Representative ID</span>
                <span className={styles.reviewValue}>
                  {representativeValidIdFiles.length ? representativeValidIdFiles[0]?.name : '—'}
                </span>
              </div>
            </div>
            </div>
          )}

          {/* Address */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Address</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(3)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>House Number</span>
                <span className={styles.reviewValue}>{form.houseNo || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Purok</span>
                <span className={styles.reviewValue}>{form.purok || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Barangay</span>
                <span className={styles.reviewValue}>{form.barangay}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>City / Municipality</span>
                <span className={styles.reviewValue}>{form.city}</span>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Account Information</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(5)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Contact Number</span>
                <div className={styles.reviewContactRow}>
                  <span className={styles.reviewValue}>
                    {formatContactForDisplay(form.contactNumber)}
                  </span>
                  {isOtpVerified && (
                    <span className={styles.verifiedBadge}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Password</span>
                <span className={`${styles.reviewValue} ${styles.passwordDots}`}>••••••••</span>
              </div>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Uploaded Documents</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(4)}>
                Edit
              </button>
            </div>
            <div className={styles.reviewFileList}>
              {[
                ['Front ID', validIdFrontFiles[0]?.name],
                ['Back ID', validIdBackFiles[0]?.name],
                ['Selfie', selfieFiles[0]?.name],
              ].map(([label, name]) => (
                <span key={label} className={styles.reviewFileBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {label}: {name || 'Missing'}
                </span>
              ))}
              <span className={styles.reviewFileBadge}>
                {faceVerification?.status === 'passed' ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Face Match Passed
                  </>
                ) : (
                  'Face Match Pending'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <p className={styles.helperTextReview}>
          By submitting this form, you confirm that the information you provided is true and correct
          to the best of your knowledge. The information provided during sign-up will be
          automatically reflected in your Beneficiary Profile.
        </p>

        {/* Legal Consent */}
        <div className={styles.legalConsent}>
          <input
            type="checkbox"
            id="signupLegalConsent"
            checked={hasAgreed}
            onChange={(event) => setHasAgreed(event.target.checked)}
            required
          />
          <label htmlFor="signupLegalConsent" className={styles.legalConsentLabel}>
            I agree to the{' '}
            <button
              type="button"
              className={styles.legalInlineLink}
              onClick={() => openLegalModal('privacy')}
            >
              Data Privacy Notice
            </button>{' '}
            and{' '}
            <button
              type="button"
              className={styles.legalInlineLink}
              onClick={() => openLegalModal('terms')}
            >
              Terms &amp; Conditions
            </button>
            .
          </label>
        </div>
      </section>
    );
  };

  const renderInfoPanel = () => (
    <div className={styles.infoPanel} aria-label="Registration reminders">
      {signupRequirements.map(([label, value]) => (
        <div key={label} className={styles.infoItem}>
          <span className={styles.infoIcon} aria-hidden="true">
            <CheckIcon />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{value}</small>
          </span>
        </div>
      ))}
    </div>
  );

  const renderSummaryPanel = () => (
    <aside className={styles.summaryCard} aria-label="Registration summary">
      <p className={styles.summaryKicker}>Registration summary</p>
      <h2 className={styles.summaryTitle}>{currentStepLabel}</h2>
      <div className={styles.summaryProgressRing} style={{ '--summary-progress': `${progressPercent}%` }}>
        <span>{progressPercent}%</span>
      </div>
      <div className={styles.summaryStats}>
        <div>
          <span>Current step</span>
          <strong>{currentStep} of {TOTAL_STEPS}</strong>
        </div>
        <div>
          <span>Remaining steps</span>
          <strong>{remainingSteps}</strong>
        </div>
        <div>
          <span>Estimated remaining time</span>
          <strong>{estimatedRemainingMinutes} min</strong>
        </div>
      </div>
      <ol className={styles.summarySteps}>
        {STEPS.map((step) => (
          <li
            key={step.number}
            className={`${step.number < currentStep ? styles.summaryStepDone : ''} ${
              step.number === currentStep ? styles.summaryStepActive : ''
            }`}
          >
            <span>{step.number < currentStep ? <CheckIcon /> : step.number}</span>
            {step.label}
          </li>
        ))}
      </ol>
      <div className={styles.summaryClock} aria-live="polite">
        <span className={styles.summaryClockLabel}>Philippine Standard Time</span>
        <span>{currentPhilippinesDateLabel}</span>
        <strong>{currentPhilippinesTimeLabel}</strong>
      </div>
    </aside>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep5();
      case 5: return renderStep4();
      case 6: return renderReviewStep();
      default: return null;
    }
  };

  // ===========================
  // MAIN RENDER
  // ===========================

  const continueDisabled = currentStep < TOTAL_STEPS && !canContinueCurrentStep();

  return (
    <div className={styles.signupShell}>
      <ConstellationBackground className={styles.signupConstellation} />
      <div className={styles.signupPage}>
      {toast.open && (
        <div
          className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : ''}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <section className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>Barangay Sta. Rita</div>
          <h1 className={styles.heroTitle}>ALAGA Program Beneficiary Registration</h1>
          <p className={styles.heroSubtitle}>
            Complete the online registration form for PWD, senior citizen, or solo parent assistance.
          </p>
          <div className={styles.heroMeta} aria-label="Signup requirements">
            <span className={styles.heroPill}>Estimated time: 5-10 minutes</span>
            <span className={styles.heroPill}>Step {currentStep} of {TOTAL_STEPS}</span>
          </div>
        </div>
        <div className={styles.heroAside} aria-label="Application progress">
          <span className={styles.heroAsideLabel}>Current step</span>
          <strong>{currentStepLabel}</strong>
        </div>
      </section>

      <div className={styles.registrationLayout}>
        <main className={styles.registrationMain}>
          <Card className={styles.formCard}>
            <div className={styles.cardTopper}>
              <div>
                <p className={styles.cardKicker}>Online application</p>
                <h2 className={styles.cardTitle}>{currentStepLabel}</h2>
              </div>
              <span className={styles.saveNote}>{progressPercent}% complete</span>
            </div>
            {renderInfoPanel()}

            {/* Progress Bar */}
            {renderProgressBar()}

            {/* Status Banner */}
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

            {/* Form */}
            <form onSubmit={handleFormSubmit} className={styles.form}>
          {/* Step Content */}
          <div ref={stepContainerRef} className={styles.stepContainer} tabIndex={-1}>
            <div
              key={currentStep}
              className={`${styles.stepContent} ${
                slideDirection === 'next' ? styles.slideInNext : styles.slideInPrev
              }`}
            >
              {renderCurrentStep()}
            </div>
          </div>

          {/* Navigation */}
          <div className={styles.navRow}>
            {currentStep === 1 ? (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={goPrev}>
                Back
              </Button>
            )}
            <div className={styles.navSpacer} />
            {currentStep < TOTAL_STEPS ? (
              <Button type="button" onClick={goNext} disabled={continueDisabled}>
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting || !hasAgreed || !isOtpVerified}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Registration'}
              </Button>
            )}
          </div>
            </form>
          </Card>
        </main>

        {renderSummaryPanel()}
      </div>

      <p className={styles.secondaryLinks}>
        Received a resubmit code by SMS?{' '}
        <Link href="/account-requests/resubmit">Resubmit incomplete signup</Link>
      </p>

      {/* Legal Modal */}
      <Modal
        isOpen={!!legalModal}
        onClose={closeLegalModal}
        title={legalModal === 'terms' ? 'Terms and Conditions' : 'Data Privacy Notice'}
        size="large"
        footer={
          <>
            <Button onClick={closeLegalModal}>Close</Button>
          </>
        }
      >
        {legalModal === 'terms' ? (
          <div className={styles.legalContent}>
            <ol className={styles.legalList}>
              <li>
                <span className={styles.legalHeading}>Acceptance and Eligibility</span>
                <p className={styles.legalParagraph}>
                  By creating an account and submitting an application, you agree to these Terms and Conditions.
                </p>
                <p className={styles.legalParagraph}>
                  This program is intended for eligible Barangay Sta. Rita beneficiaries (PWDs, Senior Citizens, and Solo
                  Parents). If the beneficiary is a minor or cannot manage registration, a parent, legal guardian, or duly
                  authorized representative must apply on their behalf.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Truthfulness and Accurate Information</span>
                <ul className={styles.legalSubList}>
                  <li>Provide complete and truthful information and do not impersonate another person</li>
                  <li>Ensure names, birthdate, address, and sector details match your submitted documents</li>
                  <li>Update your details when needed to keep your records correct</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Review, Verification, and Approval</span>
                <p className={styles.legalParagraph}>
                  All registrations are subject to review and approval by authorized barangay personnel before access
                  is granted. Approval may include validation of eligibility and submitted identification documents.
                </p>
                <p className={styles.legalParagraph}>
                  The barangay may require additional documents, conduct interviews, or request in-person verification.
                  Submission does not guarantee approval or release of assistance.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Identity Documents and Face Verification</span>
                <p className={styles.legalParagraph}>
                  Registration may require uploading both sides of a valid ID and a selfie/face capture for identity
                  verification. Face verification may be automatic or may require manual review by authorized personnel.
                </p>
                <p className={styles.legalParagraph}>
                  If face verification fails or documents are unreadable, your application may be delayed, returned for
                  resubmission, or rejected.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Proper Use and Limitations</span>
                <p className={styles.legalParagraph}>
                  The platform is intended for:
                </p>
                <ul className={styles.legalSubList}>
                  <li>Beneficiary registration</li>
                  <li>Assistance request processing</li>
                  <li>Program-related services</li>
                </ul>
                <p className={styles.legalParagraph}>
                  This platform is not for emergencies. For urgent concerns, contact the barangay directly.
                </p>
                <p className={styles.legalParagraph}>
                  Program transactions may be logged for auditing, reporting, and security purposes.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Account Security and Communication</span>
                <p className={styles.legalParagraph}>
                  You are responsible for keeping your login credentials and OTP codes secure. Do not share passwords or
                  verification codes. SMS messages may be used for verification and program updates related to your
                  account.
                </p>
              </li>
            </ol>
            <p className={styles.legalSubHeading}>
              Assisted Registration and Minors
            </p>
            <ol className={styles.legalList} start={7}>
              <li>
                <span className={styles.legalHeading}>Parent/Guardian/Representative Authority</span>
                <ul className={styles.legalSubList}>
                  <li>A parent/legal guardian/authorized representative may register for the beneficiary</li>
                  <li>Proof of authority and the representative’s valid ID may be required</li>
                  <li>The representative must submit the beneficiary’s correct information and documents</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Representative Responsibilities</span>
                <ul className={styles.legalSubList}>
                  <li>Act only in the beneficiary’s best interest</li>
                  <li>Ensure all submissions are accurate, complete, and not misleading</li>
                  <li>Manage communications and requests responsibly</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Consent for Minors and Special Cases</span>
                <ul className={styles.legalSubList}>
                  <li>For minors, consent must be provided by the parent or legal guardian</li>
                  <li>For beneficiaries unable to provide consent, the authorized representative attests lawful authority</li>
                  <li>The beneficiary is informed when reasonably possible</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Misuse, Denial, or Suspension</span>
                <p className={styles.legalParagraph}>
                  Providing false information, submitting fraudulent documents, or using the platform for unauthorized
                  purposes may result in denial, rejection, suspension, or other appropriate action, without prejudice to
                  remedies allowed by law.
                </p>
              </li>
            </ol>
          </div>
        ) : (
          <div className={styles.legalContent}>
            <p className={styles.legalIntro}>
              <strong>Alaga Program – Barangay Sta. Rita</strong>
            </p>
            <p className={styles.legalParagraph}>
              In accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012, this notice
              explains how your personal data is collected, used, stored, and protected by the Alaga Program for the
              administration of barangay assistance and services, including for PWD, Senior Citizen, and Solo Parent
              beneficiaries.
            </p>
            <ol className={styles.legalList}>
              <li>
                <span className={styles.legalHeading}>Collection of Personal Data</span>
                <ul className={styles.legalSubList}>
                  <li>Full name, birthdate, and personal details</li>
                  <li>Contact number, email address (if provided), and address</li>
                  <li>Sector classification and related eligibility information (e.g., PWD, Senior Citizen, Solo Parent)</li>
                  <li>Uploaded identification and supporting documents (e.g., photos/scans of IDs and certificates)</li>
                  <li>Selfie/face capture and face verification results for identity matching</li>
                  <li>Assistance request details, transactions, and service history</li>
                  <li>Representative/guardian details when assisted registration is used (name, relationship, contact details, and ID submitted)</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Purpose of Processing</span>
                <ul className={styles.legalSubList}>
                  <li>Registration and verification of beneficiaries</li>
                  <li>Validation of eligibility for sector-based assistance (PWD/Senior Citizen/Solo Parent)</li>
                  <li>Processing and monitoring of assistance requests</li>
                  <li>Record-keeping and reporting</li>
                  <li>Communication regarding program updates and services</li>
                  <li>Fraud prevention, auditing, and activity logging</li>
                  <li>Generation of beneficiary identifiers (including QR codes) for program transactions</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Lawful Basis</span>
                <p className={styles.legalParagraph}>
                  We process personal data based on consent where required and as necessary for the delivery of public
                  services, eligibility verification, and compliance with applicable laws and regulations.
                </p>
                <p className={styles.legalParagraph}>
                  For minors and assisted registrations, consent must be provided by a parent/legal guardian or lawful
                  representative, as applicable.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Storage and Protection</span>
                <p className={styles.legalParagraph}>
                  Personal data is stored in a secured system and is accessible only to authorized personnel.
                  Reasonable organizational, physical, and technical measures are implemented to help protect your data
                  from unauthorized access, disclosure, or misuse.
                </p>
                <p className={styles.legalParagraph}>
                  Measures may include role-based access controls, authentication, audit/activity logs, and layered
                  security for QR-based identification features. Uploaded documents are stored using secured storage
                  with controlled access.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Sharing</span>
                <p className={styles.legalParagraph}>
                  Personal data may be shared only with authorized barangay personnel or government agencies when
                  necessary for official purposes or when required by law.
                </p>
                <p className={styles.legalParagraph}>
                  We may also use trusted service providers for program operations (such as SMS messaging, document
                  storage, and face verification services), subject to appropriate safeguards.
                </p>
                <p className={styles.legalParagraph}>
                  Uploaded identity documents may be stored using cloud storage services. Storage may involve processing
                  outside your location, with reasonable safeguards applied.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Retention</span>
                <p className={styles.legalParagraph}>
                  Your data will be kept only for as long as necessary for program operations or as required by
                  applicable laws and regulations.
                </p>
                <p className={styles.legalParagraph}>
                  When retention is no longer required, we take reasonable steps to securely delete, anonymize, or
                  dispose of data and uploaded documents.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Your Rights</span>
                <ul className={styles.legalSubList}>
                  <li>Access your personal data</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion or blocking of data when applicable</li>
                  <li>Object to processing or withdraw consent, subject to legal and program requirements</li>
                  <li>Data portability, where applicable</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Offline / Assisted Processing</span>
                <p className={styles.legalParagraph}>
                  For walk-in or assisted registrations, information may be collected offline and later encoded into the
                  system by authorized personnel or coordinators. The same privacy safeguards apply.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Contact Information</span>
                <p className={styles.legalParagraph}>
                  Barangay Sta. Rita Office
                </p>
                <p className={styles.legalParagraph}>
                  Email: <a href="mailto:barangaystarita2023@gmail.com">barangaystarita2023@gmail.com</a>
                </p>
                <p className={styles.legalParagraph}>
                  You may also lodge a complaint with the National Privacy Commission, subject to applicable procedures.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Consent</span>
                <p className={styles.legalParagraph}>
                  By proceeding, you confirm that you have read and understood this Data Privacy Notice and agree to the
                  processing of personal data for the stated purposes. If you are registering on behalf of a beneficiary,
                  you confirm that you are authorized to provide this consent and information.
                </p>
              </li>
            </ol>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}

