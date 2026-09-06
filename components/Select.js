'use client';

import { useId } from 'react';
import styles from './Select.module.css';

export default function Select({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  required = false,
  disabled = false,
  error = '',
  compact = false,
  allowEmptyOption = false,
  className = '',
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  return (
    <div className={`${styles.selectGroup} ${compact ? styles.compact : ''} ${className}`}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.selectWrapper}>
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={`${styles.select} ${error ? styles.selectError : ''}`}
          {...props}
          aria-label={props['aria-label'] || (!label ? placeholder : undefined)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={[props['aria-describedby'], error && `${selectId}-error`].filter(Boolean).join(' ') || undefined}
        >
          <option value="" disabled={!allowEmptyOption}>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={!!option.disabled}>
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
      {error && <span id={`${selectId}-error`} className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
