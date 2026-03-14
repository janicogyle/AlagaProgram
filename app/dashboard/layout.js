'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import styles from './layout.module.css';
import { supabase } from '@/lib/supabaseClient';

const formatRole = (role) => {
  if (!role) {
    return 'Authorized User';
  }

  return String(role)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};


export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState({
    name: 'Loading...',
    role: 'Authorized User',
    email: '',
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!sessionUser) {
        router.replace('/login');
        return;
      }

      const fullName =
        sessionUser.user_metadata?.full_name ||
        sessionUser.user_metadata?.name ||
        sessionUser.email ||
        'Authorized User';
      const role = sessionUser.app_metadata?.role || sessionUser.user_metadata?.role;

      setUser({
        name: fullName,
        role: formatRole(role),
        email: sessionUser.email || '',
      });
      setIsAuthReady(true);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
        return;
      }

      loadUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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

  // Close sidebar when clicking overlay on mobile
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Local scope guarantees the client session is cleared even if token revocation fails.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Logout warning:', error);
      }

      // Use full-page navigation to ensure middleware sees the latest auth cookies.
      window.location.assign('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.assign('/login');
    }
  };

  if (!isAuthReady) {
    return (
      <div className={styles.layout}>
        <div className={styles.mainContent}>
          <main className={styles.pageContent}>Loading secure session...</main>
        </div>
      </div>
    );
  }

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
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
}
