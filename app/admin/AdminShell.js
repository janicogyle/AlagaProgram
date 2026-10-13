'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import WelcomeToast from '@/components/WelcomeToast';
import MobileBottomNavigation from '@/components/MobileBottomNavigation';
import styles from './layout.module.css';
import { supabase } from '@/lib/supabaseClient';
import { isAdminRole, isPortalRole } from '@/lib/userRoles';

function AdminShellLoading() {
  return (
    <div className={styles.authLoading}>
      <div className={styles.authLoadingCard} role="status" aria-live="polite">
        <span className={styles.authSpinner} aria-hidden="true" />
        <div>
          <p className={styles.authLoadingTitle}>Signing you in...</p>
          <p className={styles.authLoadingText}>Preparing your dashboard</p>
        </div>
      </div>
    </div>
  );
}

function LogoutOverlay() {
  return (
    <div className={styles.logoutOverlay}>
      <div className={styles.authLoadingCard} role="status" aria-live="polite">
        <span className={styles.authSpinner} aria-hidden="true" />
        <div>
          <p className={styles.authLoadingTitle}>Signing you out...</p>
          <p className={styles.authLoadingText}>Ending your session securely</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ children, initialUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(initialUser || null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.classList.add('appShellActive');
    document.body.classList.add('appShellActive');
    return () => {
      document.documentElement.classList.remove('appShellActive');
      document.body.classList.remove('appShellActive');
      document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = localStorage.getItem('alagaTheme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = storedTheme || systemTheme;
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.dataset.theme = theme;
    localStorage.setItem('alagaTheme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const endInvalidSession = async (token = '') => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      window.localStorage.removeItem('adminUser');
      await fetch('/api/admin/session', {
        method: 'DELETE',
        headers,
        credentials: 'include',
      }).catch(() => {});
      await supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
      if (!cancelled) router.replace('/admin-login');
    };

    const ensureAdminSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (error || !session) {
          await endInvalidSession();
          return;
        }

        const profileResponse = await fetch('/api/admin/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const profileJson = await profileResponse.json().catch(() => ({}));
        const profile = profileJson?.data;

        if (
          !profileResponse.ok ||
          profileJson?.error ||
          !profile ||
          profile.status !== 'Active' ||
          !isPortalRole(profile.role)
        ) {
          await endInvalidSession(session.access_token);
          return;
        }

        if (String(profile.id) !== String(session.user.id)) {
          await endInvalidSession(session.access_token);
          return;
        }

        // Supabase is the source of truth. Reissue the server cookie from this
        // exact user so a stale Admin cookie cannot take over after refresh.
        const syncResponse = await fetch('/api/admin/session', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: 'include',
        });
        const syncPayload = await syncResponse.json().catch(() => ({}));
        const syncedUser = syncPayload?.data;
        if (
          !syncResponse.ok
          || syncPayload?.error
          || String(syncedUser?.id || '') !== String(profile.id)
          || syncedUser?.role !== profile.role
        ) {
          await endInvalidSession(session.access_token);
          return;
        }

        window.localStorage.setItem('adminUser', JSON.stringify(profile));
        if (!cancelled) {
          setUser({
            name: profile.full_name || profile.name || 'User',
            role: profile.role || 'Staff',
            email: profile.email,
            id: profile.id,
            sector_access: profile.sector_access || [],
          });
        }
      } catch (e) {
        console.error('Failed to validate admin session:', e);
        await endInvalidSession();
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    };

    void ensureAdminSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        window.innerWidth <= 900 ||
        (window.innerWidth <= 1366 && window.matchMedia('(pointer: coarse)').matches);
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (isAdminRole(user.role)) return;

    const adminOnlyPaths = ['/admin/account-requests', '/admin/renewal-requests', '/admin/users'];
    if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
      router.replace('/admin/analytics');
    }
  }, [user, pathname, router]);

  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const { data } = await supabase?.auth.getSession() || {};
      const token = data?.session?.access_token || '';
      await fetch('/api/admin/session', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      }).catch(() => {});

      if (supabase) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminUser');
      }

      router.push('/admin-login');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/admin-login');
    }
  };

  const adminOnlyPaths = ['/admin/account-requests', '/admin/renewal-requests', '/admin/users'];
  const isUnauthorizedAdminPath = Boolean(
    authChecked
    && user
    && !isAdminRole(user.role)
    && adminOnlyPaths.some((path) => pathname.startsWith(path)),
  );

  if (!authChecked || !user || isUnauthorizedAdminPath) return <AdminShellLoading />;

  return (
    <div className={styles.layout}>
      <a className="skipLink" href="#main-content">Skip to main content</a>
      <WelcomeToast />
      {loggingOut && <LogoutOverlay />}
      {isMobile && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />
      )}
      <Sidebar
        user={user}
        onLogout={handleLogout}
        onNavigate={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        minimized={!sidebarOpen}
        isMobile={isMobile}
      />
      <div className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}>
        <Navbar
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen((open) => !open)}
          activityRole={user.role}
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          hideMenuToggle={isMobile}
          hideActions={isMobile}
        />
        <main id="main-content" tabIndex={-1} className={styles.pageContent}>{children}</main>
      </div>
      {isMobile && (
        <MobileBottomNavigation
          user={user}
          onLogout={handleLogout}
          activityRole={user.role}
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
        />
      )}
    </div>
  );
}
