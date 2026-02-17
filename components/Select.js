'use client';

import { useState } from 'react';
import styles from './Select.module.css';

export default function Select({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  required = false,
  disabled = false,
  error = '',
  className = ''
}) {
  return (
    <div className={`${styles.selectGroup} ${className}`}>
      {label && (
        <label htmlFor={name} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.selectWrapper}>
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={`${styles.select} ${error ? styles.selectError : ''}`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.arrow}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
