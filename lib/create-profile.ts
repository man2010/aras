import { supabase } from '@/lib/supabase';

type CreateProfileResult =
  | { ok: true; is_verified: boolean }
  | { ok: false; error: string };

/** Crée ou met à jour le profil après inscription, avec vérification humaine côté serveur. */
export async function createProfileAfterSignup(
  displayName: string,
  humanProof: string
): Promise<CreateProfileResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: 'Session introuvable après inscription.' };
  }

  const response = await fetch('/api/auth/create-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ displayName, humanProof }),
  });

  const payload = (await response.json()) as { error?: string; is_verified?: boolean };
  if (!response.ok) {
    return { ok: false, error: payload.error ?? 'Impossible de créer le profil.' };
  }

  return { ok: true, is_verified: Boolean(payload.is_verified) };
}
