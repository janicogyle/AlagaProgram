'use client';

const EFFECTIVE_DATE = 'July 29, 2026';
const PRIVACY_EMAIL = 'barangaystarita2023@gmail.com';

export function DataPrivacyNotice({ styles }) {
  return (
    <div className={styles.legalContent}>
      <p className={styles.legalIntro}>
        <strong>ALAGA Program – Barangay Sta. Rita, Olongapo City</strong>
      </p>
      <p className={styles.legalParagraph}>Effective date: {EFFECTIVE_DATE}</p>
      <p className={styles.legalParagraph}>
        Barangay Sta. Rita is the personal information controller for personal data processed through the
        ALAGA Program. This notice explains what the system processes, why it is processed, who may receive
        it, how long it may be kept, and how you may exercise your rights under Republic Act No. 10173
        (Data Privacy Act of 2012), its Implementing Rules and Regulations, and applicable issuances of the
        National Privacy Commission.
      </p>

      <ol className={styles.legalList}>
        <li>
          <span className={styles.legalHeading}>Scope of the ALAGA Program</span>
          <p className={styles.legalParagraph}>
            The system supports registration and verification of Persons with Disability, Senior Citizens,
            and Solo Parents; beneficiary account access; QR-based beneficiary identification; assistance
            applications and tracking; renewal processing; notifications; administrative review; and
            program reporting. It is not an emergency service.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Personal Data We Process</span>
          <ul className={styles.legalSubList}>
            <li>Identity and demographic data: name, birthdate, age, birthplace, sex, citizenship, and civil status</li>
            <li>Contact and location data: mobile number, verified email when selected, and residential address</li>
            <li>Program and eligibility data: PWD, Senior Citizen, or Solo Parent classification and supporting records</li>
            <li>Identity evidence: front and back ID images, structured OCR results, selfie or live face capture, and supporting documents</li>
            <li>Representative data: name, contact details, relationship, authority, and representative ID when applicable</li>
            <li>Account and security data: password hash, verification method and status, OTP records, sessions, and account status</li>
            <li>Service records: control numbers, assistance category, requirements, status, remarks, release history, and renewals</li>
            <li>QR card data: card identifier, issue and expiry dates, status, and signed verification token</li>
            <li>Operational records: notifications, message delivery status, administrative actions, and audit/activity logs</li>
            <li>Technical data necessary to operate and secure the service, such as essential cookies and request security information</li>
          </ul>
        </li>

        <li>
          <span className={styles.legalHeading}>Sensitive Personal Information</span>
          <p className={styles.legalParagraph}>
            Birthdate, civil status, government-issued identifiers and documents, sector or eligibility
            information, disability or health-related information, and face images or face-comparison results
            may be sensitive personal information. These records require a higher level of protection and are
            not collected for advertising or sale.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>
            PWD, Senior Citizen, and Solo Parent Data Handling
          </span>
          <p className={styles.legalParagraph}>
            This notice applies equally when a person registers under one or more supported sectors. The
            system may record a primary and secondary sector classification, but personnel may access and use
            sector information only when reasonably necessary for their assigned official duties.
          </p>
          <ul className={styles.legalSubList}>
            <li>
              <strong>Persons with Disability (PWDs):</strong> the system processes PWD classification,
              disability or health-related eligibility evidence when submitted, PWD identification, and
              guardian or representative information where applicable. This information is used only to
              verify eligibility, provide accessible or appropriate services, prevent fraud, and administer
              authorized PWD assistance.
            </li>
            <li>
              <strong>Senior Citizens:</strong> the system processes birthdate or age, Senior Citizen
              classification and identification, eligibility records, and representative information where
              applicable. This information is used only to verify age and eligibility and to administer
              authorized senior-citizen services and assistance.
            </li>
            <li>
              <strong>Solo Parents:</strong> the system processes Solo Parent classification, civil status
              and other eligibility evidence when required, Solo Parent identification, and dependent or
              representative information only when necessary for the requested service. This information is
              used only to verify eligibility and administer authorized solo-parent services and assistance.
            </li>
          </ul>
          <p className={styles.legalParagraph}>
            Sector information must not be used for unrelated profiling, public disclosure, political
            targeting, commercial marketing, or unlawful discrimination. A person will not be denied a
            service solely because an automated OCR or face-comparison tool produced an uncertain result;
            authorized personnel must provide human review and an appropriate correction, resubmission, or
            in-person verification route.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Purposes and Lawful Basis</span>
          <p className={styles.legalParagraph}>
            We process only data reasonably necessary to deliver and administer barangay services, verify
            identity and eligibility, prevent duplicate or fraudulent applications, communicate application
            and assistance status, maintain accountable public records, secure the system, and comply with
            applicable legal and audit obligations.
          </p>
          <p className={styles.legalParagraph}>
            Depending on the activity and type of data, processing may be based on your consent where
            consent is legally required; the barangay&apos;s lawful public-service functions or legal
            obligations; protection of lawful rights and claims; or another basis permitted by Sections 12
            and 13 of the Data Privacy Act. Consent is not presented as the sole basis where the barangay
            must retain or process a record under law. Withdrawal of consent does not invalidate earlier
            lawful processing and may not require deletion where another lawful ground applies.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Face Comparison and Human Review</span>
          <p className={styles.legalParagraph}>
            The system uses server-side face-comparison software to compare a face detected in the front of
            an uploaded ID with the submitted selfie. It records a result such as passed, failed, or manual
            review, together with a similarity score and limited diagnostic information. The comparison is
            used to support identity verification and may require a new capture or manual review.
          </p>
          <p className={styles.legalParagraph}>
            Face comparison is not a determination of PWD, Senior Citizen, or Solo Parent eligibility and
            must not be the sole basis for a final adverse eligibility decision. Authorized personnel review
            the application and supporting records. If you believe a result is wrong, you may request human
            review or use the barangay&apos;s available in-person verification process.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Collection Sources</span>
          <p className={styles.legalParagraph}>
            Data is obtained from you; from a parent, legal guardian, or authorized representative acting for
            you; from authorized barangay personnel during assisted or walk-in registration; and from
            records or documents lawfully submitted to verify eligibility and prior assistance. A
            representative must have authority to provide another person&apos;s data and must give that
            person this notice when reasonably possible.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Access, Disclosures, and Service Providers</span>
          <p className={styles.legalParagraph}>
            Access is limited according to official duties and configured roles. Recipients may include
            authorized Barangay Sta. Rita personnel, the beneficiary or lawful representative, auditors or
            public authorities when disclosure is authorized or required by law, and contracted processors
            needed to operate the service.
          </p>
          <p className={styles.legalParagraph}>
            Current technical services include Supabase for database and authentication functions,
            Cloudinary for uploaded document and image storage, UniSMS for SMS delivery, Resend or configured
            email infrastructure for transactional messages, Google when you voluntarily choose Google
            sign-in, OCR.Space for extracting identity details from submitted ID images, and the configured
            web-hosting provider. Face matching runs in the ALAGA server
            environment using face-api.js; it is not described as a separate cloud face-recognition service.
            Providers may process data on infrastructure outside the Philippines. The barangay remains
            accountable for transferred data and should maintain appropriate contracts and safeguards.
          </p>
          <p className={styles.legalParagraph}>
            Personal data is not sold. It must not be disclosed publicly or used for unrelated political,
            commercial, marketing, or discriminatory purposes without a separate lawful basis and proper
            notice.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Cookies and Local Device Storage</span>
          <p className={styles.legalParagraph}>
            The service uses essential session cookies to keep users signed in and protect account access.
            The browser may also store limited preferences and session state, such as theme, cookie-banner
            choice, and beneficiary display information. Essential authentication storage is used to provide
            the service and is not used for behavioral advertising.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Retention and Secure Disposal</span>
          <p className={styles.legalParagraph}>
            Data is retained only for as long as necessary for the stated purposes, required government
            records and audit rules, the establishment or defense of legal claims, or another period required
            by law. Retention must be assessed separately for pending, approved, rejected, withdrawn, expired,
            or abandoned registrations; identity documents and selfies; OCR and face-comparison results;
            beneficiary and assistance records; representative records; OTP and delivery logs; QR-card
            records; and security or audit logs. When retention is no longer justified, records and copies
            held by service providers must be securely deleted, anonymized, or otherwise disposed of so they
            cannot be reconstructed or processed without authority.
          </p>
          <p className={styles.legalParagraph}>
            Barangay Sta. Rita must approve and publish a records retention and disposal schedule. Until that
            schedule is adopted, this notice does not promise an arbitrary deletion date or indefinite
            retention.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Security and Incident Response</span>
          <p className={styles.legalParagraph}>
            The system includes password and OTP hashing, role and sector access restrictions, protected
            session cookies, signed session and QR tokens, server-side secrets, file-type and storage-URL
            checks, rate limits, and activity logging. These measures reduce risk but no internet service can
            guarantee absolute security. Suspected incidents should be reported promptly to the privacy
            contact below. The barangay must assess and notify the National Privacy Commission and affected
            persons when notification is required by law.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Your Data-Subject Rights</span>
          <p className={styles.legalParagraph}>
            Subject to lawful limitations, you may exercise the rights to be informed; object; access your
            data and information about its processing; correct inaccurate data; request erasure or blocking;
            obtain data portability where applicable; claim damages; and lodge a complaint with the National
            Privacy Commission. You may also ask for human review of an automated face-comparison result.
            We may need to verify your identity or authority before acting on a request.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Children and Assisted Registration</span>
          <p className={styles.legalParagraph}>
            A parent, legal guardian, or properly authorized representative may act for a minor or person who
            cannot independently complete registration. Only information necessary for the beneficiary&apos;s
            service should be provided. The representative must act in the beneficiary&apos;s best interests,
            and the barangay should involve the beneficiary and obtain assent when appropriate to the
            person&apos;s age and capacity.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Privacy Requests and Complaints</span>
          <p className={styles.legalParagraph}>Barangay Sta. Rita ALAGA Program Office, Olongapo City</p>
          <p className={styles.legalParagraph}>
            Email:{' '}
            <a href={`mailto:${PRIVACY_EMAIL}?subject=ALAGA%20Privacy%20Request`}>{PRIVACY_EMAIL}</a>
          </p>
          <p className={styles.legalParagraph}>
            Use the subject “ALAGA Privacy Request” and describe the right you wish to exercise. Barangay
            Sta. Rita should designate and publicly identify its Data Protection Officer or privacy contact
            before production deployment. You may also file a complaint through the official National
            Privacy Commission channels at{' '}
            <a href="https://privacy.gov.ph/" target="_blank" rel="noreferrer">privacy.gov.ph</a>.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Changes to This Notice</span>
          <p className={styles.legalParagraph}>
            Material changes will be dated and presented through the system or another appropriate channel
            before the changed processing takes effect when required. If a new purpose requires consent, the
            barangay will request new, specific consent rather than treating silence or continued use as
            consent.
          </p>
        </li>
      </ol>
    </div>
  );
}

export function TermsAndConditions({ styles }) {
  return (
    <div className={styles.legalContent}>
      <p className={styles.legalIntro}>
        <strong>ALAGA Program – Terms and Conditions</strong>
      </p>
      <p className={styles.legalParagraph}>Effective date: {EFFECTIVE_DATE}</p>

      <ol className={styles.legalList}>
        <li>
          <span className={styles.legalHeading}>Agreement and Scope</span>
          <p className={styles.legalParagraph}>
            These terms govern access to the ALAGA Program portal. By registering or using an account, you
            agree to follow these terms. Nothing here waives rights or remedies that cannot lawfully be
            waived, including rights under the Data Privacy Act and applicable social-welfare laws.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Program Eligibility</span>
          <p className={styles.legalParagraph}>
            The portal is intended for Barangay Sta. Rita residents applying under supported PWD, Senior
            Citizen, or Solo Parent programs. Registration, possession of an account, or a successful face
            match does not by itself establish legal eligibility or guarantee assistance. Eligibility and
            benefits remain subject to applicable law, barangay procedures, documentary requirements,
            available program resources, and authorized review.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Truthful and Proportionate Submissions</span>
          <p className={styles.legalParagraph}>
            Provide accurate, current, and complete information and only the documents reasonably requested
            for the service. Do not submit unnecessary information about another person. Notify the barangay
            when material account or eligibility information changes.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Parents, Guardians, and Representatives</span>
          <p className={styles.legalParagraph}>
            A person registering for another beneficiary must be a parent, legal guardian, or authorized
            representative and must provide accurate evidence of identity and authority when requested.
            Representatives must act in the beneficiary&apos;s best interests, protect the beneficiary&apos;s
            credentials and documents, and must not use the account for personal benefit.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Account and Credential Security</span>
          <p className={styles.legalParagraph}>
            Keep passwords, OTPs, email and mobile access, sessions, and QR information secure. Do not share
            an OTP or password with an unauthorized person. Notify the barangay promptly if an account,
            device, contact channel, or QR card may be compromised. You are not responsible for activity
            caused solely by a security failure of the barangay or its processors.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>ID Uploads and Document Requirements</span>
          <p className={styles.legalParagraph}>
            Online identity verification requires clear front and back images of a supported, valid ID.
            Identity images must be submitted in JPG, JPEG, or PNG format and must comply with the file-size
            limit displayed by the upload form. The images must be readable, current where an expiry date
            applies, unaltered, and must belong to the beneficiary. A parent, guardian, or representative
            must upload their own valid ID when the registration workflow requires it.
          </p>
          <p className={styles.legalParagraph}>
            Assistance applications, renewals, or eligibility review may require additional certificates,
            prescriptions, IDs, or other supporting records appropriate to the requested service. Supporting
            documents may be accepted as PDF, JPG, JPEG, or PNG where the relevant upload form allows them.
            The portal may reject unsupported, corrupted, unreadable, incomplete, mismatched, unsafe, or
            apparently altered files and may request clearer copies, missing pages, original documents for
            in-person inspection, or other proportionate evidence.
          </p>
          <p className={styles.legalParagraph}>
            Uploading a document does not establish that it is authentic, current, complete, or sufficient
            and does not guarantee registration, eligibility, assistance, renewal, or payment. Do not upload
            passwords, unrelated records, or personal information that the form does not reasonably request.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>OCR, Face Comparison, and Human Verification</span>
          <p className={styles.legalParagraph}>
            The system uses OCR to detect a supported ID type and compare extracted identity details, such as
            name and birthdate, with the registration information. It also compares the face detected on the
            front of the ID with the submitted selfie or live face capture. The system may verify that the
            ID images later submitted with the application are the same images that passed the OCR step.
          </p>
          <p className={styles.legalParagraph}>
            OCR and face comparison can make mistakes and do not independently authenticate a document or
            determine PWD, Senior Citizen, or Solo Parent eligibility. An unreadable document, mismatch,
            failed result, or uncertain result may require recapture, correction, resubmission, additional
            evidence, or in-person/manual review. You may challenge an automated result and request human
            review through the barangay.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Application Review</span>
          <p className={styles.legalParagraph}>
            Authorized personnel may approve, reject, archive, or mark an application incomplete based on
            applicable eligibility rules, submitted records, verification results, and any necessary manual
            review. An adverse or incomplete result should state the reason or what is missing and provide an
            available route for correction, resubmission, human review, or in-person clarification. A final
            adverse eligibility decision must not be based solely on an automated OCR or face-comparison
            result and must not involve unlawful discrimination.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>QR Beneficiary Identification</span>
          <p className={styles.legalParagraph}>
            An issued QR code is a program verification tool, not a transferable entitlement, bank
            credential, or substitute for every government-issued ID. Its validity depends on the
            beneficiary and card record. Do not forge, alter, sell, lend, publish, or use another
            person&apos;s QR code without lawful authority.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Assistance Requests</span>
          <p className={styles.legalParagraph}>
            Submit requests only for supported categories and provide required evidence. The system may
            detect duplicate active requests and apply documented waiting or cooldown rules. Approval,
            amount, timing, and release depend on authorized review, applicable rules, complete
            requirements, and available resources. No portal message should be treated as a promise of
            payment until the barangay confirms release.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Acceptable Use</span>
          <ul className={styles.legalSubList}>
            <li>Do not impersonate another person or submit forged, altered, stolen, or misleading records</li>
            <li>Do not access or disclose another person&apos;s account, QR code, or documents without lawful authority</li>
            <li>Do not bypass OTP, identity, eligibility, role, rate-limit, or sector-access controls</li>
            <li>Do not introduce malware, probe vulnerabilities, scrape protected records, disrupt service, or automate abusive requests</li>
            <li>Do not use the portal for harassment, political campaigning, commercial solicitation, fraud, or other unlawful activity</li>
          </ul>
          <p className={styles.legalParagraph}>
            Good-faith reports of security or privacy concerns are not prohibited; report them privately to
            the barangay rather than exposing personal data.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Restriction, Suspension, and Fair Review</span>
          <p className={styles.legalParagraph}>
            The barangay may proportionately restrict an account, revoke a QR card, or refuse a transaction
            to protect a beneficiary, investigate suspected fraud, enforce eligibility rules, or secure the
            service. Except where immediate action is reasonably necessary for security or required by law,
            the affected person should be told the reason and given an appropriate opportunity to correct
            information or seek review.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Availability, Messages, and Emergencies</span>
          <p className={styles.legalParagraph}>
            Maintenance, network failures, third-party outages, and security events may interrupt service or
            delay SMS and email. The barangay should use reasonable care to maintain the service but cannot
            promise uninterrupted delivery. The portal is not for emergencies. Contact the barangay or the
            appropriate emergency service through official channels for urgent assistance.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Privacy and Electronic Records</span>
          <p className={styles.legalParagraph}>
            Personal data is handled according to the ALAGA Data Privacy Notice. Electronic submissions,
            confirmations, and system records may be used for program administration and audit where
            permitted by Philippine law. A system record does not prevent you from showing that it is
            inaccurate or was created through unauthorized activity.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Changes to These Terms</span>
          <p className={styles.legalParagraph}>
            The barangay may update these terms for legal, security, procedural, or system changes. Material
            changes will show a new effective date and be communicated through an appropriate channel.
            Changes do not retroactively remove accrued rights. Where law requires consent, a new affirmative
            agreement will be requested instead of relying only on continued use.
          </p>
        </li>

        <li>
          <span className={styles.legalHeading}>Philippine Law and Questions</span>
          <p className={styles.legalParagraph}>
            These terms are interpreted under Philippine law. Nothing prevents a person from seeking help
            from the National Privacy Commission, another competent public authority, or a court when
            legally available.
          </p>
          <p className={styles.legalParagraph}>Barangay Sta. Rita ALAGA Program Office, Olongapo City</p>
          <p className={styles.legalParagraph}>
            Email: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          </p>
        </li>
      </ol>
    </div>
  );
}

export default function LegalContent({ type, styles }) {
  return type === 'terms' ? <TermsAndConditions styles={styles} /> : <DataPrivacyNotice styles={styles} />;
}
