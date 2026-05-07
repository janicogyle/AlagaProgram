'use client';

import { useState, useRef } from 'react';
import NotificationPanel from './NotificationPanel';
import styles from './Navbar.module.css';

export default function Navbar({ title, breadcrumb, onMenuClick }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationBtnRef = useRef(null);

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.menuToggle} onClick={onMenuClick} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className={styles.breadcrumb}>{breadcrumb || title}</span>
      </div>
      <div className={styles.right}>
        <div className={styles.notificationWrapper}>
          <button
            ref={notificationBtnRef}
            className={`${styles.notificationBtn} ${showNotifications ? styles.notificationBtnActive : ''}`}
            onClick={() => setShowNotifications(prev => !prev)}
            aria-label="Toggle recent activity"
            aria-expanded={showNotifications}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className={styles.notificationBadge} />}
          </button>
          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={notificationBtnRef}
            onUnreadCountChange={setUnreadCount}
          />
        </div>
      </div>
    </header>
  );
}
