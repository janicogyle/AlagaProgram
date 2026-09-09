'use client';

import { useState, useSyncExternalStore } from 'react';
import styles from './CookieConsentBanner.module.css';
import Button from './Button';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const COOKIE_CONSENT_KEY = 'cookie_consent';
const COOKIE_CONSENT_EVENT = 'cookie-consent-change';

function subscribeToConsent(onStoreChange) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
  };
}

function getConsentSnapshot() {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) !== 'true';
  } catch {
    return false;
  }
}

function getServerConsentSnapshot() {
  return false;
}

export default function CookieConsentBanner() {
  const showBanner = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot);
  const [isPrivacyModalOpen, setPrivacyModalOpen] = useState(false);

  const handleAccept = () => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
      window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    } catch (error) {
      console.error('Could not write to localStorage:', error);
    }
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
            <h3 className={styles.heading}>Essential cookies and storage</h3>
            <p className={styles.text}>
              ALAGA uses essential cookies and limited browser storage for secure sign-in, sessions, preferences, and
              service operation. These are not used for behavioral advertising. Learn more in the{' '}
              <a href="#" onClick={openPrivacyModal} className={styles.link}>
                Data Privacy Notice
              </a>
              .
            </p>
          </div>
          <div className={styles.actions}>
            <Button onClick={handleAccept} size="small">
              Got it
            </Button>
          </div>
        </div>
      </div>
      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={closePrivacyModal} />
    </>
  );
}
