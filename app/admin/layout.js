import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from '@/lib/adminSession.server';

export const metadata = {
  title: 'Alaga Admin - Barangay Sta. Rita',
  description: 'Administration portal for the Barangay Sta. Rita Alaga Program.',
  manifest: '/admin-manifest.json',
};

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const session = readAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session.ok) {
    redirect('/admin-login');
  }

  return <AdminShell initialUser={session.user}>{children}</AdminShell>;
}
