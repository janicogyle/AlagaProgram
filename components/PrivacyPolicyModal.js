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
          how your personal data is collected, used, stored, and protected by the Alaga Program.
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
              Personal data is stored in a secured system and is accessible only to authorized personnel. Reasonable
              organizational, physical, and technical measures are implemented to help protect your data from
              unauthorized access, disclosure, or misuse.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Data Sharing</span>
            <p className={styles.legalParagraph}>
              Personal data may be shared only with authorized barangay personnel or government agencies when necessary
              for official purposes or when required by law.
            </p>
          </li>
          <li>
            <span className={styles.legalHeading}>Data Retention</span>
            <p className={styles.legalParagraph}>
              Your data will be kept only for as long as necessary for program operations or as required by applicable
              laws and regulations.
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
        </ol>
      </div>
    </Modal>
  );
}
