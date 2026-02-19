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
              <img src="/Brand.png" alt="Barangay Sta. Rita Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
            </div>
          </div>

          {/* System Title */}
          <h1 className={styles.title}>Barangay Sta. Rita</h1>
          <h2 className={styles.subtitle}>ALAGA PROGRAM  - Digital Identification System</h2>

          {/* System Description */}
          <p className={styles.description}>
            Manage resident information, track assistance programs, 
            and generate reports for PWD, Senior Citizens, 
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
