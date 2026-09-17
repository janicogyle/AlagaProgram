'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in window.navigator)) return;

    window.navigator.serviceWorker.register('/alaga-sw.js').catch((error) => {
      console.warn('Unable to register the Alaga service worker', error);
    });
  }, []);

  return null;
}
