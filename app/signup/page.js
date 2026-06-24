'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import FileUpload from '../../components/FileUpload';
import SectionHeader from '@/components/SectionHeader';
import {
  BENEFICIARY_SECTOR_OPTIONS,
  deriveSectorFlags,
  getSecondarySectorOptions,
  getSectorLabel,
} from '@/lib/beneficiarySectors';
import styles from './page.module.css';

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
  { value: 'divorced', label: 'Divorced' },
];

const SOLO_PARENT_MARRIED_ERROR = 'Married civil status is not allowed for Solo Parent classification.';

const getCivilStatusOptions = (isSoloParent) =>
  civilStatusOptions.map((option) => ({
    ...option,
    disabled: isSoloParent && option.value === 'married',
  }));

const STEPS = [
  { number: 1, label: 'Sector' },
  { number: 2, label: 'Personal' },
  { number: 3, label: 'Address' },
  { number: 4, label: 'Account' },
  { number: 5, label: 'Verify ID' },
  { number: 6, label: 'Review' },
];
const TOTAL_STEPS = STEPS.length;
const MINOR_PWD_REPRESENTATIVE_ERROR =
  'Beneficiaries below 18 years old must provide a guardian or representative before registration can be completed.';
const VALID_ID_BOTH_SIDES_ERROR = 'Please upload both the front and back images of your valid ID.';
const FACE_VERIFICATION_FAILED_ERROR =
  'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.';

const signupHighlights = [
  'Barangay Sta. Rita residents',
  'Valid ID required',
  'SMS verification',
];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function SelfieCapture({ files, onChange, disabled = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraError('Camera is unavailable. You can upload a selfie image instead.');
    }
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onChange([file]);
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className={styles.validIdRow}>
      <div className={styles.selfieActions}>
        <Button type="button" variant="secondary" onClick={startCamera} disabled={disabled || cameraActive}>
          Start Camera
        </Button>
        {cameraActive && (
          <>
            <Button type="button" onClick={captureSelfie} disabled={disabled}>
              Capture Selfie
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              Stop
            </Button>
          </>
        )}
      </div>
      {cameraActive && <video ref={videoRef} autoPlay playsInline muted className={styles.selfieVideo} />}
      {cameraError && <p className={styles.fieldError}>{cameraError}</p>}
      <FileUpload
        label="Selfie / Face Capture"
        documentType="selfie"
        multiple={false}
        files={files}
        onChange={onChange}
        required
      />
    </div>
  );
}

export default function BeneficiarySignupPage() {
  const router = useRouter();
  const stepContainerRef = useRef(null);

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [slideDirection, setSlideDirection] = useState('next');

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

  // Computed values
  const hasSectorSelected = !!form.primarySector;
  const isOtpVerified = otpVerified && otpVerifiedContact === form.contactNumber;
  const isContactValid = /^0\d{10}$/.test(String(form.contactNumber || '').trim());
  const isContactBlocked = !!contactUnavailable;

  // ===========================
  // HELPERS
  // ===========================

  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return '';
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const ageValue = calculateAge(form.birthday);
  const requiresRepresentative = ageValue !== '' && Number(ageValue) < 18 && !!form.isPwd;

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

    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleSectorSelectChange = (event) => {
    const { name, value } = event.target;
    if (validIdError) setValidIdError('');
    setForm((prev) => {
      const nextPrimary = name === 'primarySector' ? value : prev.primarySector;
      let nextSecondary = name === 'secondarySector' ? value : prev.secondarySector;
      if (nextPrimary && nextSecondary === nextPrimary) nextSecondary = '';
      const flags = deriveSectorFlags(nextPrimary, nextSecondary);
      const nextIsSoloParent = flags.is_solo_parent;
      return {
        ...prev,
        primarySector: nextPrimary,
        secondarySector: nextSecondary,
        isPwd: flags.is_pwd,
        isSeniorCitizen: flags.is_senior_citizen,
        isSoloParent: flags.is_solo_parent,
        civilStatus:
          nextIsSoloParent && prev.civilStatus === 'married'
            ? ''
            : prev.civilStatus,
      };
    });
  };

  const resetFaceVerification = () => {
    setIdentityUrls({ front: '', back: '', selfie: '' });
    setFaceVerification(null);
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

  const handleSelfieChange = (files) => {
    setSelfieFiles(files);
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

  const uploadIdentityFile = async (file, documentType) => {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('contactNumber', form.contactNumber);
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

  const handleVerifyIdentity = async () => {
    if (identityVerifying) return { ok: false };
    setValidIdError('');
    setFaceVerification(null);

    if (!validIdFrontFiles.length || !validIdBackFiles.length) {
      setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
      setStatus({ type: 'error', message: VALID_ID_BOTH_SIDES_ERROR });
      return { ok: false };
    }
    if (!selfieFiles.length) {
      const msg = 'Selfie/face capture is required.';
      setValidIdError(msg);
      setStatus({ type: 'error', message: msg });
      return { ok: false };
    }

    setIdentityVerifying(true);
    try {
      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadIdentityFile(validIdFrontFiles[0], 'validIdFront'),
        uploadIdentityFile(validIdBackFiles[0], 'validIdBack'),
        uploadIdentityFile(selfieFiles[0], 'selfie'),
      ]);
      const verifyResponse = await fetch('/api/account-requests/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactNumber: form.contactNumber,
          validIdFrontUrl: frontUrl,
          selfieUrl,
        }),
      });
      const verifyJson = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        throw new Error(verifyJson.error || FACE_VERIFICATION_FAILED_ERROR);
      }
      const verification = verifyJson.data || {};
      const urls = { front: frontUrl, back: backUrl, selfie: selfieUrl };
      setIdentityUrls(urls);
      setFaceVerification(verification);
      if (verification.status !== 'passed') {
        setValidIdError(FACE_VERIFICATION_FAILED_ERROR);
        setStatus({ type: 'error', message: FACE_VERIFICATION_FAILED_ERROR });
        return { ok: false, urls, verification };
      }
      setStatus({ type: 'success', message: 'Face verification passed.' });
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
        const age = calculateAge(form.birthday);
        if (age === '' || Number.isNaN(age) || age < 0) {
          setStatus({ type: 'error', message: 'Please provide a valid birthday.' });
          return false;
        }
        if (age < 18 && !form.isPwd) {
          setStatus({
            type: 'error',
            message: 'You must be at least 18 years old to sign up unless classified as PWD.',
          });
          return false;
        }
        if (form.isSeniorCitizen && age < 60) {
          setStatus({ type: 'error', message: 'Senior Citizen selection requires age 60 or above.' });
          return false;
        }
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
        if (form.isSoloParent && form.civilStatus === 'married') {
          setStatus({ type: 'error', message: SOLO_PARENT_MARRIED_ERROR });
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
            setStatus({ type: 'error', message: MINOR_PWD_REPRESENTATIVE_ERROR });
            return false;
          }
        } else if (form.representativeContact && String(form.representativeContact).trim().length !== 11) {
          setStatus({ type: 'error', message: 'Guardian/Representative contact number must be exactly 11 digits.' });
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
      case 5: {
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
      <div className={styles.progressBarScroll}>
      <div className={styles.progressBar}>
        {STEPS.map((step, index) => (
          <Fragment key={step.number}>
            {index > 0 && (
              <div className={styles.progressLineWrapper}>
                <div
                  className={`${styles.progressLine} ${
                    currentStep >= step.number ? styles.completedLine : ''
                  }`}
                />
              </div>
            )}
            <div
              className={`${styles.progressStep} ${
                step.number < currentStep ? styles.progressStepClickable : ''
              }`}
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
          </Fragment>
        ))}
      </div>
      </div>
    <p className={styles.stepIndicator}>Step {currentStep} of {TOTAL_STEPS}</p>
  </div>
);

  // ===========================
  // RENDER: STEPS
  // ===========================

  const renderStep1 = () => (
    <section className={styles.section} aria-labelledby="sector-heading">
      <SectionHeader
        id="sector-heading"
        title="Sector Classification"
        subtitle="Choose your Primary Sector first. You may add one optional Secondary Sector."
      />
      <div className={styles.sectorRow}>
        <span className={styles.sectorLabel}>Primary required, secondary optional:</span>
        <div className={styles.formGrid}>
          <Select
            label="Primary Sector"
            name="primarySector"
            value={form.primarySector}
            onChange={handleSectorSelectChange}
            options={BENEFICIARY_SECTOR_OPTIONS}
            placeholder="Select primary sector"
            required
          />
          <Select
            label="Secondary Sector"
            name="secondarySector"
            value={form.secondarySector}
            onChange={handleSectorSelectChange}
            options={getSecondarySectorOptions(form.primarySector)}
            placeholder="No secondary sector"
          />
        </div>
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
          options={getCivilStatusOptions(form.isSoloParent)}
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
      <SelfieCapture files={selfieFiles} onChange={handleSelfieChange} disabled={identityVerifying} />
      <div className={styles.validIdRow}>
        <Button type="button" onClick={handleVerifyIdentity} disabled={identityVerifying}>
          {identityVerifying ? 'Verifying Face...' : 'Verify Face Match'}
        </Button>
        {faceVerification?.status === 'passed' && (
          <span className={styles.verifiedBadge}>Face Match Passed</span>
        )}
        {faceVerification?.status === 'failed' && (
          <p className={styles.fieldError}>{FACE_VERIFICATION_FAILED_ERROR}</p>
        )}
        {faceVerification?.status === 'manual_review' && (
          <p className={styles.fieldError}>Manual Review Required</p>
        )}
        {validIdError && <p className={styles.fieldError}>{validIdError}</p>}
      </div>
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
          {/* Sector Classification */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Sector Classification</h4>
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
              <h4 className={styles.reviewGroupTitle}>Account</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(4)}>
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

          {/* Identity Verification */}
          <div className={styles.reviewGroup}>
            <div className={styles.reviewGroupHeader}>
              <h4 className={styles.reviewGroupTitle}>Identity Verification</h4>
              <button type="button" className={styles.reviewEditBtn} onClick={() => goToStep(5)}>
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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
        case 6: return renderReviewStep();
        default: return null;
      }
    };

  // ===========================
  // MAIN RENDER
  // ===========================

  return (
    <div className={styles.signupShell}>
      <div className={styles.signupPage}>
      {toast.open && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      <section className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>Barangay Sta. Rita</div>
          <h1 className={styles.heroTitle}>ALAGA Program Beneficiary Sign Up</h1>
          <p className={styles.heroSubtitle}>
            Request registration for PWD, senior citizen, or solo parent assistance. Your
            application will be reviewed by the barangay social services team.
          </p>
          <div className={styles.heroMeta} aria-label="Signup requirements">
            {signupHighlights.map((item) => (
              <span key={item} className={styles.heroPill}>{item}</span>
            ))}
          </div>
        </div>
        <div className={styles.heroAside} aria-label="Application progress">
          <span className={styles.heroAsideLabel}>Current step</span>
          <strong>{currentStep} of {TOTAL_STEPS}</strong>
        </div>
      </section>

      <Card className={styles.formCard}>
        <div className={styles.cardTopper}>
          <div>
            <p className={styles.cardKicker}>Online application</p>
            <h2 className={styles.cardTitle}>{STEPS[currentStep - 1]?.label || 'Sign Up'} details</h2>
          </div>
          <span className={styles.saveNote}>Takes about 5-10 minutes</span>
        </div>
        <p className={styles.intro}>
          This sign up form is exclusively for the <strong>ALAGA Program</strong> of
          Barangay Sta. Rita. Provide accurate information so our social services team can review
          your eligibility and contact you for verification if needed.
        </p>

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
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={goPrev}>
                ← Previous
              </Button>
            )}
            <div className={styles.navSpacer} />
            {currentStep < TOTAL_STEPS ? (
              <Button type="button" onClick={goNext}>
                Next →
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting || !hasAgreed || !isOtpVerified}
              >
                {isSubmitting ? 'Submitting…' : 'Submit Sign Up'}
              </Button>
            )}
          </div>
        </form>
      </Card>

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
                <span className={styles.legalHeading}>Acceptance of Terms</span>
                <p className={styles.legalParagraph}>
                  By using the Alaga Program system, you agree to follow these Terms and Conditions.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>User Responsibility</span>
                <ul className={styles.legalSubList}>
                  <li>Provide accurate and complete information</li>
                  <li>Provide a valid email address when required and keep contact details updated</li>
                  <li>Keep their login credentials secure</li>
                  <li>Use the system only for its intended purpose</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Account Approval</span>
                <p className={styles.legalParagraph}>
                  All registrations are subject to review and approval by authorized barangay personnel before access
                  is granted. Approval may include validation of eligibility and submitted identification documents.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Use of the System</span>
                <p className={styles.legalParagraph}>
                  The system is intended for:
                </p>
                <ul className={styles.legalSubList}>
                  <li>Beneficiary registration</li>
                  <li>Assistance request processing</li>
                  <li>Program-related services</li>
                </ul>
                <p className={styles.legalParagraph}>
                  Any misuse of the system may result in account rejection or suspension.
                </p>
                <p className={styles.legalParagraph}>
                  Program transactions may be logged for auditing, reporting, and security purposes.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Document Submission</span>
                <p className={styles.legalParagraph}>
                  Users must submit valid and truthful documents (including uploaded ID images and supporting
                  certificates, when required). The barangay may verify submitted documents and may request additional
                  proof for eligibility validation (including for Solo Parent status). Any false or misleading
                  information may result in denial of application, account rejection, or suspension.
                </p>
              </li>
            </ol>
            <p className={styles.legalSubHeading}>
              Special Provision for Assisted Registration (PWD, Senior Citizen, Solo Parent)
            </p>
            <ol className={styles.legalList} start={6}>
              <li>
                <span className={styles.legalHeading}>Guardian or Representative Registration</span>
                <ul className={styles.legalSubList}>
                  <li>A guardian or authorized representative may register on their behalf</li>
                  <li>The guardian must provide the correct personal information of the beneficiary</li>
                  <li>The guardian may use their own contact number for communication and coordination purposes</li>
                  <li>The guardian/representative may be required to submit their own valid ID and proof of authority</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Guardian Responsibility</span>
                <ul className={styles.legalSubList}>
                  <li>They are authorized to act for the beneficiary</li>
                  <li>All submitted information is accurate and truthful</li>
                  <li>They will manage communication and requests responsibly</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Consent for Representation</span>
                <ul className={styles.legalSubList}>
                  <li>The beneficiary has been informed, when possible</li>
                  <li>Consent is given for participation in the program and data processing</li>
                </ul>
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
                  We process personal data based on your consent and in connection with the barangay’s delivery of
                  public services and compliance with applicable laws and regulations.
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
                  We may also use trusted service providers (e.g., SMS messaging and secure document storage) strictly
                  for program operations, subject to appropriate safeguards.
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
              </li>
              <li>
                <span className={styles.legalHeading}>Consent</span>
                <p className={styles.legalParagraph}>
                  By registering in the system, you confirm that you have read and understood this Data Privacy Notice
                  and agree to the processing of your personal data.
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
