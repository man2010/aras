import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin');
  if (adminCheckError || !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
  }

  let body: { userIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds)
    ? Array.from(new Set(body.userIds.filter((id): id is string => typeof id === 'string' && uuidPattern.test(id))))
    : [];
  if (userIds.length === 0 || userIds.length > 50) {
    return NextResponse.json({ error: 'Liste de comptes invalide.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Lecture des contacts indisponible.' }, { status: 503 });
  }

  const contacts = await Promise.all(userIds.map(async (id) => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || !data.user) return [id, { value: null, method: null }] as const;

    const authUser = data.user;
    const provider = String(authUser.app_metadata?.provider ?? authUser.identities?.[0]?.provider ?? '').toLowerCase();
    const usesPhone = provider === 'phone' || (!authUser.email && Boolean(authUser.phone));
    return [id, {
      value: usesPhone ? authUser.phone ?? null : authUser.email ?? authUser.phone ?? null,
      method: usesPhone ? 'phone' : authUser.email ? 'email' : authUser.phone ? 'phone' : null,
    }] as const;
  }));

  return NextResponse.json({ contacts: Object.fromEntries(contacts) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
