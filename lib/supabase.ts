'use client';

import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Canonical public origin used in OAuth redirects (set per deployment). */
export function getAuthRedirectOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}
