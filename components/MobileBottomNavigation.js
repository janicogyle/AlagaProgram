'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationPanel from './NotificationPanel';
import styles from './MobileBottomNavigation.module.css';

const Icon = ({ name }) => {
  const common = {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    residents: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    requests: <><path d="M9 3h6l1 3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1-3Z" /><path d="M8 12h8M8 16h5" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    registration: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6M19 8v6M22 11h-6" /></>,
    qr: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><path d="M15 15h2v2h-2zM19 15h2M19 19h2v2h-2M15 19v2" /></>,
    tracking: <><path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="m9 15 3-3 2 2 7-7" /><path d="M15 7h6v6" /></>,
    guidelines: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M9 7h7M9 11h7M9 15h4" /></>,
    accounts: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    renewals: <><path d="M20 7h-5V2" /><path d="M20 7a9 9 0 1 0 1 8" /></>,
    users: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
};

const adminPrimaryItems = [
  { name: 'Dashboard', shortName: 'Home', href: '/admin/analytics', icon: 'dashboard' },
  { name: 'Beneficiaries', shortName: 'People', href: '/admin/residents', icon: 'residents' },
  { name: 'Assistance Requests', shortName: 'Requests', href: '/admin/assistance/requests', icon: 'requests' },
];

const adminMoreItems = [
  { name: 'Apply Service Request', href: '/admin/registration', icon: 'registration' },
  { name: 'Verify Beneficiary ID', href: '/admin/beneficiary-id', icon: 'qr' },
  { name: 'Assistance Tracking', href: '/admin/assistance', icon: 'tracking', exact: true },
  { name: 'Assistance Guidelines', href: '/admin/assistance/guidelines', icon: 'guidelines' },
  { name: 'Reports', href: '/admin/reports', icon: 'reports' },
  { name: 'Account Requests', href: '/admin/account-requests', icon: 'accounts', adminOnly: true },
  { name: 'Renewal Requests', href: '/admin/renewal-requests', icon: 'renewals', adminOnly: true },
  { name: 'User Management', href: '/admin/users', icon: 'users', adminOnly: true },
];

const isActiveRoute = (pathname, href, exact = false) =>
  pathname === href || (!exact && pathname.startsWith(`${href}/`));

export default function MobileBottomNavigation({
  user,
  onLogout,
  activityRole,
  theme,
  onThemeToggle,
  primaryItems = adminPrimaryItems,
  moreItems = adminMoreItems,
  navigationLabel = 'Mobile admin navigation',
  moreTitle = 'More tools',
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationButtonRef = useRef(null);
  const availableMoreItems = moreItems.filter((item) => !item.adminOnly || user?.role === 'Admin');
  const moreIsActive = availableMoreItems.some((item) =>
    isActiveRoute(pathname, item.href, item.exact),
  );

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          onClick={() => setMoreOpen(false)}
          aria-label="Close more navigation"
        />
      ) : null}

      <section className={`${styles.moreSheet} ${moreOpen ? styles.moreSheetOpen : ''}`} aria-hidden={!moreOpen} inert={!moreOpen ? true : undefined}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <div>
            <h2>{moreTitle}</h2>
            <p>{user?.name || 'Admin'} · {user?.role || 'Staff'}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={() => setMoreOpen(false)} aria-label="Close more tools">×</button>
        </div>
        <nav className={styles.moreGrid} aria-label={`More ${navigationLabel.toLowerCase()}`}>
          {availableMoreItems.map((item) => {
            const active = isActiveRoute(pathname, item.href, item.exact);
            return (
              <Link key={item.href} href={item.href} className={`${styles.moreLink} ${active ? styles.moreLinkActive : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
                <span className={styles.moreIcon}><Icon name={item.icon} /></span>
                <span>{item.name}</span>
              </Link>
            );
          })}
          <button type="button" className={styles.moreLink} onClick={onThemeToggle}>
            <span className={styles.moreIcon}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button type="button" className={`${styles.moreLink} ${styles.logoutLink}`} onClick={() => { setMoreOpen(false); onLogout?.(); }}>
            <span className={styles.moreIcon}><Icon name="logout" /></span>
            <span>Logout</span>
          </button>
        </nav>
      </section>

      <nav
        className={styles.bottomNav}
        aria-label={navigationLabel}
        style={{ '--mobile-nav-item-count': primaryItems.length + 2 }}
      >
        {primaryItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`} aria-label={item.name} aria-current={active ? 'page' : undefined}>
              <span className={styles.navIcon}><Icon name={item.icon} /></span>
              <span className={styles.navLabel}>{item.shortName}</span>
            </Link>
          );
        })}
        <button ref={notificationButtonRef} type="button" className={`${styles.navItem} ${showNotifications ? styles.navItemActive : ''}`} onClick={() => { setMoreOpen(false); setShowNotifications((open) => !open); }} aria-label="Notifications" aria-expanded={showNotifications}>
          <span className={styles.navIcon}>
            <Icon name="notifications" />
            {unreadCount > 0 ? <span className={styles.unreadDot} aria-label={`${unreadCount} unread notifications`} /> : null}
          </span>
          <span className={styles.navLabel}>Alerts</span>
        </button>
        <button type="button" className={`${styles.navItem} ${moreOpen || moreIsActive ? styles.navItemActive : ''}`} onClick={() => { setShowNotifications(false); setMoreOpen((open) => !open); }} aria-label={moreTitle} aria-expanded={moreOpen}>
          <span className={styles.navIcon}><Icon name="more" /></span>
          <span className={styles.navLabel}>More</span>
        </button>
      </nav>
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        anchorRef={notificationButtonRef}
        onUnreadCountChange={setUnreadCount}
        activityRole={activityRole}
      />
    </>
  );
}
