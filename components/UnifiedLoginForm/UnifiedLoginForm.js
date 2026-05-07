'use client';

import { useState } from 'react';
import {
  formatPhContactNumber,
  normalizePhContactNumber,
  PH_CONTACT_PLACEHOLDER,
} from '@/lib/contactNumber';
import styles from './UnifiedLoginForm.module.css';

export function UnifiedLoginForm({ role, onLogin, submitDisabled = false, extraContent = null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isBeneficiary = role === 'beneficiary';
  const displayUsername = isBeneficiary
    ? username
      ? formatPhContactNumber(username)
      : ''
    : username;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitDisabled) {
      return;
    }
    onLogin({ username, password });
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    if (isBeneficiary) {
      setUsername(normalizePhContactNumber(value));
    } else {
      setUsername(value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>
        {role === 'admin' ? 'Admin Login' : 'Beneficiary Login'}
      </h3>
      <>
        <div className={styles.inputGroup}>
          <label htmlFor="username">{isBeneficiary ? 'Contact Number' : 'Username'}</label>
          <input
            type={isBeneficiary ? 'tel' : 'text'}
            id="username"
            value={displayUsername}
            onChange={handleUsernameChange}
            inputMode={isBeneficiary ? 'numeric' : undefined}
            autoComplete={isBeneficiary ? 'tel' : undefined}
            maxLength={isBeneficiary ? 16 : undefined}
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
              placeholder="your password"
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
      <button type="submit" className={styles.loginButton} disabled={submitDisabled}>
        Sign In
      </button>
    </form>
  );
}
