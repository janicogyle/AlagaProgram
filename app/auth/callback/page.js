'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    let cancelled = false;

    const redirectToLoginWithNotice = (notice) => {
      const params = new URLSearchParams({ notice });
      router.replace(`/login?${params.toString()}`);
    };

    const finishSignIn = async () => {
      try {
        if (!supabase) throw new Error('Supabase is not configured.');

        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const type = searchParams.get('type') || 'beneficiary';
        const next = searchParams.get('next') || (type === 'admin' ? '/admin' : '/beneficiary/dashboard');
        const { data, error } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (error || !token) throw error || new Error('Google session was not created.');

        if (type === 'signup-email') {
          const response = await fetch('/api/signup/email-verification', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error || 'Unable to verify Gmail.');

          if (typeof window !== 'undefined' && result?.data?.email && result?.data?.token) {
            window.sessionStorage.setItem('alaga-signup-verified-email', result.data.email);
            window.sessionStorage.setItem('alaga-signup-email-verification-token', result.data.token);
          }

          await supabase.auth.signOut();
          if (!cancelled) router.replace('/signup?notice=gmail-verified');
          return;
        }

        if (type === 'beneficiary') {
          const response = await fetch('/api/beneficiary/oauth-login', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            if (
              result?.code === 'GOOGLE_EMAIL_NOT_LINKED' ||
              result?.code === 'GOOGLE_SIGNUP_PENDING' ||
              result?.code === 'GOOGLE_SIGNUP_INCOMPLETE'
            ) {
              await supabase.auth.signOut();
              const notice =
                result.code === 'GOOGLE_SIGNUP_PENDING'
                  ? 'google-signup-pending'
                  : result.code === 'GOOGLE_SIGNUP_INCOMPLETE'
                    ? 'google-signup-incomplete'
                    : 'google-email-not-linked';
              if (!cancelled) redirectToLoginWithNotice(notice);
              return;
            }
            throw new Error(result?.error || 'Unable to complete beneficiary sign-in.');
          }

          const resident = result?.data;
          if (typeof window !== 'undefined' && resident) {
            window.localStorage.setItem('beneficiaryResidentId', String(resident.id));
            window.localStorage.setItem('beneficiaryContactNumber', resident.contact_number || '');
            window.localStorage.setItem(
              'beneficiaryName',
              `${resident.first_name || ''} ${resident.last_name || ''}`.trim(),
            );
            window.sessionStorage.setItem('alaga-welcome-toast-pending', 'true');
          }
        }

        if (!cancelled) router.replace(next);
      } catch (error) {
        console.error('OAuth callback error:', error);
        if (!cancelled) {
          setMessage(error?.message || 'Sign-in failed. Redirecting back to login...');
          window.setTimeout(() => router.replace('/login'), 2500);
        }
      }
    };

    finishSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
      <p style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>{message}</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>Completing sign-in...</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
