import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Left Section - Branding */}
      <section className={styles.brandSection}>
        <div className={styles.brandContent}>
          {/* Barangay Logo Placeholder */}
          <div className={styles.logoContainer}>
            <div className={styles.logoCircle}>
              <div className={styles.logoPlaceholder}>
                <span className={styles.logoText}>Barangay</span>
                <span className={styles.logoText}>Sta. Rita</span>
              </div>
            </div>
          </div>

          {/* System Icon */}
          <div className={styles.systemIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>

          {/* System Title */}
          <h1 className={styles.title}>Barangay Sta. Rita</h1>
          <h2 className={styles.subtitle}>Digital Identification System</h2>

          {/* System Description */}
          <p className={styles.description}>
            Efficiently manage resident information, track assistance programs, 
            and generate reports for PWD, Senior Citizens, Out-of-School Youth, 
            and Solo Parents in our barangay.
          </p>
        </div>
      </section>

      {/* Right Section - Login CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <div className={styles.ctaCard}>
            <h3 className={styles.ctaTitle}>Access the System</h3>
            <p className={styles.ctaDescription}>
              Sign in to manage resident records and assistance programs.
            </p>
            <Link href="/login" className={styles.loginButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In to Continue
            </Link>
          </div>

          {/* Features List */}
          <div className={styles.features}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📋</span>
              <span>Resident Registration</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📊</span>
              <span>Assistance Tracking</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📄</span>
              <span>Report Generation</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>👥</span>
              <span>User Management</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
