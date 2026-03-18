'use client';

import Link from 'next/link';
import { Card, Button } from '@/components';
import styles from './page.module.css';
import { assistanceData } from '@/lib/assistanceData';

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
            {Object.entries(assistanceData).map(([title, data]) => (
              <Card key={title} className={styles.requirementCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon} style={{ backgroundColor: data.iconBg, color: data.iconColor }}>
                    {data.icon}
                  </div>
                  <h3 className={styles.cardTitle}>{title}</h3>
                </div>
                <ul className={styles.checkList}>
                  {data.requirements.map((req, i) => (
                    <li key={i}>
                      <span className={styles.checkIcon}>✓</span>
                      {req}
                    </li>
                  ))}
                </ul>
                <div className={styles.cardFooter}>
                  <span className={styles.ceilingLabel}>Budget Ceiling:</span>
                  <span className={styles.ceilingAmount}>
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(data.ceiling)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Process Flow Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20V16" />
            </svg>
            Process Flow
          </h2>
          <p className={styles.sectionDescription}>
            Follow these steps to request assistance from the ALAGA program.
          </p>
          <div className={styles.flow}>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Registration</h3>
              <p className={styles.stepDescription}>
                New residents must be registered in the system. Go to the
                <Link href="/dashboard/registration" className={styles.link}>
                  Registration Page
                </Link>.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Request Submission</h3>
              <p className={styles.stepDescription}>
                Submit an assistance request with all required documents at the barangay hall.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Verification</h3>
              <p className={styles.stepDescription}>
                The submitted documents and request details will be verified by authorized personnel.
              </p>
            </div>
            <div className={styles.flowConnector}>→</div>
            <div className={styles.flowStep}>
              <div className={styles.stepNumber}>4</div>
              <h3 className={styles.stepTitle}>Approval & Disbursement</h3>
              <p className={styles.stepDescription}>
                Once approved, the assistance amount will be disbursed to the beneficiary.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
