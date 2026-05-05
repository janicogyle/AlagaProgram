'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

const menuItems = [
  {
    section: 'Main Menu',
    items: [
      { name: 'Dashboard', href: '/admin/analytics', icon: 'dashboard' },
      { name: 'Apply Service Request', href: '/admin/registration', icon: 'registration' },
      { name: 'Beneficiaries', href: '/admin/residents', icon: 'user' },
      { name: 'Verify Beneficiary ID', href: '/admin/beneficiary-id', icon: 'document' },
      { name: 'Assistance Requests', href: '/admin/assistance/requests', icon: 'list' },
      { name: 'Assistance Tracking', href: '/admin/assistance', icon: 'assistance' },
      { name: 'Assistance Guidelines', href: '/admin/assistance/guidelines', icon: 'guidelines' },
      { name: 'Reports', href: '/admin/reports', icon: 'reports' },
    ]
  },
  {
    section: 'Administration',
    items: [
      { name: 'Account Requests', href: '/admin/account-requests', icon: 'document' },
      { name: 'User Management', href: '/admin/users', icon: 'users' },
    ]
  }
];

const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  registration: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  list: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  assistance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5.5 5 1.5" />
      <path d="M19 6.3V4a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-1.7" />
    </svg>
  ),
  guidelines: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  document: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h7l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M13 2v5h5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  documents: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h7l5 5v11H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M15 4v5h5" />
      <path d="M4 8h3v11a2 2 0 0 0 2 2h9v1H9a3 3 0 0 1-3-3V8z" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  user: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  ),
};

export default function Sidebar({ user, onLogout, minimized, menuItems: customMenuItems, hideBranding, customTitle, customSubtitle }) {
  const pathname = usePathname();
  const resolvedUser = user;

  const isAdminRole = resolvedUser?.role === 'Admin';
  const baseMenuItems = customMenuItems || menuItems;
  const sidebarMenuItems = isAdminRole
    ? baseMenuItems
    : baseMenuItems.filter((section) => section.section !== 'Administration');

  return (
    <aside className={minimized ? `${styles.sidebar} ${styles.minimized}` : styles.sidebar}>
      {!hideBranding ? (
        <div className={styles.logo}>
          <div className={styles.logoCircle}>
            <img src="/Brand.png" alt="Barangay Sta. Rita Logo" className={styles.logoImg} />
          </div>
          {!minimized && (
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>Barangay Sta. Rita</span>
              <span className={styles.logoSubtitle}>Digital ID System</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.logo}>
          {!minimized && (
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>{customTitle || 'Beneficiary Portal'}</span>
              {(customSubtitle || resolvedUser?.role) && (
                <span className={styles.logoSubtitle}>{customSubtitle || resolvedUser?.role}</span>
              )}
            </div>
          )}
        </div>
      )}

      <nav className={styles.nav}>
        {sidebarMenuItems.map((section) => (
          <div key={section.section} className={styles.section}>
            {!minimized && <span className={styles.sectionTitle}>{section.section}</span>}
            <ul className={styles.menuList}>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.menuItem} ${pathname === item.href ? styles.active : ''}`}
                    title={item.name}
                  >
                    <span className={styles.menuIcon}>{icons[item.icon]}</span>
                    {!minimized && <span>{item.name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            <span suppressHydrationWarning>
              {(resolvedUser?.name || 'Admin User').trim().charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          {!minimized && (
            <div className={styles.userDetails}>
              <span className={styles.userName} suppressHydrationWarning>
                {resolvedUser?.name || 'Admin User'}
              </span>
              <span className={styles.userRole} suppressHydrationWarning>
                {resolvedUser?.role || 'Staff'}
              </span>
            </div>
          )}
        </div>
        {!minimized && (
          <button onClick={onLogout} className={styles.logoutButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
