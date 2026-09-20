'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { turnstileSiteKey } from '@/lib/turnstile-public';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible' | 'compact';
      language?: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type HumanVerificationProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
};

export function HumanVerification({ onToken, onExpire, onError, className }: HumanVerificationProps) {
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (!turnstileSiteKey) {
      onError?.();
      return;
    }

    const container = document.getElementById(containerId);
    if (!container || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      size: 'flexible',
      language: 'fr',
      callback: (token) => onToken(token),
      'expired-callback': () => {
        onExpire?.();
        onToken('');
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
      'error-callback': () => {
        onError?.();
        onToken('');
      },
    });
  }, [containerId, onError, onExpire, onToken]);

  useEffect(() => {
    if (!turnstileSiteKey) return;

    const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);

    const initialize = () => {
      if (window.turnstile) {
        renderWidget();
      }
    };

    if (existingScript) {
      if (window.turnstile) {
        renderWidget();
      } else {
        existingScript.addEventListener('load', initialize, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => onError?.();
    document.body.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [onError, renderWidget]);

  return <div id={containerId} className={className} />;
}
