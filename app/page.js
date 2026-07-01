'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ConstellationBackground from '../components/ConstellationBackground';
import { assistanceData } from '@/lib/assistanceData';
import styles from './page.module.css';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroInfoIndex, setHeroInfoIndex] = useState(0);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const magnifierLevels = [1, 1.15, 1.3];
  const [uiScale, setUiScale] = useState(() => {
    if (typeof window === 'undefined') return magnifierLevels[0];
    try {
      const raw = window.localStorage.getItem('homepage_ui_scale');
      if (!raw) return magnifierLevels[0];
      const value = Number(raw);
      if (!Number.isFinite(value)) return magnifierLevels[0];
      return magnifierLevels.reduce(
        (best, next) => (Math.abs(next - value) < Math.abs(best - value) ? next : best),
        magnifierLevels[0]
      );
    } catch {
      return magnifierLevels[0];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('homepage_ui_scale', String(uiScale));
    } catch {
    }
  }, [uiScale]);

  const toggleMagnifier = () => {
    setUiScale((value) => {
      const idx = magnifierLevels.indexOf(value);
      const next = magnifierLevels[(idx + 1) % magnifierLevels.length];
      return next;
    });
  };

  const services = [
    {
      title: 'PWD Beneficiary Support',
      description: 'Apply as a PWD beneficiary, submit requirements, and track assistance updates linked to your account.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5z" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" />
          <path d="M12 13v4" />
        </svg>
      ),
    },
    {
      title: 'Senior Citizen Support',
      description: 'Register as a senior citizen beneficiary and keep your profile and assistance requests up to date.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <path d="M9 13l-1 8" />
          <path d="M15 13l1 8" />
        </svg>
      ),
    },
    {
      title: 'Solo Parent Support',
      description: 'Apply as a solo parent beneficiary, upload supporting documents, and monitor request progress.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M17 11l2 2-2 2" />
          <path d="M19 13h-4" />
        </svg>
      ),
    },
    {
      title: 'Assistance Requests',
      description: 'Submit assistance requests and track real-time status updates from review to release.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      title: 'Beneficiary ID / QR',
      description: 'Access your beneficiary ID/QR for quick verification and easier record lookup.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <path d="M3 14h7v7H3z" />
        </svg>
      ),
    },
    {
      title: 'Assistance History',
      description: 'Review your assistance history and records tied to your beneficiary account.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 14l3-3 3 2 5-6" />
        </svg>
      ),
    },
  ];

  const aboutFeatures = [
    {
      icon: assistanceData['Medicine Assistance'].icon,
      title: 'Medicine Assistance',
      description: 'Financial support for outpatient medical expenses and medication reimbursements.',
      requirements: assistanceData['Medicine Assistance'].requirements,
    },
    {
      icon: assistanceData['Confinement Assistance'].icon,
      title: 'Confinement Assistance',
      description: 'Coverage for hospital confinement costs and related medical services.',
      requirements: assistanceData['Confinement Assistance'].requirements,
    },
    {
      icon: assistanceData['Burial Assistance'].icon,
      title: 'Burial Assistance',
      description: 'Assistance to help cover funeral and burial expenses for eligible beneficiaries.',
      requirements: assistanceData['Burial Assistance'].requirements,
    },
  ];

  const heroInfoCards = [
    {
      key: 'qr-verify',
      tag: 'Benefit',
      title: 'Medicine assistance',
      description: 'Financial support for outpatient medical expenses and medication reimbursements for eligible beneficiaries.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <path d="M3 14h7v7H3z" />
          <path d="M10 10h4v4h-4z" />
        </svg>
      ),
      badges: ['Medicine Assistance'],
    },
    {
      key: 'status-tracking',
      tag: 'Benefit',
      title: 'Confinement assistance',
      description: 'Support for hospital confinement costs and related medical services when you need urgent care.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 14l3-3 3 2 5-6" />
          <path d="M18 7v4h-4" />
        </svg>
      ),
      badges: ['Confinement Assistance'],
    },
    {
      key: 'secure-data',
      tag: 'Benefit',
      title: 'Burial assistance',
      description: 'Assistance to help cover funeral and burial expenses for eligible beneficiaries and their families.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
      badges: ['Burial Assistance'],
    },
    {
      key: 'self-service',
      tag: 'How It Works',
      title: 'Apply in 4 simple steps',
      description: 'Register, upload requirements, wait for verification, then track your request and access your beneficiary details.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      badges: ['Register', 'Upload', 'Verify', 'Track'],
    },
  ];

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return;
    const count = heroInfoCards.length;
    const id = window.setInterval(() => {
      setHeroInfoIndex((value) => (value + 1) % count);
    }, 5000);
    return () => window.clearInterval(id);
  }, [heroInfoCards.length]);

  const processSteps = [
    {
      step: '01',
      title: 'Register Beneficiary Account',
      description: 'Create an account and encode complete personal information for the selected sector (PWD, Senior, Solo Parent).',
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
      title: 'Upload Documents',
      description: 'Upload a clear photo/scan of your valid ID and required supporting documents for validation.',
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
      title: 'Eligibility Confirmation',
      description: 'Barangay staff reviews and verifies details; you may be asked for additional proof when needed.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      step: '04',
      title: 'Track & Use Your ID/QR',
      description: 'View your beneficiary ID/QR and track assistance status updates and history in your account.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.magnifierButton}
        onClick={toggleMagnifier}
        aria-label={`Magnifier: ${Math.round(uiScale * 100)}%`}
        aria-pressed={uiScale !== 1}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className={styles.magnifierBadge}>{Math.round(uiScale * 100)}%</span>
      </button>
      <div
        className={`${styles.pageContent} ${uiScale !== 1 ? styles.pageContentZoomed : ''}`}
        style={{ '--uiScale': uiScale }}
      >
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

          <nav
            id="primaryNavigation"
            className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}
          >
            <a href="#home" className={styles.navLink} onClick={closeMobileMenu}>Home</a>
            <a href="#about" className={styles.navLink} onClick={closeMobileMenu}>Benefits</a>
            <a href="#how-it-works" className={styles.navLink} onClick={closeMobileMenu}>How It Works</a>
            <a href="#contact" className={styles.navLink} onClick={closeMobileMenu}>Contact</a>
            <Link href="/login" className={styles.navLoginBtn} onClick={closeMobileMenu}>
              Sign In
            </Link>
            <Link href="/signup" className={styles.navSignupBtn} onClick={closeMobileMenu}>
              Sign Up
            </Link>
          </nav>

          <button 
            className={styles.mobileMenuBtn} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="primaryNavigation"
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
        <ConstellationBackground />
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Barangay Sta. Rita
              <span className={styles.heroTitleHighlight}>Alaga Program</span>
            </h1>
            <p className={styles.heroDescription}>
              The Barangay Sta. Rita Alaga Program is our community&apos;s promise to care for one another — offering
              compassionate support for PWDs, senior citizens, and solo parents through medicine, confinement, and burial
              assistance when it matters most.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.heroBtn}>
                Apply for Assistance
              </Link>
              <a href="#about" className={styles.heroBtnOutline}>
                Learn More
              </a>
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
                <div className={styles.infoCarousel} aria-live="polite">
                  {heroInfoCards.map((card, index) => (
                    <div
                      key={card.key}
                      className={`${styles.infoSlide} ${index === heroInfoIndex ? styles.infoSlideActive : styles.infoSlideInactive}`}
                    >
                      <div className={styles.infoSlideHeader}>
                        <div className={styles.infoSlideIcon}>{card.icon}</div>
                        <div className={styles.infoSlideTitles}>
                          <span className={styles.infoSlideTag}>{card.tag}</span>
                          <div className={styles.infoSlideTitle}>{card.title}</div>
                        </div>
                      </div>
                      <div className={styles.infoSlideDesc}>{card.description}</div>
                      <div className={styles.infoSlideBadges}>
                        {card.badges.map((badge) => (
                          <span key={`${card.key}-${badge}`} className={styles.infoBadge}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.infoDots} role="tablist" aria-label="Highlights">
                  {heroInfoCards.map((card, index) => (
                    <button
                      key={`${card.key}-dot`}
                      type="button"
                      className={`${styles.infoDot} ${index === heroInfoIndex ? styles.infoDotActive : ''}`}
                      onClick={() => setHeroInfoIndex(index)}
                      aria-label={`Show: ${card.title}`}
                      aria-pressed={index === heroInfoIndex}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.floatingBadge1}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Benefits
              </div>
              <div className={styles.floatingBadge2}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                How it works
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
          <div className={styles.aboutWrapper}>
            <div className={styles.aboutLeft}>
              <span className={styles.sectionTag}>Alagang Serbisyo</span>
              <h2 className={styles.aboutMainTitle}>
                Beneficiary <span className={styles.highlight}>Benefits</span>
              </h2>
              <p className={styles.aboutMainDesc}>
                The Alaga Program Benefits for Barangay Sta. Rita PWDs, Senior Citizens and Solo Parents. Here are the lists of requirements for specific services:
              </p>
              <div className={styles.aboutKeyFeature}>
                <div className={styles.aboutKeyIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span className={styles.aboutKeyText}>Barangay Sta. Rita - Olongapo City</span>
              </div>
              <div className={styles.aboutMockup}>
                <img src="/mockup.png" alt="Alaga Program Mockup" />
              </div>
            </div>
            <div className={styles.aboutRight}>
              <div className={styles.aboutGrid}>
                {aboutFeatures.map((feature, index) => (
                  <div key={index} className={styles.aboutCard}>
                    <div className={styles.aboutIcon}>
                      {feature.icon}
                    </div>
                    <h3 className={styles.aboutTitle}>{feature.title}</h3>
                    {feature.requirements && feature.requirements.length > 0 && (
                      <div className={styles.aboutRequirements}>
                        <p className={styles.requirementsLabel}>Requirements:</p>
                        <ul className={styles.requirementsList}>
                          {feature.requirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="how-it-works" className={styles.process}>
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
          <div className={styles.processNote}>
            <div className={styles.processNoteBox}>
              <div className={styles.processNoteHeader}>
                <div className={styles.processNoteHeaderLeft}>
                  <div className={styles.processNoteIconWrap} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.29 3.86l-7.4 13.14A2 2 0 0 0 4.63 20h14.74a2 2 0 0 0 1.74-2.99l-7.4-13.15a2 2 0 0 0-3.42 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className={styles.processNoteEyebrow}>Before you submit</p>
                    <h3 className={styles.processNoteTitle}>Important reminders for registration</h3>
                  </div>
                </div>
                <span className={styles.processNotePill}>Registration</span>
              </div>
              <ul className={styles.processNoteList}>
                <li className={styles.processNoteItem}>
                  <span className={styles.processNoteBullet} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={styles.processNoteText}>Make sure your uploaded ID photo/scan is readable and matches your details.</span>
                </li>
                <li className={styles.processNoteItem}>
                  <span className={styles.processNoteBullet} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={styles.processNoteText}>
                    Sector-based applications (PWD/Senior/Solo Parent) may require supporting documents for validation.
                  </span>
                </li>
                <li className={styles.processNoteItem}>
                  <span className={styles.processNoteBullet} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={styles.processNoteText}>
                    For assisted registration, a representative/guardian may register and may be asked to submit their own ID and proof of authority.
                  </span>
                </li>
                <li className={styles.processNoteItem}>
                  <span className={styles.processNoteBullet} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={styles.processNoteText}>
                    Walk-in applicants may be encoded offline by authorized barangay staff or coordinators, then submitted in the system for verification.
                  </span>
                </li>
                <li className={styles.processNoteItem}>
                  <span className={styles.processNoteBullet} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={styles.processNoteText}>
                    By signing up, you agree to the Data Privacy Notice and Terms &amp; Conditions shown in the Sign Up page.
                  </span>
                </li>
              </ul>
              <div className={styles.processNoteActions}>
                <Link href="/signup" className={styles.processNoteButtonPrimary}>
                  Register / Sign Up
                </Link>
                <Link href="/login" className={styles.processNoteButtonSecondary}>
                  Sign In
                </Link>
              </div>
            </div>
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
                    <p>Horseshoe Drive, Olongapo City, Zambales, Philippines</p>
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
                    <p> 047 222 9225</p>
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
                    <p>barangaystarita2023@gmail.com</p>
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
              <a href="#how-it-works">How It Works</a>
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
    </div>
  );
}
