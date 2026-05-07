'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BeneficiaryIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/beneficiary/dashboard');
  }, [router]);

  return <p style={{ padding: '16px' }}>Redirecting to your dashboard…</p>;
}
