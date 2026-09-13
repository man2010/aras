/** Clé site Turnstile (publique). Clé de test Cloudflare si non configurée. */
export const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
  '1x00000000000000000000AA';
