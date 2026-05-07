'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
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

export default function BeneficiaryLayout({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [beneficiaryUser] = useState(() => {
    if (typeof window === 'undefined') return { name: 'Beneficiary', role: 'Beneficiary' };
    const name = window.localStorage.getItem('beneficiaryName');
    return { name: name || 'Beneficiary', role: 'Beneficiary' };
  });

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

  const handleLogout = () => {
    // Future: add real auth logout
    router.push('/login');
  };

  return (
    <div className={styles.layout}>
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
        menuItems={beneficiaryMenuItems}
        hideBranding
        customTitle="Beneficiary Portal"
        customSubtitle="My Services & Requests"
      />

      <div
        className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}
      >
        <Navbar onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
