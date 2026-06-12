'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
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
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = window.localStorage.getItem('alagaTheme');
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [beneficiaryUser] = useState(() => {
    if (typeof window === 'undefined') return { name: 'Beneficiary', role: 'Beneficiary' };
    const name = window.localStorage.getItem('beneficiaryName');
    return { name: name || 'Beneficiary', role: 'Beneficiary' };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.classList.add('appShellActive');
    document.body.classList.add('appShellActive');
    return () => {
      document.documentElement.classList.remove('appShellActive');
      document.body.classList.remove('appShellActive');
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

    document.documentElement.dataset.theme = theme;
    localStorage.setItem('alagaTheme', theme);
  }, [theme]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900;
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

  return (
    <div className={styles.layout}>
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
        menuItems={resolvedMenuItems}
        hideBranding
        customTitle="Beneficiary Portal"
        customSubtitle="My Services & Requests"
      />

      <div
        className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}
      >
        <Navbar
          onMenuClick={() => setSidebarOpen((open) => !open)}
          activityRole="Beneficiary"
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
        />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
