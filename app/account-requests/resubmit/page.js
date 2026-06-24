'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Select from '@/components/Select';
import FileUpload from '@/components/FileUpload';
import SectionHeader from '@/components/SectionHeader';
import {
  BENEFICIARY_SECTOR_OPTIONS,
  buildSectorPairFromSource,
  deriveSectorFlags,
  getSecondarySectorOptions,
} from '@/lib/beneficiarySectors';
import styles from './page.module.css';

const purokOptions = [
  '1A',
  '1B',
  '2',
  '3A',
  '3B',
  '3C',
  '3D',
  '3E',
  '3F',
  '4A',
  '4B',
  '4C',
  '4D',
  '4E',
  '5A',
  '5A1',
  '5A2',
  '5B',
  '5C',
  '5D',
  '5E',
  '5F',
  '6A',
  '6A EXT.',
  '6B1',
  '6B2',
  '6C1',
  '6C2',
  '6D',
  '6E',
  '7',
].map((value) => ({ value, label: value }));

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
const MINOR_PWD_REPRESENTATIVE_ERROR =
  'Beneficiaries below 18 years old must provide a guardian or representative before registration can be completed.';
const VALID_ID_BOTH_SIDES_ERROR = 'Please upload both the front and back images of your valid ID.';
const FACE_VERIFICATION_FAILED_ERROR =
  'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.';

const getCivilStatusOptions = (isSoloParent) =>
  civilStatusOptions.map((option) => ({
    ...option,
    disabled: isSoloParent && option.value === 'married',
  }));

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  birthday: '',
  birthplace: '',
  sex: '',
  citizenship: 'Filipino',
  civilStatus: '',
  contactNumber: '',
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
  street: '',
  barangay: 'Sta. Rita',
  city: 'Olongapo City',
};

function calculateAge(dob) {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

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
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange([new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className={styles.selfieBlock}>
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
        files={files}
        onChange={onChange}
        multiple={false}
        required
      />
    </div>
  );
}

function ResubmitAccountRequestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [accessCode, setAccessCode] = useState('');
  const [activeToken, setActiveToken] = useState(urlToken);
  const token = activeToken;
  const [form, setForm] = useState(initialForm);
  const [existingValidIdFront, setExistingValidIdFront] = useState('');
  const [existingValidIdBack, setExistingValidIdBack] = useState('');
  const [existingSelfie, setExistingSelfie] = useState('');
  const [existingRepresentativeValidId, setExistingRepresentativeValidId] = useState('');
  const [validIdFrontFiles, setValidIdFrontFiles] = useState([]);
  const [validIdBackFiles, setValidIdBackFiles] = useState([]);
  const [selfieFiles, setSelfieFiles] = useState([]);
  const [identityUrls, setIdentityUrls] = useState({ front: '', back: '', selfie: '' });
  const [faceVerification, setFaceVerification] = useState(null);
  const [identityVerifying, setIdentityVerifying] = useState(false);
  const [representativeValidIdFiles, setRepresentativeValidIdFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestLoaded, setRequestLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [validIdError, setValidIdError] = useState('');

  const hasSectorSelected = !!form.primarySector;
  const age = useMemo(() => calculateAge(form.birthday), [form.birthday]);
  const requiresRepresentative = age !== '' && Number(age) < 18 && !!form.isPwd;

  useEffect(() => {
    if (urlToken) {
      setActiveToken(urlToken);
    }
  }, [urlToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadRequest() {
      if (!token) {
        setLoading(false);
        setRequestLoaded(false);
        return;
      }

      setLoading(true);
      setRequestLoaded(false);
      try {
        const response = await fetch(`/api/account-requests/resubmission?token=${encodeURIComponent(token)}`);
        const { data, error } = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(error || 'Unable to load this resubmission request.');
        }
        if (cancelled) return;

        const sectorPair = buildSectorPairFromSource(data);
        const sectorFlags = deriveSectorFlags(sectorPair.primarySector, sectorPair.secondarySector);
        setForm({
          firstName: data.firstName || '',
          middleName: data.middleName || '',
          lastName: data.lastName || '',
          birthday: data.birthday || '',
          birthplace: data.birthplace || '',
          sex: data.sex || '',
          citizenship: data.citizenship || 'Filipino',
          civilStatus: data.civilStatus || '',
          contactNumber: data.contactNumber || '',
          primarySector: sectorPair.primarySector,
          secondarySector: sectorPair.secondarySector,
          isPwd: sectorFlags.is_pwd,
          isSeniorCitizen: sectorFlags.is_senior_citizen,
          isSoloParent: sectorFlags.is_solo_parent,
          representativeName: data.representativeName || '',
          representativeContact: data.representativeContact || '',
          representativeRelationship: data.representativeRelationship || '',
          houseNo: data.houseNo || '',
          purok: data.purok || '',
          street: data.street || '',
          barangay: data.barangay || 'Sta. Rita',
          city: data.city || 'Olongapo City',
        });
        const loadedValidIds = Array.isArray(data.validIdUrls) ? data.validIdUrls : [];
        const frontUrl = data.validIdFrontUrl || loadedValidIds[0] || '';
        const backUrl = data.validIdBackUrl || loadedValidIds[1] || '';
        const selfieUrl = data.selfieUrl || '';
        setExistingValidIdFront(frontUrl);
        setExistingValidIdBack(backUrl);
        setExistingSelfie(selfieUrl);
        setIdentityUrls({ front: frontUrl, back: backUrl, selfie: selfieUrl });
        setFaceVerification({
          status: data.faceVerificationStatus || '',
          score: data.faceVerificationScore ?? null,
          provider: data.faceVerificationProvider || '',
          verifiedAt: data.faceVerifiedAt || '',
          error: data.faceVerificationError || '',
        });
        setExistingRepresentativeValidId(data.representativeValidIdUrl || '');
        setNotes(data.notes || '');
        setStatus(null);
        setRequestLoaded(true);
      } catch (error) {
        if (!cancelled) {
          setStatus({ type: 'error', message: error?.message || 'Unable to load this resubmission request.' });
          setRequestLoaded(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRequest();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleContinueWithCode = (event) => {
    event.preventDefault();
    const normalized = String(accessCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 8) {
      setStatus({ type: 'error', message: 'Please enter the 8-character resubmit code from your SMS.' });
      return;
    }
    setStatus(null);
    setActiveToken(normalized);
  };

  const handleChange = (event) => {
    const { name, type, checked, value } = event.target;
    if (name === 'representativeContact') {
      setForm((prev) => ({ ...prev, [name]: String(value || '').replace(/\D/g, '').slice(0, 11) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSectorSelectChange = (event) => {
    const { name, value } = event.target;
    setValidIdError('');
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
    setIdentityUrls({ front: existingValidIdFront, back: existingValidIdBack, selfie: existingSelfie });
    setFaceVerification(null);
  };

  const uploadIdentityFile = async (file, documentType) => {
    const uploadForm = new FormData();
    uploadForm.append('token', token);
    uploadForm.append('file', file);
    uploadForm.append('documentType', documentType);

    const uploadResponse = await fetch('/api/account-requests/resubmission/upload-valid-id', {
      method: 'POST',
      body: uploadForm,
    });
    const uploadJson = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) throw new Error(uploadJson.error || 'Identity document upload failed.');
    const path = uploadJson?.data?.path || '';
    if (!path) throw new Error('Identity document upload failed.');
    return path;
  };

  const handleVerifyIdentity = async () => {
    if (identityVerifying) return { ok: false };
    setValidIdError('');

    const hasFront = existingValidIdFront || validIdFrontFiles.length > 0;
    const hasBack = existingValidIdBack || validIdBackFiles.length > 0;
    const hasSelfie = existingSelfie || selfieFiles.length > 0;
    if (!hasFront || !hasBack) {
      setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
      setStatus({ type: 'error', message: VALID_ID_BOTH_SIDES_ERROR });
      return { ok: false };
    }
    if (!hasSelfie) {
      const msg = 'Selfie/face capture is required.';
      setValidIdError(msg);
      setStatus({ type: 'error', message: msg });
      return { ok: false };
    }

    setIdentityVerifying(true);
    try {
      const frontUrl = validIdFrontFiles[0]
        ? await uploadIdentityFile(validIdFrontFiles[0], 'validIdFront')
        : existingValidIdFront;
      const backUrl = validIdBackFiles[0]
        ? await uploadIdentityFile(validIdBackFiles[0], 'validIdBack')
        : existingValidIdBack;
      const selfieUrl = selfieFiles[0]
        ? await uploadIdentityFile(selfieFiles[0], 'selfie')
        : existingSelfie;

      const verifyResponse = await fetch('/api/account-requests/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, validIdFrontUrl: frontUrl, selfieUrl }),
      });
      const verifyJson = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) throw new Error(verifyJson.error || FACE_VERIFICATION_FAILED_ERROR);
      const verification = verifyJson.data || {};
      const urls = { front: frontUrl, back: backUrl, selfie: selfieUrl };
      setIdentityUrls(urls);
      setExistingValidIdFront(frontUrl);
      setExistingValidIdBack(backUrl);
      setExistingSelfie(selfieUrl);
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

  const validateForm = () => {
    setValidIdError('');
    if (!hasSectorSelected) return 'Please select a sector classification.';
    if (!form.firstName.trim() || !form.lastName.trim()) return 'Please complete your name.';
    if (!form.birthday || age === '' || age < 0) return 'Please provide a valid birthday.';
    if (age < 18 && !form.isPwd) return 'You must be at least 18 years old unless classified as PWD.';
    if (form.isSeniorCitizen && age < 60) return 'Senior Citizen selection requires age 60 or above.';
    if (!form.birthplace.trim()) return 'Please enter your birthplace.';
    if (!form.sex) return 'Please select your sex.';
    if (!form.civilStatus) return 'Please select your civil status.';
    if (form.isSoloParent && form.civilStatus === 'married') return SOLO_PARENT_MARRIED_ERROR;
    if (requiresRepresentative) {
      const repContact = String(form.representativeContact || '').trim();
      if (
        !form.representativeName.trim() ||
        !repContact ||
        repContact.length !== 11 ||
        !form.representativeRelationship.trim()
      ) {
        return MINOR_PWD_REPRESENTATIVE_ERROR;
      }
      if (!existingRepresentativeValidId && representativeValidIdFiles.length === 0) {
        return MINOR_PWD_REPRESENTATIVE_ERROR;
      }
    } else if (form.representativeContact && String(form.representativeContact).trim().length !== 11) {
      return 'Guardian/Representative contact number must be exactly 11 digits.';
    }
    if (!form.houseNo.trim()) return 'Please enter your house number.';
    if (!form.purok) return 'Please select your purok.';
    if (!existingValidIdFront && validIdFrontFiles.length === 0) {
      setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
      return VALID_ID_BOTH_SIDES_ERROR;
    }
    if (!existingValidIdBack && validIdBackFiles.length === 0) {
      setValidIdError(VALID_ID_BOTH_SIDES_ERROR);
      return VALID_ID_BOTH_SIDES_ERROR;
    }
    if (!existingSelfie && selfieFiles.length === 0) {
      return 'Selfie/face capture is required.';
    }
    if (faceVerification?.status !== 'passed') {
      setValidIdError(FACE_VERIFICATION_FAILED_ERROR);
      return FACE_VERIFICATION_FAILED_ERROR;
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validateForm();
    if (validationError) {
      setStatus({ type: 'error', message: validationError });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      let verifiedIdentityUrls = identityUrls;
      let verifiedFace = faceVerification;
      let representativeValidIdUrl = existingRepresentativeValidId || '';

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
        uploadForm.append('token', token);
        uploadForm.append('file', representativeValidIdFiles[0]);
        uploadForm.append('documentType', 'representativeValidId');

        const uploadResponse = await fetch('/api/account-requests/resubmission/upload-valid-id', {
          method: 'POST',
          body: uploadForm,
        });
        const uploadJson = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
          throw new Error(uploadJson.error || 'Representative valid ID upload failed.');
        }
        representativeValidIdUrl = uploadJson?.data?.path || '';
      }

      if (requiresRepresentative && !representativeValidIdUrl) {
        throw new Error(MINOR_PWD_REPRESENTATIVE_ERROR);
      }

      const response = await fetch('/api/account-requests/resubmission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...form,
          age,
          validIdUrls: [verifiedIdentityUrls.front, verifiedIdentityUrls.back].filter(Boolean),
          validIdFrontUrl: verifiedIdentityUrls.front,
          validIdBackUrl: verifiedIdentityUrls.back,
          selfieUrl: verifiedIdentityUrls.selfie,
          faceVerificationStatus: verifiedFace?.status,
          faceVerificationScore: verifiedFace?.score ?? null,
          faceVerificationProvider: verifiedFace?.provider || null,
          faceVerifiedAt: verifiedFace?.verifiedAt || null,
          faceVerificationError: verifiedFace?.error || null,
          representativeValidIdUrl,
        }),
      });
      const { error } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(error || 'Failed to submit corrected details.');
      }

      setStatus({
        type: 'success',
        message: 'Your corrected signup details were submitted for review.',
      });
      setValidIdFrontFiles([]);
      setValidIdBackFiles([]);
      setSelfieFiles([]);
      setTimeout(() => router.push('/login'), 2500);
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to submit corrected details.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.brandRow}>
            <span className={styles.logo} aria-hidden="true" />
            <div>
              <p className={styles.eyebrow}>Barangay Sta. Rita</p>
              <p className={styles.brandTitle}>ALAGA Program</p>
            </div>
          </div>
          <div className={styles.heroText}>
            <h1>Resubmit Account Request</h1>
            <p>Update the missing or incorrect signup details requested by Barangay Sta. Rita.</p>
          </div>
          <div className={styles.heroSteps} aria-label="Resubmission process">
            <span>Enter code</span>
            <span>Correct details</span>
            <span>Submit for review</span>
          </div>
        </header>

        <Card className={styles.card}>
          {!token && !loading ? (
            <form onSubmit={handleContinueWithCode} className={styles.form}>
              {status && (
                <div role="alert" className={`${styles.statusBanner} ${styles.statusBannerError}`}>
                  {status.message}
                </div>
              )}
              <div className={styles.codeLayout}>
                <div className={styles.codeIntro}>
                  <span className={styles.codeBadge}>SMS code</span>
                  <h2>Enter your resubmit code</h2>
                  <p>Use the 8-character code sent to your mobile number by Barangay Sta. Rita.</p>
                  <div className={styles.smsHelpBox}>
                    <strong>From your SMS</strong>
                    <span>Codes use letters and numbers only. Spaces and symbols are removed automatically.</span>
                  </div>
                </div>
                <div className={styles.codePanel}>
                  <Input
                    label="Resubmit Code"
                    name="accessCode"
                    value={accessCode}
                    onChange={(event) =>
                      setAccessCode(
                        String(event.target.value || '')
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 8),
                      )
                    }
                    placeholder="Enter 8-character code"
                    required
                  />
                  <Button type="submit">Continue</Button>
                </div>
              </div>
            </form>
          ) : loading ? (
            <div className={styles.message}>
              <span className={styles.loader} aria-hidden="true" />
              <span>Loading resubmission details...</span>
            </div>
          ) : (
            <>
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

              {requestLoaded && status?.type !== 'success' && (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.formIntro}>
                    <span className={styles.codeBadge}>Protected request</span>
                    <h2>Correct your signup details</h2>
                    <p>Review each section below, update only what needs correction, then send it back for admin review.</p>
                  </div>

                  {notes && (
                    <section className={styles.noteBox}>
                      <span className={styles.noteLabel}>Incomplete reason</span>
                      <p>{notes}</p>
                    </section>
                  )}

                  <section className={styles.section}>
                    <SectionHeader
                      title="Sector Classification"
                      subtitle="Choose the Primary Sector first. Add one Secondary Sector only if applicable."
                    />
                    <div className={styles.grid}>
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
                  </section>

                  <section className={styles.section}>
                    <SectionHeader title="Personal Information" subtitle="Correct your personal details." />
                    <div className={styles.grid}>
                      <Input label="First Name" name="firstName" value={form.firstName} onChange={handleChange} required />
                      <Input label="Middle Name" name="middleName" value={form.middleName} onChange={handleChange} optional />
                      <Input label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} required />
                      <Input label="Birthday" type="date" name="birthday" value={form.birthday} onChange={handleChange} required />
                      <Input label="Age" name="age" value={age} disabled />
                      <Input label="Birthplace" name="birthplace" value={form.birthplace} onChange={handleChange} required />
                      <Select label="Sex" name="sex" value={form.sex} onChange={handleChange} options={sexOptions} required />
                      <Input label="Citizenship" name="citizenship" value={form.citizenship} disabled />
                      <Select
                        label="Civil Status"
                        name="civilStatus"
                        value={form.civilStatus}
                        onChange={handleChange}
                        options={getCivilStatusOptions(form.isSoloParent)}
                        required
                      />
                      <Input
                        label="Guardian/Representative Full Name"
                        name="representativeName"
                        value={form.representativeName}
                        onChange={handleChange}
                        required={requiresRepresentative}
                        optional={!requiresRepresentative}
                      />
                      <Input
                        label="Guardian/Representative Contact Number"
                        name="representativeContact"
                        value={form.representativeContact}
                        onChange={handleChange}
                        placeholder="+63 XXX XXX XXXX"
                        required={requiresRepresentative}
                        optional={!requiresRepresentative}
                      />
                      <Input
                        label="Relationship to Beneficiary"
                        name="representativeRelationship"
                        value={form.representativeRelationship}
                        onChange={handleChange}
                        required={requiresRepresentative}
                        optional={!requiresRepresentative}
                      />
                    </div>
                  </section>

                  <section className={styles.section}>
                    <SectionHeader title="Address" subtitle="Correct your Sta. Rita address." />
                    <div className={styles.grid}>
                      <Input label="House Number" name="houseNo" value={form.houseNo} onChange={handleChange} required />
                      <Select
                        label="Purok"
                        name="purok"
                        value={form.purok}
                        onChange={handleChange}
                        options={purokOptions}
                        required
                      />
                      <Input label="Street" name="street" value={form.street} onChange={handleChange} optional />
                      <Input label="Barangay" name="barangay" value={form.barangay} disabled />
                      <Input label="City / Municipality" name="city" value={form.city} disabled />
                    </div>
                  </section>

                  <section className={`${styles.section} ${styles.contactSection}`}>
                    <SectionHeader title="Contact" subtitle="Your signup contact number is kept on this request." />
                    <Input label="Contact Number" name="contactNumber" value={form.contactNumber} disabled />
                  </section>

                  <section className={styles.section}>
                    <SectionHeader title="Identity Verification" subtitle="Upload both sides of your valid ID and complete face capture." />
                    {existingValidIdFront && (
                      <div className={styles.existingDocs}>
                        <span>Front valid ID already attached.</span>
                        <button type="button" onClick={() => {
                          setExistingValidIdFront('');
                          resetFaceVerification();
                        }}>
                          Replace
                        </button>
                      </div>
                    )}
                    <FileUpload
                      label="Front of Valid ID"
                      documentType="validIdImage"
                      multiple={false}
                      files={validIdFrontFiles}
                      onChange={(files) => {
                        setValidIdFrontFiles(files);
                        resetFaceVerification();
                        setValidIdError('');
                      }}
                      required={!existingValidIdFront}
                    />
                    {existingValidIdBack && (
                      <div className={styles.existingDocs}>
                        <span>Back valid ID already attached.</span>
                        <button type="button" onClick={() => {
                          setExistingValidIdBack('');
                          resetFaceVerification();
                        }}>
                          Replace
                        </button>
                      </div>
                    )}
                    <FileUpload
                      label="Back of Valid ID"
                      documentType="validIdImage"
                      multiple={false}
                      files={validIdBackFiles}
                      onChange={(files) => {
                        setValidIdBackFiles(files);
                        resetFaceVerification();
                        setValidIdError('');
                      }}
                      required={!existingValidIdBack}
                    />
                    {existingSelfie && (
                      <div className={styles.existingDocs}>
                        <span>Selfie already captured.</span>
                        <button type="button" onClick={() => {
                          setExistingSelfie('');
                          resetFaceVerification();
                        }}>
                          Replace
                        </button>
                      </div>
                    )}
                    <SelfieCapture
                      files={selfieFiles}
                      onChange={(files) => {
                        setSelfieFiles(files);
                        resetFaceVerification();
                        setValidIdError('');
                      }}
                      disabled={identityVerifying}
                    />
                    <Button type="button" onClick={handleVerifyIdentity} disabled={identityVerifying}>
                      {identityVerifying ? 'Verifying Face...' : 'Verify Face Match'}
                    </Button>
                    {faceVerification?.status === 'passed' && (
                      <span className={styles.faceStatus}>Face Match Passed</span>
                    )}
                    {validIdError && <p className={styles.fieldError}>{validIdError}</p>}
                    {existingRepresentativeValidId && (
                      <div className={styles.existingDocs}>
                        <span>Guardian/Representative valid ID already attached.</span>
                        <button type="button" onClick={() => setExistingRepresentativeValidId('')}>
                          Replace
                        </button>
                      </div>
                    )}
                    <FileUpload
                      label="Guardian/Representative Valid ID"
                      documentType="validId"
                      files={representativeValidIdFiles}
                      onChange={(files) => setRepresentativeValidIdFiles(files)}
                      required={requiresRepresentative && !existingRepresentativeValidId}
                    />
                  </section>

                  <div className={styles.actions}>
                    <Button type="button" variant="secondary" onClick={() => router.push('/login')} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Resubmit Details'}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResubmitAccountRequestPage() {
  return (
    <Suspense fallback={<div className={styles.shell}>Loading...</div>}>
      <ResubmitAccountRequestPageContent />
    </Suspense>
  );
}
