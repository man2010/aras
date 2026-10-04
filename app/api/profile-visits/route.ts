import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

async function getAuthenticatedUser(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) return null;
  const auth = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(accessToken);
  return error ? null : user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Chargement des visites indisponible.' }, { status: 503 });
  const { data, error } = await admin.from('profile_visits')
    .select('visitor_id,last_viewed_at')
    .eq('profile_id', user.id)
    .order('last_viewed_at', { ascending: false });
  if (error) {
    console.error('Impossible de charger les visites du profil :', error);
    return NextResponse.json({ error: 'Impossible de charger les visites.' }, { status: 503 });
  }
  return NextResponse.json({ visits: data ?? [] });
}

export async function POST(request: Request) {
  let body: { profileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (typeof body.profileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.profileId)) {
    return NextResponse.json({ error: 'Profil invalide.' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  if (user.id === body.profileId) return NextResponse.json({ recorded: false });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Enregistrement des visites indisponible.' }, { status: 503 });
  const { error } = await admin.from('profile_visits').upsert(
    { visitor_id: user.id, profile_id: body.profileId, last_viewed_at: new Date().toISOString() },
    { onConflict: 'visitor_id,profile_id' },
  );
  if (error) {
    console.error('Impossible d’enregistrer la visite du profil :', error);
    return NextResponse.json({ error: 'Impossible d’enregistrer cette visite.' }, { status: 503 });
  }
  return NextResponse.json({ recorded: true });
}
