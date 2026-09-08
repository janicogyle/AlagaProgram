'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import WelcomeToast from '../../components/WelcomeToast';
import styles from './layout.module.css';

const beneficiaryMenuItems = [
  {
    section: 'Beneficiary',
    items: [
      { name: 'Dashboard', href: '/beneficiary/dashboard', icon: 'dashboard' },
      { name: 'Request Services', href: '/beneficiary/requests', icon: 'document' },
      { name: 'My Requests', href: '/beneficiary/history', icon: 'documents' },
      { name: 'My Profile', href: '/beneficiary/profile', icon: 'user' },
    ],
  },
];

const beneficiaryPrimaryItems = [
  { name: 'Dashboard', shortName: 'Home', href: '/beneficiary/dashboard', icon: 'dashboard' },
  { name: 'Request Services', shortName: 'Services', href: '/beneficiary/requests', icon: 'registration' },
  { name: 'My Requests', shortName: 'Requests', href: '/beneficiary/history', icon: 'requests' },
];

const beneficiaryMoreItems = [
  { name: 'My Profile', href: '/beneficiary/profile', icon: 'users' },
];

const RESTRICTED_ID_STATUSES = new Set(['Expired', 'Renewal Pending']);

function LogoutOverlay() {
  return (
    <div className={styles.logoutOverlay}>
      <div className={styles.logoutCard} role="status" aria-live="polite">
        <span className={styles.logoutSpinner} aria-hidden="true" />
        <div>
          <p className={styles.logoutTitle}>Signing you out...</p>
          <p className={styles.logoutText}>Ending your session securely</p>
        </div>
      </div>
    </div>
  );
}

export default function BeneficiaryShell({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [idStatus, setIdStatus] = useState('');
  const [theme, setTheme] = useState('light');
  const [themeReady, setThemeReady] = useState(false);
  const [beneficiaryUser, setBeneficiaryUser] = useState({
    name: 'Beneficiary',
    role: 'Beneficiary',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.classList.add('appShellActive');
    document.body.classList.add('appShellActive');
    return () => {
      document.documentElement.classList.remove('appShellActive');
      document.body.classList.remove('appShellActive');
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadIdStatus = async () => {
      try {
        const response = await fetch('/api/beneficiary-cards/me', {
          method: 'GET',
          credentials: 'include',
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && !payload?.error) {
          setIdStatus(payload?.data?.idStatus || payload?.data?.residentStatus || '');
        }
      } catch {
        if (!cancelled) setIdStatus('');
      }
    };

    void loadIdStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = window.localStorage.getItem('alagaTheme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
      ? storedTheme
      : systemTheme;

    document.documentElement.dataset.theme = initialTheme;
    const name = window.localStorage.getItem('beneficiaryName');

    const hydrationTimer = window.setTimeout(() => {
      setTheme(initialTheme);
      setThemeReady(true);
      setBeneficiaryUser({ name: name || 'Beneficiary', role: 'Beneficiary' });
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!themeReady || typeof window === 'undefined') return;

    document.documentElement.dataset.theme = theme;
    localStorage.setItem('alagaTheme', theme);
  }, [theme, themeReady]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900 ||
        (window.innerWidth <= 1366 && window.matchMedia('(pointer: coarse)').matches);
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    await fetch('/api/beneficiary/logout', { method: 'POST' }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('beneficiaryResidentId');
      window.localStorage.removeItem('beneficiaryContactNumber');
      window.localStorage.removeItem('beneficiaryName');
    }
    router.push('/login');
  };

  const resolvedMenuItems = RESTRICTED_ID_STATUSES.has(idStatus)
    ? beneficiaryMenuItems.map((section) => ({
        ...section,
        items: section.items.filter((item) => (
          item.href === '/beneficiary/dashboard' || item.href === '/beneficiary/profile'
        )),
      }))
    : beneficiaryMenuItems;
  const resolvedPrimaryItems = RESTRICTED_ID_STATUSES.has(idStatus)
    ? beneficiaryPrimaryItems.filter((item) => item.href === '/beneficiary/dashboard')
    : beneficiaryPrimaryItems;

  return (
    <div className={styles.layout}>
      <a className="skipLink" href="#main-content">Skip to main content</a>
      <WelcomeToast />
      {loggingOut && <LogoutOverlay />}
      {isMobile && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />
      )}

      <Sidebar
        user={beneficiaryUser}
        onLogout={handleLogout}
        minimized={!sidebarOpen}
        isMobile={isMobile}
        onNavigate={() => { if (isMobile) setSidebarOpen(false); }}
        menuItems={resolvedMenuItems}
        hideBranding
        customTitle="Beneficiary Portal"
        customSubtitle="My Services & Requests"
      />

      <div
        className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}
      >
        <Navbar
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen((open) => !open)}
          activityRole="Beneficiary"
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          hideMenuToggle={isMobile}
          hideActions={isMobile}
        />
        <main id="main-content" tabIndex={-1} className={styles.pageContent}>{children}</main>
      </div>
      {isMobile && (
        <MobileBottomNavigation
          user={beneficiaryUser}
          onLogout={handleLogout}
          activityRole="Beneficiary"
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          primaryItems={resolvedPrimaryItems}
          moreItems={beneficiaryMoreItems}
          navigationLabel="Mobile beneficiary navigation"
          moreTitle="More"
        />
      )}
    </div>
  );
}
