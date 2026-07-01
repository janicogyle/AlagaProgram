'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './login.module.css';
import { useRouter } from 'next/navigation';
import { UnifiedLoginForm, Modal, Button } from '@/components';
import ConstellationBackground from '@/components/ConstellationBackground';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [legalModal, setLegalModal] = useState(null);
  const router = useRouter();

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  const openLegalModal = (type) => setLegalModal(type);
  const closeLegalModal = () => setLegalModal(null);

  const handleLogin = async ({ username, password }) => {
    setLoading(true);

    try {
      // Beneficiary login (contact number + password)
      const response = await fetch('/api/beneficiary/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactNumber: username, password }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        openAlert({
          title: 'Login failed',
          message: result?.error || 'Login failed. Please try again.',
        });
        return;
      }

      const resident = result?.data;
      if (!resident) {
        openAlert({ title: 'Login failed', message: 'Login failed. Please try again.' });
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('beneficiaryResidentId', String(resident.id));
          window.localStorage.setItem('beneficiaryContactNumber', resident.contact_number || '');
          window.localStorage.setItem(
            'beneficiaryName',
            `${resident.first_name || ''} ${resident.last_name || ''}`.trim(),
          );
          window.sessionStorage.setItem('alaga-welcome-toast-pending', 'true');
        } catch (storageError) {
          console.warn('Unable to persist beneficiary identity in localStorage:', storageError);
        }
      }

      router.push('/beneficiary/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      openAlert({
        title: 'Login error',
        message: error?.message || 'An error occurred during login. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <ConstellationBackground />
      <button
        type="button"
        className={styles.backButton}
        onClick={() => router.push('/')}
      >
        <span className={styles.backIcon} aria-hidden="true"></span>
        <span className={styles.backLabel}>Back</span>
      </button>

      <div className={styles.loginShell}>
        <div className={styles.welcomePanel}>
          <div className={styles.welcomeHeader}>
            <img
              className={styles.welcomeLogo}
              src="/Brand.png"
              alt="Barangay Sta. Rita logo"
            />
            <div className={styles.welcomeHeaderText}>
              <h1 className={styles.welcomeTitle}>Welcome to Barangay Sta. Rita</h1>
              <p className={styles.welcomeSubtitle}>Alaga Program Portal</p>
            </div>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formSection}>
            <div className={styles.formHeader}>
              <div className={styles.formHeaderText}>
                <p className={styles.formHeaderTitle}>Sign In</p>
                <p className={styles.formHeaderSubtitle}>Beneficiary Portal</p>
              </div>
            </div>

            <UnifiedLoginForm role="beneficiary" onLogin={handleLogin} isSubmitting={loading} showTitle={false} />
            
            <p className={styles.signup}>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </p>

            <p className={styles.signup}>
              Signup marked incomplete?{' '}
              <Link href="/account-requests/resubmit">Resubmit your application</Link>
            </p>

            <div className={styles.legalSection}>
              <p className={styles.legalInlineText}>
                By clicking &apos;Sign In&apos;, you acknowledge and agree to the{' '}
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
                </button>{' '}
                of the Barangay Sta. Rita Alaga Program.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error / Info Modal */}
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
  );
}
