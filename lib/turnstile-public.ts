/** Clé site Turnstile (publique). En local, on utilise la clé de test Cloudflare pour garder le widget visible sans config de domaine. */
const testSiteKey = '1x00000000000000000000AA';
const envSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export const turnstileSiteKey =
  process.env.NODE_ENV === 'development' ? testSiteKey : envSiteKey || testSiteKey;
