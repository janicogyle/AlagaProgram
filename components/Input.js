'use client';

import { useState } from 'react';
import {
  formatPhContactNumber,
  normalizePhContactNumber,
  PH_CONTACT_PLACEHOLDER,
} from '@/lib/contactNumber';
import styles from './Input.module.css';

export default function Input({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder = '',
  inputMode,
  autoComplete,
  required = false,
  optional = false,
  disabled = false,
  error = '',
  icon = null,
  className = '',
  mask = null,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const isContactMask = mask === 'ph-contact';
  const resolvedType = isContactMask && type === 'text' ? 'tel' : type;
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : resolvedType;
  const resolvedPlaceholder = isContactMask && !placeholder ? PH_CONTACT_PLACEHOLDER : placeholder;
  const resolvedInputMode = isContactMask ? inputMode || 'numeric' : inputMode;
  const resolvedAutoComplete = isContactMask ? autoComplete || 'tel' : autoComplete;
  const normalizedContactValue = isContactMask ? normalizePhContactNumber(value) : value;
  const displayValue = isContactMask
    ? normalizedContactValue
      ? formatPhContactNumber(normalizedContactValue)
      : ''
    : value ?? '';

  const handleChange = (event) => {
    if (!onChange) return;
    if (!isContactMask) {
      onChange(event);
      return;
    }

    const normalized = normalizePhContactNumber(event.target.value);
    onChange({
      ...event,
      target: {
        name: event.target.name,
        type: event.target.type,
        checked: event.target.checked,
        value: normalized,
      },
    });
  };

  return (
    <div className={`${styles.inputGroup} ${className}`}>
      {label && (
        <label htmlFor={name} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
          {optional && <span className={styles.optional}>(Optional)</span>}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {icon && <span className={styles.inputIcon}>{icon}</span>}
        <input
          id={name}
          type={inputType}
          name={name}
          value={displayValue}
          onChange={handleChange}
          placeholder={resolvedPlaceholder}
          inputMode={resolvedInputMode}
          autoComplete={resolvedAutoComplete}
          required={required}
          disabled={disabled}
          className={`${styles.input} ${icon ? styles.withIcon : ''} ${error ? styles.inputError : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={styles.passwordToggle}
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
        )}
      </div>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
