'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './CookieConsentBanner.module.css';
import Button from './Button';

const COOKIE_CONSENT_KEY = 'cookie_consent';

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      if (consent !== 'true') {
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Could not access localStorage:', error);
    }
  }, []);

  const handleAccept = () => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    } catch (error) {
      console.error('Could not write to localStorage:', error);
    }
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.text}>
          We use essential cookies to make our site work. By using our site, you acknowledge and agree to our use of
          cookies. You can learn more in our{' '}
          <Link href="/privacy-policy" className={styles.link}>
            Privacy Policy
          </Link>
          .
        </p>
        <div className={styles.actions}>
          <Button onClick={handleAccept} size="small">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
