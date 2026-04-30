'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import styles from './layout.module.css';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Load admin user from localStorage (set on login)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ensureAdminSession = async () => {
      try {
        const raw = localStorage.getItem('adminUser');
        if (!raw) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (error || !session) {
          localStorage.removeItem('adminUser');
          router.replace('/login');
          return;
        }

        const stored = JSON.parse(raw);
        // Defer state update to avoid cascading render warnings from strict hook lint rules
        setTimeout(() => {
          setUser({
            name: stored.full_name || stored.name || 'User',
            role: stored.role || 'Staff',
            email: stored.email,
            id: stored.id,
          });
        }, 0);
      } catch (e) {
        console.error('Failed to validate admin session:', e);
        localStorage.removeItem('adminUser');
        router.replace('/login');
      } finally {
        setAuthChecked(true);
      }
    };

    ensureAdminSession();
  }, [router]);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile
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

  // Role-based guard for admin-only pages
  useEffect(() => {
    if (!user) return;

    const isStaff = user.role === 'Staff';
    if (!isStaff) return;

    const adminOnlyPaths = ['/admin/account-requests', '/admin/users'];
    if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
      router.replace('/admin/analytics');
    }
  }, [user, pathname, router]);

  // Close sidebar when clicking overlay on mobile
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out from Supabase Auth
      if (supabase) {
        await supabase.auth.signOut();
      }

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminUser');
      }

      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect even if there's an error
      router.push('/login');
    }
  };

  if (!authChecked || !user) return null;

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      {isMobile && (
        <div
          className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />
      )}
      <Sidebar user={user} onLogout={handleLogout} minimized={!sidebarOpen} />
      <div className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarMinimized : ''}`}>
        <Navbar onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
