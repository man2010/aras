'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let active = true;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        if (!active) return;
        void registration.update().catch(() => undefined);
      } catch (error) {
        console.warn('[PWA] Service worker registration failed.', error);
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      active = false;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
