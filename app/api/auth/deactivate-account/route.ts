import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = getSupabaseAdmin();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  if (!admin) return NextResponse.json({ error: 'Cette action est momentanément indisponible.' }, { status: 503 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const { data: profile, error } = await admin.from('profiles').select('is_active').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Impossible de vérifier le compte.' }, { status: 503 });
  if (!profile || profile.is_active === false) return NextResponse.json({ error: 'Ce compte est bloqué ou indisponible.' }, { status: 403 });

  const { error: updateError } = await admin.from('profiles').update({ is_temporarily_deactivated: true, is_online: false, last_seen_at: new Date().toISOString() }).eq('id', user.id);
  if (updateError) return NextResponse.json({ error: 'La désactivation a échoué. Réessayez.' }, { status: 503 });
  await admin.from('account_sessions').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
