'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import styles from './layout.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function AdminShell({ children, initialUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(initialUser || null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

    const adminOnlyPaths = ['/admin/account-requests', '/admin/users'];
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

  if (!authChecked || !user) return null;

  return (
    <div className={styles.layout}>
      {isMobile && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />
      )}
      <Sidebar user={user} onLogout={handleLogout} minimized={!sidebarOpen} />
      <div className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}>
        <Navbar onMenuClick={() => setSidebarOpen((open) => !open)} activityRole={user.role} />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
