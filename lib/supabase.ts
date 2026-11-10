'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getApplicationUrl } from '@/lib/application-url';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Canonical public origin used in OAuth redirects (set per deployment). */
export function getAuthRedirectOrigin() {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return getApplicationUrl(currentOrigin);
}
