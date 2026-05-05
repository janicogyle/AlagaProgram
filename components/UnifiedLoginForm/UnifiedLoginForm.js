'use client';

import { useState } from 'react';
import {
  formatPhContactNumber,
  normalizePhContactNumber,
  PH_CONTACT_PLACEHOLDER,
  PH_CONTACT_PREFIX,
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
      : PH_CONTACT_PREFIX
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
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
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
