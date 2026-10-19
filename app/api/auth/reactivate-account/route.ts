import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = getSupabaseAdmin();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  if (!admin) return NextResponse.json({ error: 'Vérification du compte indisponible.' }, { status: 503 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const { data: profile, error } = await admin.from('profiles').select('is_active,is_temporarily_deactivated').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Vérification du compte impossible.' }, { status: 503 });
  if (!profile) return NextResponse.json({ error: 'Ce compte ne possède plus de profil ARAS.' }, { status: 403 });
  if (profile.is_active === false) return NextResponse.json({ error: 'Votre compte est bloqué. Veuillez contacter le support.' }, { status: 403 });

  if (profile.is_temporarily_deactivated) {
    const { error: updateError } = await admin.from('profiles').update({ is_temporarily_deactivated: false }).eq('id', user.id);
    if (updateError) return NextResponse.json({ error: 'La réactivation du compte a échoué.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, reactivated: Boolean(profile.is_temporarily_deactivated) });
}
