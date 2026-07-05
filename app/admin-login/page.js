'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';
import { UnifiedLoginForm, Modal, Button } from '@/components';
import ConstellationBackground from '@/components/ConstellationBackground';
import { supabase } from '@/lib/supabaseClient';

const PHILIPPINES_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const PHILIPPINES_TIME_ENDPOINTS = [
  'https://worldtimeapi.org/api/timezone/Asia/Manila',
  'https://timeapi.io/api/time/current/zone?timeZone=Asia%2FManila',
];
const philippinesFloatingDateFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const philippinesFloatingTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const getPhilippinesTimeEpochMs = (payload) => {
  if (Number.isFinite(payload?.unixtime)) return payload.unixtime * 1000;
  if (payload?.utc_datetime) return Date.parse(payload.utc_datetime);
  if (payload?.datetime) return Date.parse(payload.datetime);
  if (payload?.dateTime) {
    const year = Number(payload.year);
    const month = Number(payload.month);
    const day = Number(payload.day);
    const hour = Number(payload.hour);
    const minute = Number(payload.minute);
    const seconds = Number(payload.seconds ?? payload.second ?? 0);

    if ([year, month, day, hour, minute, seconds].every(Number.isFinite)) {
      return Date.UTC(year, month - 1, day, hour - 8, minute, seconds);
    }
  }
  return Number.NaN;
};

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [floatingPhilippinesTime, setFloatingPhilippinesTime] = useState(null);
  const [floatingTimeStatus, setFloatingTimeStatus] = useState('syncing');
  const router = useRouter();

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    let isMounted = true;
    let syncAnchor = null;

    const updateFromSyncedTime = () => {
      if (!syncAnchor || !isMounted) return;
      setFloatingPhilippinesTime(new Date(syncAnchor.epochMs + performance.now() - syncAnchor.syncedAtMs));
    };

    const syncPhilippinesTime = async () => {
      if (!syncAnchor) setFloatingTimeStatus('syncing');

      for (const endpoint of PHILIPPINES_TIME_ENDPOINTS) {
        try {
          const response = await fetch(endpoint, { cache: 'no-store' });
          if (!response.ok) continue;

          const payload = await response.json();
          const epochMs = getPhilippinesTimeEpochMs(payload);
          if (!Number.isFinite(epochMs)) continue;

          syncAnchor = {
            epochMs,
            syncedAtMs: performance.now(),
          };
          setFloatingTimeStatus('synced');
          updateFromSyncedTime();
          return;
        } catch {
          // Try the next time source.
        }
      }

      if (isMounted && !syncAnchor) setFloatingTimeStatus('error');
    };

    syncPhilippinesTime();
    const tickTimer = window.setInterval(updateFromSyncedTime, 1000);
    const syncTimer = window.setInterval(syncPhilippinesTime, PHILIPPINES_TIME_SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(tickTimer);
      window.clearInterval(syncTimer);
    };
  }, []);

  const handleLogin = async ({ username, password }) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      });

      if (error) {
        openAlert({ title: 'Login failed', message: error.message });
        return;
      }

      // Resolve admin profile (and auto-repair legacy DB where public.users.id isn't linked to auth.users.id)
      const token = data?.session?.access_token;
      if (!token) {
        openAlert({ title: 'Login failed', message: 'Missing session. Please try again.' });
        await supabase.auth.signOut();
        return;
      }

      const profileRes = await fetch('/api/admin/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const profileJson = await profileRes.json().catch(() => ({}));
      const userData = profileJson?.data;

      if (!profileRes.ok || !userData) {
        const isMissingProfile = profileRes.status === 404;
        openAlert({
          title: isMissingProfile ? 'Account profile not found' : 'Login error',
          message: isMissingProfile
            ? (profileJson?.error || 'Please contact the administrator.')
            : (profileJson?.error || 'Unable to resolve staff/admin profile. Please try again.'),
        });
        await supabase.auth.signOut();
        return;
      }

      if (userData.status !== 'Active') {
        openAlert({
          title: 'Account inactive',
          message: 'Your account has been deactivated. Please contact the administrator.',
        });
        await supabase.auth.signOut();
        return;
      }

      // last_login is updated server-side in /api/admin/profile
      const sessionRes = await fetch('/api/admin/session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const sessionJson = await sessionRes.json().catch(() => ({}));

      if (!sessionRes.ok || sessionJson?.error) {
        openAlert({
          title: 'Login failed',
          message: sessionJson?.error || 'Unable to create admin session. Please try again.',
        });
        await supabase.auth.signOut();
        return;
      }

      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminUser', JSON.stringify(userData));
        sessionStorage.setItem('alaga-welcome-toast-pending', 'true');
      }

      router.push('/admin');
    } catch (error) {
      console.error('Login error:', error);
      openAlert({
        title: 'Login error',
        message: error?.message || 'An error occurred during login. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const floatingDateLabel = floatingPhilippinesTime
    ? philippinesFloatingDateFormatter.format(floatingPhilippinesTime)
    : floatingTimeStatus === 'error'
      ? 'Time unavailable'
      : 'Syncing Manila';
  const floatingTimeLabel = floatingPhilippinesTime
    ? philippinesFloatingTimeFormatter.format(floatingPhilippinesTime)
    : '--:-- --';

  return (
    <div className={styles.container}>
      <ConstellationBackground />
      <div className={styles.adminFloatingTimeChip} aria-live="polite" aria-label="Philippine Standard Time">
        <span className={styles.adminFloatingTimeDate}>{floatingDateLabel}</span>
        <strong>{floatingTimeLabel}</strong>
      </div>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => router.push('/')}
      >
        <span className={styles.backIcon} aria-hidden="true"></span>
        <span className={styles.backLabel}>Back</span>
      </button>

      <div className={styles.adminPanel}>
        <div className={styles.adminHeader}>
          <Link href="/">
            <img src="/Brand.png" alt="Barangay Logo" className={styles.adminLogo} />
            <div className={styles.adminHeaderText}>
              <h1 className={styles.adminTitle}>Barangay Sta. Rita</h1>
              <p className={styles.adminSubtitle}>Administrator Login</p>
            </div>
          </Link>
        </div>

        <div className={styles.adminFormContainer}>
          <UnifiedLoginForm role="admin" onLogin={handleLogin} isSubmitting={loading} showTitle={false} />
        </div>
      </div>

      {/* Error / Info Modal */}
      <Modal
        isOpen={!!alertState.open}
        onClose={closeAlert}
        title={alertState.title || 'Message'}
        footer={
          <>
            <Button onClick={closeAlert}>OK</Button>
          </>
        }
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{alertState.message}</p>
      </Modal>
    </div>
  );
}
