'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import styles from './layout.module.css';
// import { authHelpers } from '@/lib/supabaseClient';


export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [user] = useState({
    name: 'Admin User',
    role: 'Administrator',
    email: 'admin@barangaystarita.gov.ph'
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
