'use client';

export function DataPrivacyNotice({ styles }) {
  return (
    <div className={styles.legalContent}>
      <p className={styles.legalIntro}>
        <strong>ALAGA Program - Barangay Sta. Rita</strong>
      </p>
      <p className={styles.legalParagraph}>
        The ALAGA Program is a web-based barangay management system of Barangay Sta. Rita, Olongapo City
        for eligible Persons with Disability, Senior Citizens, and Solo Parents. The system supports
        beneficiary registration, identity verification, QR-based beneficiary identification, assistance
        request processing, document submission, SMS verification, administrative review, reporting, and
        account management.
      </p>
      <p className={styles.legalParagraph}>
        Barangay Sta. Rita processes personal data in accordance with Republic Act No. 10173, also known
        as the Data Privacy Act of 2012, following the principles of transparency, legitimate purpose, and
        proportionality.
      </p>

      <ol className={styles.legalList}>
        <li>
          <span className={styles.legalHeading}>Personal Data Collected</span>
          <ul className={styles.legalSubList}>
            <li>Name, birthdate, computed age, birthplace, sex, citizenship, civil status, contact number, and address</li>
            <li>Sector classification, including PWD, Senior Citizen, Solo Parent, primary sector, and secondary sector</li>
            <li>Account credentials, stored as a password hash, and account/application status</li>
            <li>Front and back valid ID images, uploaded requirements, and other supporting documents</li>
            <li>Selfie or face capture, face verification status, score, provider, timestamp, and related verification result</li>
            <li>Guardian or representative name, contact number, relationship, and representative valid ID when required</li>
            <li>Assistance request details, control numbers, request status, decision remarks, and service history</li>
            <li>Beneficiary QR card information, including card ID, issue date, expiry date, status, and signed QR token data</li>
            <li>SMS OTP records, SMS status logs, notifications, activity logs, and report data</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Sensitive Personal Information</span>
          <p className={styles.legalParagraph}>
            The system may process sensitive personal information such as sector classification, identity
            documents, selfie or face images, representative documents, and information used to verify
            eligibility for barangay assistance.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Purpose of Processing</span>
          <ul className={styles.legalSubList}>
            <li>Verify identity, contact number, residence, and sector eligibility</li>
            <li>Review, approve, reject, or mark registration applications as incomplete</li>
            <li>Create and manage beneficiary accounts and profiles</li>
            <li>Issue, renew, revoke, and verify QR-based beneficiary identification</li>
            <li>Process, track, approve, release, reject, and report assistance requests</li>
            <li>Validate uploaded requirements and face verification results</li>
            <li>Send SMS OTPs, application updates, status notices, and resubmission instructions</li>
            <li>Generate official barangay reports, statistics, notifications, and audit/activity logs</li>
            <li>Protect the system against fraud, duplicate registrations, misuse, and unauthorized access</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Basis for Processing</span>
          <p className={styles.legalParagraph}>
            Personal data is processed based on the beneficiary&apos;s consent, the legitimate purpose of
            delivering barangay assistance and beneficiary services, and the need to verify eligibility and
            maintain accurate public service records. For minors or beneficiaries who require assistance,
            consent and submission may be provided by a parent, guardian, or authorized representative.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Who May Access the Data</span>
          <ul className={styles.legalSubList}>
            <li>The beneficiary account holder, for their own profile, QR ID, requests, and history</li>
            <li>Barangay Sta. Rita administrators</li>
            <li>Authorized barangay staff, subject to role and sector access where configured</li>
            <li>System administrators responsible for maintenance, security, and troubleshooting</li>
            <li>Service providers used only as needed for database, storage, SMS, hosting, or verification support</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Third-Party Service Providers</span>
          <p className={styles.legalParagraph}>
            The system uses Supabase for database and staff authentication, Cloudinary for document and
            image storage, UniSMS for SMS delivery, and server-side face-api.js libraries for face matching.
            Hosting provider and final deployment environment should be verified by the barangay or system
            administrator.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Data Retention</span>
          <p className={styles.legalParagraph}>
            Records are kept for as long as necessary for registration verification, assistance processing,
            audit, reporting, legal, and barangay administrative purposes. Exact retention periods should be
            defined by Barangay Sta. Rita. When data is no longer necessary, it should be securely deleted,
            archived, anonymized, or disposed of according to barangay policy and applicable law.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Security Measures</span>
          <p className={styles.legalParagraph}>
            The system uses password hashing, OTP hashing, role-based access controls, admin-only route
            checks, HTTP-only session cookies, signed QR/session tokens, file type validation, Cloudinary URL
            validation, activity logs, and server-side environment secrets. Access to uploaded documents is
            intended for authorized personnel and official program use only.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Your Rights</span>
          <ul className={styles.legalSubList}>
            <li>Request access to your personal data</li>
            <li>Request correction of inaccurate or outdated information</li>
            <li>Request deletion, blocking, or withdrawal of consent when legally allowed</li>
            <li>Object to processing, subject to barangay program and legal requirements</li>
            <li>Ask how your personal data is used, stored, shared, and protected</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Contact Information</span>
          <p className={styles.legalParagraph}>Barangay Sta. Rita ALAGA Program Office</p>
          <p className={styles.legalParagraph}>Address: [Insert Barangay Office Address]</p>
          <p className={styles.legalParagraph}>
            Email: <a href="mailto:barangaystarita2023@gmail.com">barangaystarita2023@gmail.com</a>
          </p>
          <p className={styles.legalParagraph}>Phone: [Insert Contact Number]</p>
          <p className={styles.legalParagraph}>Data Protection Officer / Privacy Contact: [Insert Name or Office]</p>
        </li>

        <li>
          <span className={styles.legalHeading}>Consent</span>
          <p className={styles.legalParagraph}>
            By registering, logging in, uploading documents, submitting assistance requests, or using the
            ALAGA Program, you confirm that you have read and understood this notice and consent to the
            collection and processing of your personal data for the purposes stated above.
          </p>
        </li>
      </ol>
    </div>
  );
}

export function TermsAndConditions({ styles }) {
  return (
    <div className={styles.legalContent}>
      <ol className={styles.legalList}>
        <li>
          <span className={styles.legalHeading}>Acceptance of Terms</span>
          <p className={styles.legalParagraph}>
            By creating an account, submitting an application, logging in, uploading documents, using a QR
            beneficiary ID, or submitting an assistance request, you agree to these Terms and Conditions.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Eligibility</span>
          <p className={styles.legalParagraph}>
            The ALAGA Program is intended for eligible Barangay Sta. Rita beneficiaries, specifically Persons
            with Disability, Senior Citizens, and Solo Parents. Minors or beneficiaries who cannot register
            independently may be represented by a parent, guardian, or authorized representative.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Account Responsibility</span>
          <p className={styles.legalParagraph}>
            You are responsible for keeping your contact number, password, OTP codes, account access, and QR
            beneficiary information secure. Do not share your password, OTP, or account access with
            unauthorized persons.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Accuracy of Submitted Information</span>
          <p className={styles.legalParagraph}>
            You must submit complete, accurate, and truthful information. Your name, birthdate, address,
            sector classification, representative details, valid ID, selfie, and uploaded documents must match
            your actual identity and eligibility.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Registration Review and Approval</span>
          <p className={styles.legalParagraph}>
            Submitting a registration does not guarantee approval. Barangay personnel may approve, reject, or
            mark an application as incomplete. The barangay may request additional documents, resubmission, or
            in-person verification.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Document Upload Rules</span>
          <p className={styles.legalParagraph}>
            Uploaded documents must be clear, valid, and related to the registration or assistance request.
            Identity verification requires front and back valid ID images and a selfie. Uploading fake,
            altered, unrelated, offensive, or unauthorized documents is prohibited.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Face Verification</span>
          <p className={styles.legalParagraph}>
            The system may compare the uploaded valid ID image with a selfie or face capture to help verify
            identity. If verification fails, the application may be rejected or require resubmission or manual
            review.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>QR Code Usage</span>
          <p className={styles.legalParagraph}>
            Issued beneficiary QR codes or card references are for ALAGA Program identification and
            verification. QR codes may be active, expired, revoked, or invalid depending on the beneficiary
            record and card status. Users must not tamper with, forge, sell, transfer, or misuse QR codes.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Assistance Request Rules</span>
          <p className={styles.legalParagraph}>
            Beneficiaries may submit assistance requests only through allowed assistance categories and must
            provide required documents when requested. The system may prevent duplicate active requests and
            may enforce waiting or cooldown periods after released assistance. Approval and release remain
            subject to barangay review, eligibility rules, available records, and submitted requirements.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Prohibited Actions</span>
          <ul className={styles.legalSubList}>
            <li>Submit false information or impersonate another person</li>
            <li>Upload fraudulent, altered, unrelated, or unauthorized documents</li>
            <li>Access another person&apos;s account, QR code, documents, or records without authority</li>
            <li>Attempt to bypass verification, eligibility, OTP, QR, role, or sector access controls</li>
            <li>Disrupt, attack, scrape, or misuse the system</li>
            <li>Use the system for emergencies, harassment, fraud, or illegal activity</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Barangay Review, Rejection, and Suspension</span>
          <p className={styles.legalParagraph}>
            Barangay Sta. Rita may reject applications, mark submissions incomplete, suspend accounts, revoke
            QR cards, or restrict access when information is false, documents are invalid, eligibility is not
            proven, requirements are incomplete, system misuse occurs, or continued access may compromise
            program integrity.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>System Availability and Limitations</span>
          <p className={styles.legalParagraph}>
            The system supports barangay services but does not guarantee continuous availability, immediate
            approval, immediate SMS delivery, or automatic release of assistance. The platform is not for
            emergencies. For urgent needs, contact the barangay office directly.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Changes to Terms</span>
          <p className={styles.legalParagraph}>
            Barangay Sta. Rita may update these Terms and Conditions to reflect system changes, legal
            requirements, or barangay procedures. Continued use of the system after updates means acceptance
            of the revised terms.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Contact Information</span>
          <p className={styles.legalParagraph}>Barangay Sta. Rita ALAGA Program Office</p>
          <p className={styles.legalParagraph}>Address: [Insert Barangay Office Address]</p>
          <p className={styles.legalParagraph}>
            Email: <a href="mailto:barangaystarita2023@gmail.com">barangaystarita2023@gmail.com</a>
          </p>
          <p className={styles.legalParagraph}>Phone: [Insert Contact Number]</p>
        </li>
      </ol>
    </div>
  );
}

export default function LegalContent({ type, styles }) {
  return type === 'terms' ? <TermsAndConditions styles={styles} /> : <DataPrivacyNotice styles={styles} />;
}
