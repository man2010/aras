import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
type AuthResult = { admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>; actorId: string } | { response: NextResponse };

async function authorize(request: Request): Promise<AuthResult> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || !url || !anon) return { response: NextResponse.json({ error: 'Session requise.' }, { status: 401 }) };
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  const { data: isAdmin } = await client.rpc('is_admin');
  if (!isAdmin) return { response: NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { response: NextResponse.json({ error: 'Gestion de l’équipe indisponible.' }, { status: 503 }) };
  return { admin, actorId: user.id };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!('admin' in auth)) return auth.response;
  const { data, error } = await auth.admin.from('admin_roles').select('user_id,role,created_at').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const members = await Promise.all((data ?? []).map(async (entry) => {
    const { data: result } = await auth.admin.auth.admin.getUserById(entry.user_id);
    return { ...entry, email: result.user?.email ?? null, phone: result.user?.phone ?? null, last_sign_in_at: result.user?.last_sign_in_at ?? null };
  }));
  return NextResponse.json({ members }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!('admin' in auth)) return auth.response;
  let body: { contact?: unknown; role?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const role = body.role === 'moderator' ? 'moderator' : body.role === 'admin' ? 'admin' : null;
  if (!contact || !role || contact.length > 200) return NextResponse.json({ error: 'Indiquez un e-mail ou téléphone et un rôle valide.' }, { status: 400 });
  const user = await findAuthUser(auth.admin, contact);
  if (!user) return NextResponse.json({ error: 'Aucun compte ARAS ne correspond à cet e-mail ou téléphone.' }, { status: 404 });
  const { error } = await auth.admin.from('admin_roles').upsert({ user_id: user.id, role }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (!('admin' in auth)) return auth.response;
  let body: { userId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  if (typeof body.userId !== 'string' || body.userId === auth.actorId) return NextResponse.json({ error: 'Identifiant invalide ou retrait de votre propre accès interdit.' }, { status: 400 });
  const { error } = await auth.admin.from('admin_roles').delete().eq('user_id', body.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function findAuthUser(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, contact: string) {
  const targetEmail = contact.toLowerCase();
  const targetPhone = contact.replace(/[\s()-]/g, '');
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail || user.phone?.replace(/[\s()-]/g, '') === targetPhone);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}
