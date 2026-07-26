'use client';

import { useState } from 'react';
import {
  formatPhContactNumber,
  normalizePhContactNumber,
  PH_CONTACT_PLACEHOLDER,
} from '@/lib/contactNumber';
import styles from './UnifiedLoginForm.module.css';

export function UnifiedLoginForm({
  role,
  onLogin,
  onGoogleLogin,
  isSubmitting = false,
  isGoogleSubmitting = false,
  submitDisabled = false,
  extraContent = null,
  showTitle = true,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isBeneficiary = role === 'beneficiary';
  const displayedUsername = isBeneficiary ? formatPhContactNumber(username) : username;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitDisabled || isSubmitting) {
      return;
    }
    onLogin({ username, password });
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(isBeneficiary ? normalizePhContactNumber(value) : value);
  };

  const googleDisabled = isSubmitting || isGoogleSubmitting || submitDisabled;

  return (
    <form onSubmit={handleSubmit}>
      {showTitle ? (
        <h3 className={styles.formTitle}>
          {role === 'admin' ? 'Admin Login' : 'Beneficiary Login'}
        </h3>
      ) : null}
      <>
        <div className={styles.inputGroup}>
          <label htmlFor="username">{isBeneficiary ? 'Contact Number' : 'Username'}</label>
          <input
            type={isBeneficiary ? 'tel' : 'text'}
            id="username"
            value={displayedUsername}
            onChange={handleUsernameChange}
            disabled={isSubmitting}
            inputMode={isBeneficiary ? 'numeric' : undefined}
            autoComplete={isBeneficiary ? 'tel' : 'username'}
            maxLength={isBeneficiary ? 16 : undefined}
            title={isBeneficiary ? 'Enter a valid Philippine mobile number.' : undefined}
            placeholder={isBeneficiary ? PH_CONTACT_PLACEHOLDER : undefined}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="password">Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              placeholder="your password"
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isSubmitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {extraContent ? <div className={styles.formExtras}>{extraContent}</div> : null}
      </>
      <button type="submit" className={styles.loginButton} disabled={submitDisabled || isSubmitting}>
        {isSubmitting ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </button>
      {typeof onGoogleLogin === 'function' ? (
        <>
          <div className={styles.divider} aria-hidden="true">
            <span>or</span>
          </div>
          <button
            type="button"
            className={styles.googleButton}
            onClick={onGoogleLogin}
            disabled={googleDisabled}
          >
            {isGoogleSubmitting ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Connecting...
              </>
            ) : (
              <>
                <span className={styles.googleMark} aria-hidden="true">
                  <svg viewBox="0 0 48 48" focusable="false">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.5.1 24 .1 14.6.1 6.5 5.5 2.6 13.4l7.9 6.1C12.4 13.6 17.8 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.1h12.7c-.3 2.1-1.7 5.3-4.9 7.5l7.7 6c4.5-4.2 6.6-10.4 6.6-17.5z" />
                    <path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.1C1 16.6.1 20.2.1 24s.9 7.4 2.5 10.6l7.9-6.1z" />
                    <path fill="#34A853" d="M24 47.9c6.5 0 11.9-2.1 15.9-5.9l-7.7-6c-2.1 1.4-4.8 2.4-8.2 2.4-6.2 0-11.5-4.1-13.5-9.9l-7.9 6.1C6.5 42.5 14.6 47.9 24 47.9z" />
                  </svg>
                </span>
                Continue with Gmail
              </>
            )}
          </button>
        </>
      ) : null}
    </form>
  );
}
