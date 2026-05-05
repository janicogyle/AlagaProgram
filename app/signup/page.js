'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Select from '../../components/Select';
import FileUpload from '../../components/FileUpload';
import SectionHeader from '@/components/SectionHeader';
import HelperText from '@/components/HelperText';
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

export default function BeneficiarySignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [validIdFiles, setValidIdFiles] = useState([]);
  const [validIdError, setValidIdError] = useState('');
  const [legalModal, setLegalModal] = useState(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    contactNumber: '',
  });
  const [toast, setToast] = useState({ open: false, message: '' });

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
    isPwd: false,
    isSeniorCitizen: false,
    isSoloParent: false,
    houseNo: '',
    purok: '',
    barangay: 'Sta. Rita',
    city: 'Olongapo City',
  });

  const hasSectorSelected = form.isPwd || form.isSeniorCitizen || form.isSoloParent;

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

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    if (name && fieldErrors?.[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleSectorChange = (sectorKey) => {
    if (validIdError) setValidIdError('');
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

  const handleValidIdChange = (files) => {
    setValidIdFiles(files);
    if (validIdError) setValidIdError('');
  };

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => {
      setToast({ open: false, message: '' });
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast.open]);

  const openLegalModal = (type) => setLegalModal(type);
  const closeLegalModal = () => setLegalModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
      if (isSubmitting) return;
      setStatus(null);
      setFieldErrors({ contactNumber: '' });
      setIsSubmitting(true);

      try {
        if (!hasAgreed) {
          setStatus({
            type: 'error',
            message: 'Please agree to the Data Privacy Notice and Terms & Conditions before submitting.',
          });
          return;
        }
        if (!form.password || form.password.length < 8) {
          setStatus({ type: 'error', message: 'Password must be at least 8 characters long.' });
          return;
        }

      if (form.password !== form.confirmPassword) {
        setStatus({ type: 'error', message: 'Passwords do not match.' });
        return;
      }

      const ageValue = calculateAge(form.birthday);
      if (ageValue === '' || Number.isNaN(ageValue) || ageValue < 0) {
        setStatus({ type: 'error', message: 'Please provide a valid birthday.' });
        return;
      }
      if (ageValue < 18) {
        setStatus({ type: 'error', message: 'You must be at least 18 years old to sign up.' });
        return;
      }
      if (form.isSeniorCitizen && ageValue < 60) {
        setStatus({ type: 'error', message: 'Senior Citizen selection requires age 60 or above.' });
        return;
      }
      if (hasSectorSelected && validIdFiles.length === 0) {
        setValidIdError('Please upload a valid ID to verify your sector classification.');
        return;
      }

      let validIdPaths = [];
      if (validIdFiles.length > 0) {
        const uploaded = [];

        for (const file of validIdFiles) {
          const uploadForm = new FormData();
          uploadForm.append('file', file);
          uploadForm.append('contactNumber', form.contactNumber);

          const uploadResponse = await fetch('/api/account-requests/upload-valid-id', {
            method: 'POST',
            body: uploadForm,
          });

          const uploadJson = await uploadResponse.json().catch(() => ({}));
          if (!uploadResponse.ok) {
            const msg = uploadJson.error || 'Valid ID upload failed.';
            setValidIdError(msg);
            setStatus({ type: 'error', message: msg });
            return;
          }

          const path = uploadJson?.data?.path || null;
          if (!path) {
            const msg = 'Valid ID upload failed.';
            setValidIdError(msg);
            setStatus({ type: 'error', message: msg });
            return;
          }
          uploaded.push(path);
        }

        validIdPaths = uploaded.filter(Boolean);
        if (hasSectorSelected && validIdPaths.length === 0) {
          const msg = 'Valid ID upload failed.';
          setValidIdError(msg);
          setStatus({ type: 'error', message: msg });
          return;
        }
      }

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
          isPwd: form.isPwd,
          isSeniorCitizen: form.isSeniorCitizen,
          isSoloParent: form.isSoloParent,
          age: ageValue !== '' ? Number(ageValue) : null,
          birthplace: form.birthplace,
          sex: form.sex,
          citizenship: form.citizenship,
          civilStatus: form.civilStatus,
          validIdUrl: validIdPaths[0] || null,
          validIdUrls: validIdPaths,
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

  return (
    <div className={styles.signupPage}>
      {toast.open && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
      <PageHeader
        title="ALAGA Program – Beneficiary Sign Up"
        subtitle="Submit your information to request assistance under the Barangay Sta. Rita ALAGA Program."
      />

      <Card className={styles.formCard}>
        <p className={styles.intro}>
          This sign up form is exclusively for the <strong>ALAGA Program</strong> of
          Barangay Sta. Rita. Provide accurate information so our social services team can review your eligibility and
          contact you for verification if needed.
        </p>

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

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.section} aria-labelledby="sector-classification-heading">
            <div className={styles.sectorRow}>
              <span id="sector-classification-heading" className={styles.sectorLabel}>Sector classification</span>
              <p className={styles.sectorHelper}>
                Select only one: PWD, Solo Parent, or Senior Citizen.
              </p>
              <div className={styles.sectorChips}>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isPwd"
                    checked={form.isPwd}
                    onChange={() => handleSectorChange('isPwd')}
                  />
                  <span>PWD</span>
                </label>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isSeniorCitizen"
                    checked={form.isSeniorCitizen}
                    onChange={() => handleSectorChange('isSeniorCitizen')}
                  />
                  <span>Senior Citizen</span>
                </label>
                <label className={styles.sectorChip}>
                  <input
                    type="checkbox"
                    name="isSoloParent"
                    checked={form.isSoloParent}
                    onChange={() => handleSectorChange('isSoloParent')}
                  />
                  <span>Solo Parent</span>
                </label>
              </div>
            </div>

          </section>

          <section className={`${styles.section} ${styles.personalSection}`} aria-labelledby="personal-info-heading">
            <SectionHeader
              id="personal-info-heading"
              title="Personal information"
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
                options={civilStatusOptions}
                placeholder="Select civil status"
                required
              />
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
              />
              <Input
                label="Password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                minLength={8}
                required
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
              />
            </div>
          </section>

          <section className={`${styles.section} ${styles.addressSection}`} aria-labelledby="address-info-heading">
            <SectionHeader
              id="address-info-heading"
              title="Address information"
              subtitle="Your address helps us verify your eligibility within the barangay."
            />
            <div className={styles.formGrid}>
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

            <div className={styles.validIdRow}>
              <FileUpload
                label="Valid ID(s)"
                documentType="validId"
                multiple={true}
                files={validIdFiles}
                onChange={handleValidIdChange}
                required={hasSectorSelected}
              />
              {validIdError && <p className={styles.fieldError}>{validIdError}</p>}
            </div>
          </section>

          <HelperText>
            By submitting this form, you confirm that the information you provided is true and correct to the best of
            your knowledge. The information provided during sign-up will be automatically reflected in your Beneficiary
            Profile.
          </HelperText>

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

          <div className={styles.actionsRow}>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasAgreed}>
              {isSubmitting ? 'Submitting…' : 'Submit Sign Up'}
            </Button>
          </div>
        </form>
      </Card>

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
                  <li>Keep their login credentials secure</li>
                  <li>Use the system only for its intended purpose</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Account Approval</span>
                <p className={styles.legalParagraph}>
                  All registrations are subject to review and approval by authorized barangay personnel before access
                  is granted.
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
              </li>
              <li>
                <span className={styles.legalHeading}>Document Submission</span>
                <p className={styles.legalParagraph}>
                  Users must submit valid and truthful documents. Any false or misleading information may result in
                  denial of application.
                </p>
              </li>
            </ol>
            <p className={styles.legalSubHeading}>Special Provision for PWD &amp; Assisted Registration</p>
            <ol className={styles.legalList} start={6}>
              <li>
                <span className={styles.legalHeading}>Guardian or Representative Registration</span>
                <ul className={styles.legalSubList}>
                  <li>A guardian or authorized representative may register on their behalf</li>
                  <li>The guardian must provide the correct personal information of the beneficiary</li>
                  <li>The guardian may use their own contact number for communication and coordination purposes</li>
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
              explains how your personal data is collected, used, stored, and protected by the Alaga Program.
            </p>
            <ol className={styles.legalList}>
              <li>
                <span className={styles.legalHeading}>Collection of Personal Data</span>
                <ul className={styles.legalSubList}>
                  <li>Full name, birthdate, and personal details</li>
                  <li>Contact number and address</li>
                  <li>Sector classification (PWD, Senior Citizen, Solo Parent)</li>
                  <li>Uploaded valid identification documents</li>
                  <li>Assistance request details</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Purpose of Processing</span>
                <ul className={styles.legalSubList}>
                  <li>Registration and verification of beneficiaries</li>
                  <li>Processing and monitoring of assistance requests</li>
                  <li>Record-keeping and reporting</li>
                  <li>Communication regarding program updates and services</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Storage and Protection</span>
                <p className={styles.legalParagraph}>
                  Personal data is stored in a secured system and is accessible only to authorized personnel.
                  Reasonable organizational, physical, and technical measures are implemented to help protect your data
                  from unauthorized access, disclosure, or misuse.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Sharing</span>
                <p className={styles.legalParagraph}>
                  Personal data may be shared only with authorized barangay personnel or government agencies when
                  necessary for official purposes or when required by law.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Data Retention</span>
                <p className={styles.legalParagraph}>
                  Your data will be kept only for as long as necessary for program operations or as required by
                  applicable laws and regulations.
                </p>
              </li>
              <li>
                <span className={styles.legalHeading}>Your Rights</span>
                <ul className={styles.legalSubList}>
                  <li>Access your personal data</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion or blocking of data when applicable</li>
                </ul>
              </li>
              <li>
                <span className={styles.legalHeading}>Contact Information</span>
                <p className={styles.legalParagraph}>
                  Barangay Sta. Rita Office
                </p>
                <p className={styles.legalParagraph}>
                  Email: <a href="mailto:visualcraftersolutions@gmail.com">visualcraftersolutions@gmail.com</a>{' '}
                  (You may replace this with an official barangay email if available)
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
  );
}
