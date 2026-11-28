'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let active = true;
    let cleanupRegistration: (() => void) | undefined;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        if (!active) return;
        void registration.update().catch(() => undefined);
        const updateTimer = window.setInterval(() => { void registration.update().catch(() => undefined); }, 5 * 60 * 1000);
        const onFocus = () => { void registration.update().catch(() => undefined); };
        const hadController = Boolean(navigator.serviceWorker.controller);
        let reloadedForUpdate = false;
        const onControllerChange = () => {
          if (!hadController || reloadedForUpdate) return;
          reloadedForUpdate = true;
          window.location.reload();
        };
        window.addEventListener('focus', onFocus);
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        // Keep the periodic checks and listeners scoped to this mounted app.
        const cleanup = () => {
          window.clearInterval(updateTimer);
          window.removeEventListener('focus', onFocus);
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        };
        cleanupRegistration = cleanup;
        window.addEventListener('pagehide', cleanup, { once: true });
      } catch (error) {
        console.warn('[PWA] Service worker registration failed.', error);
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      active = false;
      window.removeEventListener('load', register);
      cleanupRegistration?.();
    };
  }, []);

  return null;
}
