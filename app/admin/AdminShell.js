'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import WelcomeToast from '@/components/WelcomeToast';
import styles from './layout.module.css';
import { supabase } from '@/lib/supabaseClient';

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

    const ensureAdminSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (error || !session) {
          localStorage.removeItem('adminUser');
          await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
          router.replace('/admin-login');
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
          !['Admin', 'Staff'].includes(profile.role)
        ) {
          localStorage.removeItem('adminUser');
          await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
          await supabase.auth.signOut();
          router.replace('/admin-login');
          return;
        }

        localStorage.setItem('adminUser', JSON.stringify(profile));
        setTimeout(() => {
          setUser({
            name: profile.full_name || profile.name || 'User',
            role: profile.role || 'Staff',
            email: profile.email,
            id: profile.id,
            sector_access: profile.sector_access || [],
          });
        }, 0);
      } catch (e) {
        console.error('Failed to validate admin session:', e);
        localStorage.removeItem('adminUser');
        await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
        router.replace('/admin-login');
      } finally {
        setAuthChecked(true);
      }
    };

    ensureAdminSession();
  }, [router]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900;
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

    const isStaff = user.role === 'Staff';
    if (!isStaff) return;

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
      await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});

      if (supabase) {
        await supabase.auth.signOut();
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

  if (!authChecked || !user) return <AdminShellLoading />;

  return (
    <div className={styles.layout}>
      <WelcomeToast />
      {loggingOut && <LogoutOverlay />}
      {isMobile && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />
      )}
      <Sidebar user={user} onLogout={handleLogout} minimized={!sidebarOpen} />
      <div className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}>
        <Navbar
          onMenuClick={() => setSidebarOpen((open) => !open)}
          activityRole={user.role}
          theme={theme}
          onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
        />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
