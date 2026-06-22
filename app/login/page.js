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
  );
}
