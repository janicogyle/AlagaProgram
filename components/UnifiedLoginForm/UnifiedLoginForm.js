'use client';

import { useState } from 'react';
import styles from './UnifiedLoginForm.module.css';

export function UnifiedLoginForm({ role, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isBeneficiary = role === 'beneficiary';

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin({ username, password });
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    if (isBeneficiary) {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 11);
      setUsername(digitsOnly);
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
            value={username}
            onChange={handleUsernameChange}
            inputMode={isBeneficiary ? 'numeric' : undefined}
            maxLength={isBeneficiary ? 11 : undefined}
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
      </>
      <button type="submit" className={styles.loginButton}>Sign In</button>
    </form>
  );
}
