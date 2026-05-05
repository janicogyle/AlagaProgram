'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const services = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        </svg>
      ),
      title: 'PWD Management',
      description: 'Register and manage Persons with Disabilities records with comprehensive profiling and assistance tracking.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      title: 'Senior Citizen Management',
      description: 'Maintain senior citizen profiles with benefits tracking and automated eligibility verification.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      title: 'Solo Parent Management',
      description: 'Track solo parent registrations, supporting documents, and assistance program participation.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: 'Assistance Tracking',
      description: 'Monitor and record all assistance given to residents with complete audit trail capabilities.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h.01" />
          <path d="M17 7h.01" />
          <path d="M7 17h.01" />
          <path d="M17 17h.01" />
          <rect x="7" y="10" width="10" height="4" />
        </svg>
      ),
      title: 'QR ID Generation',
      description: 'Generate unique QR-coded identification cards for quick verification and record access.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      title: 'Reports & Analytics',
      description: 'Generate comprehensive reports and analytics for decision-making and compliance requirements.',
    },
  ];

  const aboutFeatures = [
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      title: 'Medicine Assistance',
      description: 'Financial support for outpatient medical expenses and medication reimbursements.',
    },
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h18" />
          <path d="M7 7v10a5 5 0 0 0 10 0V7" />
          <path d="M12 3v4" />
        </svg>
      ),
      title: 'Confinement Assistance',
      description: 'Coverage for hospital confinement costs and related medical services.',
    },
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18" />
          <path d="M12 3v12" />
          <path d="M8 7h8" />
        </svg>
      ),
      title: 'Burial Assistance',
      description: 'Assistance to help cover funeral and burial expenses for eligible beneficiaries.',
    },
  ];

  const processSteps = [
    {
      step: '01',
      title: 'Register Resident',
      description: 'Encode personal information and supporting documents into the system.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
    },
    {
      step: '02',
      title: 'Verify Documents',
      description: 'Review and validate submitted documents for eligibility requirements.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      ),
    },
    {
      step: '03',
      title: 'Generate ID / QR',
      description: 'Create unique QR-coded identification card for the registered resident.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      step: '04',
      title: 'Track Assistance',
      description: 'Record and monitor all assistance provided to the beneficiary.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  const statistics = [
    {
      label: 'Total Residents',
      value: '12,847',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: 'Registered PWD',
      value: '423',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="4" r="2" />
          <path d="M19 13v-2a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2" />
          <circle cx="12" cy="19" r="4" />
          <path d="M12 15v-4" />
        </svg>
      ),
    },
    {
      label: 'Senior Citizens',
      value: '1,856',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <path d="M12 14v3" />
        </svg>
      ),
    },
    {
      label: 'Solo Parents',
      value: '634',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <circle cx="19" cy="7" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {/* Header / Navigation */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>
              <div className={styles.logoImage}>
                <img src="/Brand.png" alt="Barangay Logo" />
              </div>
              <span className={styles.logoText}>Barangay Sta. Rita</span>
            </div>
          </div>

          <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}>
            <a href="#home" className={styles.navLink}>Home</a>
            <a href="#about" className={styles.navLink}>About System</a>
            <a href="#services" className={styles.navLink}>Services</a>
            <a href="#contact" className={styles.navLink}>Contact</a>
            <Link href="/login" className={styles.navLoginBtn}>
              Sign In
            </Link>
            <Link href="/signup" className={styles.navSignupBtn}>
              Sign Up
            </Link>
          </nav>

          <button 
            className={styles.mobileMenuBtn} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className={styles.hero}>
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              ALAGA Program
            </div>
            <h1 className={styles.heroTitle}>
              Welcome to Barangay Sta. Rita
              <span className={styles.heroTitleHighlight}>Alaga Programs</span>
            </h1>
            <p className={styles.heroDescription}>
              A digital platform for managing resident profiles, tracking assistance programs, 
              and generating QR-coded identification for PWD, Senior Citizens, and Solo Parents in our barangay.
            </p>
            <div className={styles.heroActions}>
              <a href="#about" className={styles.heroBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
                Get Started
              </a>
              <Link href="/login" className={styles.heroBtnOutline}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Sign In
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroIllustration}>
              <div className={styles.illustrationCard}>
                <div className={styles.illustrationHeader}>
                  <div className={styles.illustrationLogo}>
                    <img src="/Brand.png" alt="Logo" />
                  </div>
                  <div className={styles.illustrationTitle}>
                    <span>Alaga Program</span>
                    <small>PWD&apos;s, Senior Citizens, Solo Parents</small>
                  </div>
                </div>
                <div className={styles.illustrationQR}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="7" y="7" width="3" height="3" fill="currentColor" />
                    <rect x="17" y="7" width="3" height="3" />
                  </svg>
                </div>
                <div className={styles.illustrationInfo}>
                  <div className={styles.illustrationLine}></div>
                  <div className={styles.illustrationLineShort}></div>
                </div>
              </div>
              <div className={styles.floatingBadge1}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Verified
              </div>
              <div className={styles.floatingBadge2}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Secure
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroWave}>
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#ffffff"/>
          </svg>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={styles.about}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>About the System</span>
            <h2 className={styles.sectionTitle}>Beneficiary Benefits</h2>
            <p className={styles.sectionDescription}>
              Our Alaga Program System is built to prioritize beneficiaries with faster processing,
              verified eligibility, and easier access to support.
            </p>
          </div>
          <div className={styles.aboutGrid}>
            {aboutFeatures.map((feature, index) => (
              <div key={index} className={styles.aboutCard}>
                <div className={styles.aboutIcon}>{feature.icon}</div>
                <h3 className={styles.aboutTitle}>{feature.title}</h3>
                <p className={styles.aboutDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className={styles.services}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Our Services</span>
            <h2 className={styles.sectionTitle}>Management Features</h2>
            <p className={styles.sectionDescription}>
              Explore the full range of services available in our Alaga Program system 
              designed for efficient barangay operations.
            </p>
          </div>
          <div className={styles.servicesGrid}>
            {services.map((service, index) => (
              <div key={index} className={styles.serviceCard}>
                <div className={styles.serviceIcon}>{service.icon}</div>
                <h3 className={styles.serviceTitle}>{service.title}</h3>
                <p className={styles.serviceDescription}>{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className={styles.process}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>How It Works</span>
            <h2 className={styles.sectionTitle}>Simple Registration Process</h2>
            <p className={styles.sectionDescription}>
              Follow these easy steps to register residents and issue Alaga Program cards.
            </p>
          </div>
          <div className={styles.processGrid}>
            {processSteps.map((item, index) => (
              <div key={index} className={styles.processCard}>
                <div className={styles.processStep}>{item.step}</div>
                <div className={styles.processIcon}>{item.icon}</div>
                <h3 className={styles.processTitle}>{item.title}</h3>
                <p className={styles.processDescription}>{item.description}</p>
                {index < processSteps.length - 1 && (
                  <div className={styles.processArrow}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className={styles.statistics}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTagLight}>Dashboard Preview</span>
            <h2 className={styles.sectionTitleLight}>System Statistics</h2>
            <p className={styles.sectionDescriptionLight}>
              Real-time overview of registered residents and beneficiaries in our barangay.
            </p>
          </div>
          <div className={styles.statsGrid}>
            {statistics.map((stat, index) => (
              <div key={index} className={styles.statCard}>
                <span className={styles.statIcon}>{stat.icon}</span>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={styles.contact}>
        <div className={styles.sectionContainer}>
          <div className={styles.contactContent}>
            <div className={styles.contactInfo}>
              <span className={styles.sectionTag}>Contact Us</span>
              <h2 className={styles.sectionTitle}>Get in Touch</h2>
              <p className={styles.contactDescription}>
                Have questions about the Alaga Program System? 
                Visit us at the Barangay Hall or reach out through the following channels.
              </p>
              <div className={styles.contactDetails}>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <strong>Address</strong>
                    <p>Barangay Hall, Sta. Rita, Olongapo City</p>
                  </div>
                </div>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <strong>Phone</strong>
                    <p>(02) 1234-5678</p>
                  </div>
                </div>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <strong>Email</strong>
                    <p>barangay.starita@email.gov.ph</p>
                  </div>
                </div>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <strong>Office Hours</strong>
                    <p>Monday - Friday, 8:00 AM - 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.contactCTA}>
              <div className={styles.ctaBox}>
                <h3>Ready to Get Started?</h3>
                <p>Access the system to manage resident records and assistance programs.</p>
                <Link href="/login" className={styles.ctaButton}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Sign In to System
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <img src="/Brand.png" alt="Barangay Logo" />
              </div>
              <div className={styles.footerBrandText}>
                <strong>Barangay Sta. Rita</strong>
                <span>Alaga Program</span>
              </div>
            </div>
            <div className={styles.footerLinks}>
              <a href="#home">Home</a>
              <a href="#about">About</a>
              <a href="#services">Services</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2026 Barangay Sta. Rita. All rights reserved.</p>
            <p>Official Government Digital Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
