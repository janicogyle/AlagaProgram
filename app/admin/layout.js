'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import styles from './layout.module.css';
// import { authHelpers } from '@/lib/supabaseClient';


export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user] = useState({
    name: 'Admin User',
    role: 'Administrator',
    email: 'admin@barangaystarita.gov.ph'
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

  // Basic role-based guard for admin-only pages (ready for backend auth)
  useEffect(() => {
    const isStaff = user?.role === 'Staff';
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
      // TODO: Implement actual Supabase logout
      // await authHelpers.signOut();
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
