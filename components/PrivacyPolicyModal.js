'use client';

import Modal from './Modal';
import Button from './Button';
import styles from './PrivacyPolicyModal.module.css';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Privacy Notice" size="large" footer={<Button onClick={onClose}>Close</Button>}>
      <div className={styles.legalContent}>
        <p className={styles.legalIntro}>
          <strong>Alaga Program – Barangay Sta. Rita</strong>
        </p>
        <p className={styles.legalParagraph}>
          In accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012, this notice explains
          how your personal data is collected, used, stored, and protected by the Alaga Program for the administration
          of barangay assistance and services, including for PWD, Senior Citizen, and Solo Parent beneficiaries.
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
              We process personal data based on your consent and in connection with the barangay’s delivery of public
              services and compliance with applicable laws and regulations.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Data Storage and Protection</span>
            <p className={styles.legalParagraph}>
              Personal data is stored in a secured system and is accessible only to authorized personnel. Reasonable
              organizational, physical, and technical measures are implemented to help protect your data from
              unauthorized access, disclosure, or misuse.
            </p>
            <p className={styles.legalParagraph}>
              Measures may include role-based access controls, authentication, audit/activity logs, and layered security
              for QR-based identification features. Uploaded documents are stored using secured storage with controlled
              access.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Data Sharing</span>
            <p className={styles.legalParagraph}>
              Personal data may be shared only with authorized barangay personnel or government agencies when necessary
              for official purposes or when required by law.
            </p>
            <p className={styles.legalParagraph}>
              We may also use trusted service providers (e.g., SMS messaging and secure document storage) strictly for
              program operations, subject to appropriate safeguards.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Data Retention</span>
            <p className={styles.legalParagraph}>
              Your data will be kept only for as long as necessary for program operations or as required by applicable
              laws and regulations.
            </p>
            <p className={styles.legalParagraph}>
              When retention is no longer required, we take reasonable steps to securely delete, anonymize, or dispose
              of data and uploaded documents.
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
            <p className={styles.legalParagraph}>Barangay Sta. Rita Office</p>
            <p className={styles.legalParagraph}>
              Email: <a href="mailto:barangaystarita2023@gmail.com">barangaystarita2023@gmail.com</a>
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Consent</span>
            <p className={styles.legalParagraph}>
              By registering in the system, you confirm that you have read and understood this Data Privacy Notice and
              agree to the processing of your personal data.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Use of Cookies</span>
            <p className={styles.legalParagraph}>
              Our website uses essential cookies to ensure its proper functioning. These cookies are necessary for basic
              site functionality and are always active. They are used to remember your cookie consent preferences and do
              not store any personally identifiable information.
            </p>
          </li>
        </ol>
      </div>
    </Modal>
  );
}
