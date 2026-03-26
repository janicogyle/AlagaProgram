'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResidentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/assistance/requests');
  }, [router]);

  return <p style={{ padding: '16px' }}>Redirecting to Assistance Requests…</p>;
}
