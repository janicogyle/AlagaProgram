'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/analytics');
  }, [router]);

  return <p style={{ padding: '16px' }}>Redirecting to Analytics Dashboard…</p>;
}
