import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from '@/lib/adminSession.server';

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();
  const session = readAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session.ok) {
    redirect('/admin-login');
  }

  return <AdminShell initialUser={session.user}>{children}</AdminShell>;
}
