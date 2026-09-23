import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { parseHumanProof } from '@/lib/human-proof';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

const defaultAvatar =
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600';

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  }

  let body: { humanProof?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const displayName = String(body.displayName ?? '').trim() || 'Membre ARAS';
  const humanProof = String(body.humanProof ?? '').trim();

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 });
  }

  const parsedProof = parseHumanProof(humanProof);
  if (parsedProof === null) {
    return NextResponse.json(
      { error: 'Vérification anti-robot expirée ou invalide. Revenez à l’étape précédente.' },
      { status: 400 }
    );
  }
  const humanVerified = parsedProof;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Création de profil sécurisée indisponible (clé service manquante).' },
      { status: 503 }
    );
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from('profiles')
    .select('is_active,is_verified')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (existingProfileError) return NextResponse.json({ error: 'Impossible de vérifier le statut du compte.' }, { status: 503 });
  if (existingProfile?.is_active === false) {
    return NextResponse.json({ error: 'Votre compte est bloqué. Veuillez contacter contact@aras.sn pour obtenir de l’aide.' }, { status: 403 });
  }
  if (existingProfile) return NextResponse.json({ ok: true, is_verified: Boolean(existingProfile.is_verified) });

  const { error: profileError } = await admin.from('profiles').insert(
    {
      id: userData.user.id,
      full_name: displayName,
      is_active: true,
      is_online: true,
      avatar_urls: [defaultAvatar],
      interests: [],
      languages: [],
      notif_messages: true,
      notif_likes: true,
      notif_matches: true,
      show_age: true,
      show_online_status: true,
      show_distance: true,
      notif_events: true,
      profile_status: 'pending',
      onboarding_completed: false,
      is_verified: humanVerified,
    }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_verified: humanVerified });
}
