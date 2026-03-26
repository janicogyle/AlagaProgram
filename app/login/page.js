'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './login.module.css';
import { useRouter } from 'next/navigation';
import { UnifiedLoginForm } from '@/components';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [role, setRole] = useState('beneficiary');
  const router = useRouter();

  const handleLogin = async ({ username, password }) => {
    // Add your authentication logic here based on role
    console.log('Role:', role);
    console.log('Username:', username);
    console.log('Password:', password);

    if (role === 'beneficiary') {
      try {
        // Look up the resident by contact number so profile/dashboard can load their data
        const { data, error } = await supabase
          .from('residents')
          .select('id, first_name, last_name, contact_number')
          .eq('contact_number', username)
          .order('id', { ascending: false })
          .limit(1);

        const resident = !error && Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (resident && typeof window !== 'undefined') {
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
      } catch (lookupError) {
        console.error('Failed to look up beneficiary during login:', lookupError);
      }
    }

    if (role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/beneficiary/dashboard');
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
              Don't have an account? <Link href="/signup">Sign up</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
