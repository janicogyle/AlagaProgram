'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ 
  actions = [],
  position = 'left'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.actionMenu} ref={menuRef}>
      <button 
        className={styles.trigger} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="More actions"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      
      {isOpen && actions.length > 0 && (
        <div className={`${styles.dropdown} ${styles[position]}`}>
          {actions.map((item, index) => {
            if (item.type === 'divider') {
              return <div key={index} className={styles.divider} />;
            }
            return (
              <button
                key={index}
                className={`${styles.menuItem} ${item.variant === 'danger' ? styles.danger : ''} ${item.variant === 'success' ? styles.success : ''}`}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
              >
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
