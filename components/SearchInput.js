'use client';

import { useRef } from 'react';
import styles from './SearchInput.module.css';

export default function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  className = '',
  label,
  name = 'site-search',
  autoComplete = 'off',
  disabled = false,
}) {
  const inputRef = useRef(null);
  return (
    <div className={`${styles.searchBox} ${className}`}>
      <svg 
        className={styles.searchIcon} 
        width="18" 
        height="18" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        name={name}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={label || placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.searchInput}
      />
      {value && (
        <button type="button" className={styles.clearButton} aria-label="Clear search" onClick={() => { onChange(''); inputRef.current?.focus(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      )}
    </div>
  );
}
