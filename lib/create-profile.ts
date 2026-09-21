import { supabase } from '@/lib/supabase';

type CreateProfileResult =
  | { ok: true; is_verified: boolean }
  | { ok: false; error: string };

export async function ensureProfile(userId: string, fallbackName: string) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (profile) return;

  await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: fallbackName,
      is_active: true,
      is_online: true,
      avatar_urls: ['https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600'],
      interests: [],
      languages: [],
      notif_messages: true,
      notif_likes: true,
      notif_matches: true,
      show_age: true,
      show_online_status: true,
      show_distance: true,
      notif_events: true,
    },
    { onConflict: 'id' }
  );
}

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
