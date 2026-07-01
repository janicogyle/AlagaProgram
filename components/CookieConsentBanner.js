'use client';

import { useState } from 'react';
import styles from './CookieConsentBanner.module.css';
import Button from './Button';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const COOKIE_CONSENT_KEY = 'cookie_consent';
const COOKIE_DECLINED_KEY = 'cookie_declined';

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      const declined = window.sessionStorage.getItem(COOKIE_DECLINED_KEY);
      return consent !== 'true' && declined !== 'true';
    } catch {
      return false;
    }
  });
  const [isPrivacyModalOpen, setPrivacyModalOpen] = useState(false);

  const handleAccept = () => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    } catch (error) {
      console.error('Could not write to localStorage:', error);
    }
    setShowBanner(false);
  };

  const handleDecline = () => {
    try {
      window.sessionStorage.setItem(COOKIE_DECLINED_KEY, 'true');
    } catch (error) {
      console.error('Could not write to sessionStorage:', error);
    }
    setShowBanner(false);
  };

  const openPrivacyModal = (e) => {
    e.preventDefault();
    setPrivacyModalOpen(true);
  };

  const closePrivacyModal = () => {
    setPrivacyModalOpen(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      <div className={styles.banner}>
        <div className={styles.content}>
          <div className={styles.textContainer}>
            <h3 className={styles.heading}>Cookie Consent</h3>
            <p className={styles.text}>
              We use essential cookies to make our site work. By using our site, you acknowledge and agree to our use of
              cookies. You can learn more in our{' '}
              <a href="#" onClick={openPrivacyModal} className={styles.link}>
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <div className={styles.actions}>
            <Button onClick={handleDecline} variant="secondary" size="small">
              Decline
            </Button>
            <Button onClick={handleAccept} size="small">
              Accept
            </Button>
          </div>
        </div>
      </div>
      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={closePrivacyModal} />
    </>
  );
}
