'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import styles from './page.module.css';
// import { authHelpers } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (formData) => {
    setIsLoading(true);
    setError('');
    
    try {
      // TODO: Implement actual Supabase authentication
      // const { data, error } = await authHelpers.signIn(formData.username, formData.password);
      // if (error) throw error;
      
      // Simulate login for now - remove this when implementing actual auth
      console.log('Login attempt with:', formData);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to dashboard on successful login
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      {/* Left Section - Branding */}
      <section className={styles.brandSection}>
        <div className={styles.brandContent}>
          {/* Barangay Logo Placeholder */}
          <div className={styles.logoContainer}>
            <div className={styles.logoCircle}>
              <div className={styles.logoPlaceholder}>
                <span className={styles.logoText}>Barangay</span>
                <span className={styles.logoText}>Sta. Rita</span>
              </div>
            </div>
          </div>

          {/* System Icon */}
          <div className={styles.systemIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>

          {/* System Title */}
          <h1 className={styles.title}>Barangay Sta. Rita</h1>
          <h2 className={styles.subtitle}>Digital Identification System</h2>

          {/* System Description */}
          <p className={styles.description}>
            Efficiently manage resident information, track assistance programs, 
            and generate reports for PWD, Senior Citizens, Out-of-School Youth, 
            and Solo Parents in our barangay.
          </p>
        </div>
      </section>

      {/* Right Section - Login Form */}
      <section className={styles.loginSection}>
        {error && (
          <div className={styles.errorBanner}>
            {error}
          </div>
        )}
        <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
      </section>
    </main>
  );
}
