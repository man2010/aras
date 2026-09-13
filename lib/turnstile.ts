type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

/** Vérifie un jeton Turnstile côté serveur (Cloudflare). */
export async function verifyTurnstileToken(token: string, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY manquant — vérification humaine désactivée.');
    return false;
  }

  const trimmed = token.trim();
  if (!trimmed) return false;

  const body = new URLSearchParams({
    secret,
    response: trimmed,
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) return false;

    const data = (await response.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
