'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ 
  actions = [],
  position = 'left'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;

      // Dropdown is rendered in a portal, so it is NOT inside menuRef.
      // Treat both trigger wrapper and the portaled dropdown as "inside".
      if (menuRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;

      setIsOpen(false);
    };

    // Use 'click' so menu item onClick can fire first.
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const computeDropdownStyle = useCallback(() => {
    if (!triggerRef.current) return {};

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 200;
    const padding = 12;

    let top = rect.bottom + 4;
    let left = rect.right - menuWidth; // Align to right edge of trigger

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    if (left < padding) {
      left = padding;
    }

    if (window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight - 4;
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      minWidth: menuWidth,
      zIndex: 9999,
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => {
      setDropdownStyle(computeDropdownStyle());
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, computeDropdownStyle]);

  return (
    <div className={styles.actionMenu} ref={menuRef}>
      <button
        className={styles.trigger}
        ref={triggerRef}
        onClick={() => {
          if (!isOpen) {
            setDropdownStyle(computeDropdownStyle());
          }
          setIsOpen(!isOpen);
        }}
        aria-label="More actions"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {isOpen && actions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className={`${styles.dropdown} ${styles[position]}`}
          style={dropdownStyle}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
