'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';
import { UnifiedLoginForm, Modal, Button } from '@/components';
import { supabase } from '@/lib/supabaseClient';

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const router = useRouter();

  const openAlert = ({ title, message }) => {
    setAlertState({ open: true, title, message });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, open: false }));
  };

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
        openAlert({
          title: 'Admin account not found',
          message: profileJson?.error || 'Please contact the administrator.',
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

  return (
    <div className={styles.container}>
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
