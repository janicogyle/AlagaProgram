'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './WelcomeToast.module.css';

const READY_HIDE_MS = 1400;
const DASHBOARD_PATHS = ['/admin/analytics', '/beneficiary/dashboard'];
const TOAST_STORAGE_PREFIX = 'alaga-welcome-toast-shown';

const getToastStorageKey = (pathname) => `${TOAST_STORAGE_PREFIX}:${pathname}`;

const hasShownToast = (pathname) => {
  try {
    return window.sessionStorage.getItem(getToastStorageKey(pathname)) === 'true';
  } catch {
    return false;
  }
};

const markToastShown = (pathname) => {
  try {
    window.sessionStorage.setItem(getToastStorageKey(pathname), 'true');
  } catch {
    // Ignore storage failures; the toast should still work without persistence.
  }
};

export default function WelcomeToast() {
  const pathname = usePathname();
  const isDashboardPath = DASHBOARD_PATHS.includes(pathname);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let startTimer;
    let leaveTimer;
    let hideTimer;

    if (!isDashboardPath) {
      hideTimer = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hideTimer);
    }

    if (hasShownToast(pathname)) {
      hideTimer = window.setTimeout(() => {
        setVisible(false);
        setLoading(true);
        setLeaving(false);
      }, 0);
      return () => window.clearTimeout(hideTimer);
    }

    startTimer = window.setTimeout(() => {
      markToastShown(pathname);
      setVisible(true);
      setLoading(true);
      setLeaving(false);
    }, 0);

    const handleDashboardLoading = (event) => {
      const isLoading = Boolean(event.detail?.loading);
      setLoading(isLoading);

      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);

      if (!isLoading) {
        leaveTimer = window.setTimeout(() => setLeaving(true), READY_HIDE_MS - 250);
        hideTimer = window.setTimeout(() => setVisible(false), READY_HIDE_MS);
      }
    };

    window.addEventListener('alaga-dashboard-loading', handleDashboardLoading);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener('alaga-dashboard-loading', handleDashboardLoading);
    };
  }, [isDashboardPath, pathname]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.toast} ${leaving ? styles.toastLeaving : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.icon} aria-hidden="true" />
      <div className={styles.content}>
        <strong>Welcome to Alaga Program</strong>
        <span>{loading ? 'Dashboard is loading. Please wait...' : 'Dashboard is ready.'}</span>
      </div>
      <div
        className={`${styles.progress} ${loading ? styles.progressLoading : styles.progressReady}`}
        aria-hidden="true"
      />
    </div>
  );
}
