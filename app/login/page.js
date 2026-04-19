'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './login.module.css';
import { useRouter } from 'next/navigation';
import { UnifiedLoginForm, Modal, Button } from '@/components';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [role, setRole] = useState('beneficiary');
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
      if (role === 'admin') {
        // Admin login with Supabase Auth
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

        // Store in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('adminUser', JSON.stringify(userData));
        }

        router.push('/admin');
      } else {
        // Beneficiary login (contact number + password)
        const response = await fetch('/api/beneficiary/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactNumber: username, password }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          openAlert({
            title: 'Login failed',
            message: result?.error || 'Login failed. Please try again.',
          });
          return;
        }

        const resident = result?.data;
        if (!resident) {
          openAlert({ title: 'Login failed', message: 'Login failed. Please try again.' });
          return;
        }

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('beneficiaryResidentId', String(resident.id));
            window.localStorage.setItem('beneficiaryContactNumber', resident.contact_number || '');
            window.localStorage.setItem(
              'beneficiaryName',
              `${resident.first_name || ''} ${resident.last_name || ''}`.trim(),
            );
          } catch (storageError) {
            console.warn('Unable to persist beneficiary identity in localStorage:', storageError);
          }
        }

        router.push('/beneficiary/dashboard');
      }
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

      <div className={styles.loginBox}>
        <div className={styles.logo}>
          <Link href="/">
            <img src="/Brand.png" alt="Barangay Logo" />
            <h2>Barangay Sta. Rita</h2>
          </Link>
        </div>
        
        <div className={styles.roleSelector}>
          <p className={styles.roleLabel}>Login as</p>
          <div className={styles.roleToggle} role="tablist" aria-label="Select role">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'admin'}
              className={`${styles.roleButton} ${role === 'admin' ? styles.active : ''}`}
              onClick={() => setRole('admin')}
            >
              Admin
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'beneficiary'}
              className={`${styles.roleButton} ${role === 'beneficiary' ? styles.active : ''}`}
              onClick={() => setRole('beneficiary')}
            >
              Beneficiary
            </button>
          </div>
        </div>

        <div key={role} className={styles.formSection}>
          <UnifiedLoginForm role={role} onLogin={handleLogin} />
          
          {role === 'beneficiary' && (
            <p className={styles.signup}>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </p>
          )}
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
