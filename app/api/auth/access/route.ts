import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  if (!serviceKey) return NextResponse.json({ error: 'Vérification du compte indisponible.' }, { status: 503 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error } = await admin.from('profiles').select('is_active').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Vérification du compte impossible.' }, { status: 503 });
  if (profile?.is_active === false) return NextResponse.json({ blocked: true }, { status: 403 });
  return NextResponse.json({ blocked: false });
}
