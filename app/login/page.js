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
        {/* Decorative floating shapes */}
        <div className={styles.decorativeShapes}>
          <div className={`${styles.shape} ${styles.shape1}`} />
          <div className={`${styles.shape} ${styles.shape2}`} />
          <div className={`${styles.shape} ${styles.shape3}`} />
          <div className={`${styles.shape} ${styles.shape4}`} />
          <div className={`${styles.shape} ${styles.shape5}`} />
        </div>

        <div className={styles.brandContent}>
          {/* Barangay Logo */}
          <div className={styles.logoContainer}>
            <div className={styles.logoGlow} />
            <div className={styles.logoCircle}>
              <img
                src="/Brand.png"
                alt="Barangay Sta. Rita Logo"
                className={styles.logoImage}
              />
            </div>
          </div>

          {/* System Title */}
          <h1 className={styles.title}>Barangay Sta. Rita</h1>
          <div className={styles.divider} />
          <h2 className={styles.subtitle}>ALAGA PROGRAM</h2>
          <p className={styles.tagline}>Digital Identification System</p>

          {/* System Description */}
          <p className={styles.description}>
            Manage resident information, track assistance programs, 
            and generate reports for PWD, Senior Citizens, 
            and Solo Parents in our barangay.
          </p>

          {/* Feature highlights */}
          <div className={styles.features}>
            <div className={styles.featureItem}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Resident Management</span>
            </div>
            <div className={styles.featureItem}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Assistance Tracking</span>
            </div>
            <div className={styles.featureItem}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Report Generation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Section - Login Form */}
      <section className={styles.loginSection}>
        <div className={styles.loginWrapper}>
          {error && (
            <div className={styles.errorBanner}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
          <p className={styles.footerText}>
            &copy; {new Date().getFullYear()} Barangay Sta. Rita. All rights reserved.
          </p>
        </div>
      </section>
    </main>
  );
}
