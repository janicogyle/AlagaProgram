'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './Modal.module.css';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer,
  size = 'medium' 
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  // Native modal dialogs contain keyboard focus and restore it when closed.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className={styles.overlay} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div 
        className={`${styles.modal} ${styles[size]}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
