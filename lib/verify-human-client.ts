type VerifyHumanResult =
  | { ok: true; humanVerified: boolean; proof: string }
  | { ok: false; error: string };

/** Envoie le jeton Turnstile au serveur et récupère une preuve signée (flux OTP-friendly). */
export async function requestHumanVerification(turnstileToken: string): Promise<VerifyHumanResult> {
  const response = await fetch('/api/auth/verify-human', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken }),
  });

  const payload = (await response.json()) as {
    error?: string;
    humanVerified?: boolean;
    proof?: string;
  };

  if (!response.ok) {
    return { ok: false, error: payload.error ?? 'Vérification anti-robot impossible.' };
  }

  if (!payload.proof) {
    return { ok: false, error: 'Réponse serveur incomplète.' };
  }

  return {
    ok: true,
    humanVerified: Boolean(payload.humanVerified),
    proof: payload.proof,
  };
}
