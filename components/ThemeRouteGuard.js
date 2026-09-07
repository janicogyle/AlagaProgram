'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const isPortalPath = (pathname) =>
  pathname === '/admin' ||
  pathname?.startsWith('/admin/') ||
  pathname === '/beneficiary' ||
  pathname?.startsWith('/beneficiary/');

export default function ThemeRouteGuard() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (isPortalPath(pathname)) return;

    // Public pages intentionally use the light theme. Keep the saved portal
    // preference so it can be restored when the user signs in again.
    document.documentElement.removeAttribute('data-theme');
  }, [pathname]);

  return null;
}
