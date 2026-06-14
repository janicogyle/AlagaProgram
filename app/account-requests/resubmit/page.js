'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Select from '@/components/Select';
import FileUpload from '@/components/FileUpload';
import SectionHeader from '@/components/SectionHeader';
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
  isPwd: false,
  isSeniorCitizen: false,
  isSoloParent: false,
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

function ResubmitAccountRequestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [accessCode, setAccessCode] = useState('');
  const [activeToken, setActiveToken] = useState(urlToken);
  const token = activeToken;
  const [form, setForm] = useState(initialForm);
  const [existingValidIds, setExistingValidIds] = useState([]);
  const [validIdFiles, setValidIdFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestLoaded, setRequestLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [validIdError, setValidIdError] = useState('');

  const hasSectorSelected = form.isPwd || form.isSeniorCitizen || form.isSoloParent;
  const age = useMemo(() => calculateAge(form.birthday), [form.birthday]);

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
          isPwd: !!data.isPwd,
          isSeniorCitizen: !!data.isSeniorCitizen,
          isSoloParent: !!data.isSoloParent,
          houseNo: data.houseNo || '',
          purok: data.purok || '',
          street: data.street || '',
          barangay: data.barangay || 'Sta. Rita',
          city: data.city || 'Olongapo City',
        });
        setExistingValidIds(Array.isArray(data.validIdUrls) ? data.validIdUrls : []);
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
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSectorChange = (sectorKey) => {
    setValidIdError('');
    setForm((prev) => {
      const nextValue = !prev[sectorKey];
      return {
        ...prev,
        isPwd: sectorKey === 'isPwd' ? nextValue : false,
        isSeniorCitizen: sectorKey === 'isSeniorCitizen' ? nextValue : false,
        isSoloParent: sectorKey === 'isSoloParent' ? nextValue : false,
      };
    });
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
    if (!form.houseNo.trim()) return 'Please enter your house number.';
    if (!form.purok) return 'Please select your purok.';
    if (hasSectorSelected && existingValidIds.length === 0 && validIdFiles.length === 0) {
      setValidIdError('Please upload at least one valid ID.');
      return 'Please upload at least one valid ID.';
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
      const uploadedIds = [];
      for (const file of validIdFiles) {
        const uploadForm = new FormData();
        uploadForm.append('token', token);
        uploadForm.append('file', file);

        const uploadResponse = await fetch('/api/account-requests/resubmission/upload-valid-id', {
          method: 'POST',
          body: uploadForm,
        });
        const uploadJson = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
          throw new Error(uploadJson.error || 'Valid ID upload failed.');
        }
        if (uploadJson?.data?.path) uploadedIds.push(uploadJson.data.path);
      }

      const response = await fetch('/api/account-requests/resubmission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...form,
          age,
          validIdUrls: [...existingValidIds, ...uploadedIds],
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
      setValidIdFiles([]);
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
        <PageHeader
          title="Resubmit Account Request"
          subtitle="Update the missing or incorrect signup details requested by Barangay Sta. Rita."
          className={styles.header}
        />

        <Card className={styles.card}>
          {!token && !loading ? (
            <form onSubmit={handleContinueWithCode} className={styles.form}>
              {status && (
                <div role="alert" className={`${styles.statusBanner} ${styles.statusBannerError}`}>
                  {status.message}
                </div>
              )}
              <SectionHeader
                title="Enter Resubmit Code"
                subtitle="Use the 8-character code sent to your mobile number by Barangay Sta. Rita."
              />
              <Input
                label="Resubmit Code"
                name="accessCode"
                value={accessCode}
                onChange={(event) =>
                  setAccessCode(String(event.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
                placeholder="Enter 8-character code"
                required
              />
              <Button type="submit">Continue</Button>
            </form>
          ) : loading ? (
            <div className={styles.message}>Loading resubmission details...</div>
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
                  {notes && (
                    <section className={styles.noteBox}>
                      <span className={styles.noteLabel}>Incomplete reason</span>
                      <p>{notes}</p>
                    </section>
                  )}

                  <section className={styles.section}>
                    <SectionHeader
                      title="Sector Classification"
                      subtitle="Select the correct sector classification for this account request."
                    />
                    <div className={styles.sectorChips}>
                      <label className={`${styles.sectorChip} ${form.isPwd ? styles.sectorChipActive : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.isPwd}
                          onChange={() => handleSectorChange('isPwd')}
                        />
                        <span>PWD</span>
                      </label>
                      <label
                        className={`${styles.sectorChip} ${form.isSeniorCitizen ? styles.sectorChipActive : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.isSeniorCitizen}
                          onChange={() => handleSectorChange('isSeniorCitizen')}
                        />
                        <span>Senior Citizen</span>
                      </label>
                      <label className={`${styles.sectorChip} ${form.isSoloParent ? styles.sectorChipActive : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.isSoloParent}
                          onChange={() => handleSectorChange('isSoloParent')}
                        />
                        <span>Solo Parent</span>
                      </label>
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
                        options={civilStatusOptions}
                        required
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

                  <section className={styles.section}>
                    <SectionHeader title="Contact" subtitle="Your signup contact number is kept on this request." />
                    <Input label="Contact Number" name="contactNumber" value={form.contactNumber} disabled />
                  </section>

                  <section className={styles.section}>
                    <SectionHeader title="Valid ID" subtitle="Upload corrected documents when requested." />
                    {existingValidIds.length > 0 && (
                      <div className={styles.existingDocs}>
                        <span>{existingValidIds.length} valid ID file(s) already attached.</span>
                        <button type="button" onClick={() => setExistingValidIds([])}>
                          Replace all
                        </button>
                      </div>
                    )}
                    <FileUpload
                      label="Upload Valid ID(s)"
                      documentType="validId"
                      multiple
                      files={validIdFiles}
                      onChange={(files) => {
                        setValidIdFiles(files);
                        setValidIdError('');
                      }}
                      required={hasSectorSelected && existingValidIds.length === 0}
                    />
                    {validIdError && <p className={styles.fieldError}>{validIdError}</p>}
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
