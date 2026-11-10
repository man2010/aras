const configuredApplicationUrl =
  process.env.NEXT_PUBLIC_APPLICATION_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || '';

/** Canonical public origin. NEXT_PUBLIC_SITE_URL remains a backwards-compatible fallback. */
export function getApplicationUrl(fallback = '') {
  const origin = configuredApplicationUrl || fallback;
  return origin.replace(/\/+$/, '');
}
