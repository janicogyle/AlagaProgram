'use client';

import Link from 'next/link';
import { Card, Button, Table } from '@/components';
import styles from './page.module.css';

// TODO: Fetch from Supabase
// Expected shape: [{ type, ceiling, frequency }]
const budgetCeilings = [];

const columns = [
  { key: 'type', label: 'Type of Assistance' },
  { key: 'ceiling', label: 'Budget Ceiling' },
  { key: 'frequency', label: 'Frequency' },
];

export default function GuidelinesPage() {
  return (
    <div className={styles.guidelinesPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>ALAGA Program Guidelines</h1>
        <p className={styles.pageSubtitle}>Requirements and budget ceilings for social services assistance</p>
      </div>

      <div className={styles.content}>
        {/* Requirements Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Requirements Checklist
          </h2>

          <div className={styles.requirementsGrid}>
            {/* Medicine Reimbursement */}
            <Card className={styles.requirementCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon} style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.5 20.5L3.5 13.5C1.5 11.5 1.5 8.5 3.5 6.5C5.5 4.5 8.5 4.5 10.5 6.5L12 8L13.5 6.5C15.5 4.5 18.5 4.5 20.5 6.5C22.5 8.5 22.5 11.5 20.5 13.5L13.5 20.5C12.67 21.33 11.33 21.33 10.5 20.5Z" />
                  </svg>
                </div>
                <h3 className={styles.cardTitle}>Medicine Reimbursement</h3>
              </div>
              <ul className={styles.checkList}>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Doctor's Prescription (original)
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Official Receipt from pharmacy
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Valid ID of the beneficiary
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Barangay Certificate of Residency
                </li>
              </ul>
              <div className={styles.cardFooter}>
                <span className={styles.ceilingLabel}>Budget Ceiling:</span>
                <span className={styles.ceilingAmount}>₱500</span>
              </div>
            </Card>

            {/* Confinement Reimbursement */}
            <Card className={styles.requirementCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon} style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <h3 className={styles.cardTitle}>Confinement Reimbursement</h3>
              </div>
              <ul className={styles.checkList}>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Certificate of Confinement from hospital
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Statement of Account / Official Receipt
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Valid ID of the patient/representative
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Barangay Certificate of Residency
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Medical Abstract (if available)
                </li>
              </ul>
              <div className={styles.cardFooter}>
                <span className={styles.ceilingLabel}>Budget Ceiling:</span>
                <span className={styles.ceilingAmount}>₱1,000</span>
              </div>
            </Card>

            {/* Burial Assistance */}
            <Card className={styles.requirementCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon} style={{ backgroundColor: '#ede9fe', color: '#7c3aed' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </div>
                <h3 className={styles.cardTitle}>Burial Assistance</h3>
              </div>
              <ul className={styles.checkList}>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Death Certificate (PSA or Municipal)
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Funeral Contract / Official Receipt
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Valid ID of the claimant
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Barangay Certificate of Residency (deceased)
                </li>
                <li>
                  <span className={styles.checkIcon}>✓</span>
                  Authorization Letter (if claimant is not immediate family)
                </li>
              </ul>
              <div className={styles.cardFooter}>
                <span className={styles.ceilingLabel}>Budget Ceiling:</span>
                <span className={styles.ceilingAmount}>₱1,000</span>
              </div>
            </Card>
          </div>
        </section>

        {/* Budget Ceiling Table */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            Budget Ceiling Summary
          </h2>
          <Card padding={false}>
            <Table columns={columns} data={budgetCeilings} />
          </Card>
        </section>

        {/* Important Notes */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Important Notes
          </h2>
          <Card className={styles.notesCard}>
            <ul className={styles.notesList}>
              <li>
                <strong>Eligibility:</strong> Assistance is available to all registered residents of Barangay Sta. Rita.
              </li>
              <li>
                <strong>Processing Time:</strong> Applications are typically processed within 3-5 working days.
              </li>
              <li>
                <strong>One-time Assistance:</strong> Each type of assistance can only be availed once per incident/transaction.
              </li>
              <li>
                <strong>Document Validity:</strong> All documents must be dated within 30 days of application.
              </li>
              <li>
                <strong>Original Documents:</strong> Original copies must be presented for verification; photocopies will be retained.
              </li>
              <li>
                <strong>Representative Claims:</strong> If claiming on behalf of the beneficiary, a valid authorization letter and valid IDs of both parties are required.
              </li>
            </ul>
          </Card>
        </section>

        {/* Contact Section */}
        <section className={styles.section}>
          <Card className={styles.contactCard}>
            <div className={styles.contactContent}>
              <div className={styles.contactInfo}>
                <h3>Need Help?</h3>
                <p>For inquiries and concerns regarding the ALAGA Program, please contact the Barangay Social Welfare Office.</p>
              </div>
              <Link href="/dashboard/assistance">
                <Button>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Submit a Request
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
