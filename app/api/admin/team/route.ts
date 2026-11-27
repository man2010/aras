import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getApplicationUrl } from '@/lib/application-url';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
type AuthResult = { admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>; actorId: string; actorContact: string } | { response: NextResponse };

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
  return { admin, actorId: user.id, actorContact: user.email || user.phone || user.id };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!('admin' in auth)) return auth.response;
  const requestUrl = new URL(request.url);
  const rawOffset = requestUrl.searchParams.get('actionsOffset') ?? '0';
  const actionsOffset = Number.parseInt(rawOffset, 10);
  if (!Number.isSafeInteger(actionsOffset) || actionsOffset < 0) {
    return NextResponse.json({ error: 'Position du journal invalide.' }, { status: 400 });
  }
  let members: Array<Record<string, unknown>> = [];
  if (actionsOffset === 0) {
    const { data, error } = await auth.admin.from('admin_roles').select('user_id,role,created_at').order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    members = await Promise.all((data ?? []).map(async (entry) => {
      const { data: result } = await auth.admin.auth.admin.getUserById(entry.user_id);
      const user = result.user;
      const factors = user?.factors ?? [];
      return {
        ...entry,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        last_sign_in_at: user?.last_sign_in_at ?? null,
        mfa_enabled: factors.some((factor) => factor.status === 'verified'),
        invited_at: user?.invited_at ?? null,
        email_confirmed_at: user?.email_confirmed_at ?? user?.phone_confirmed_at ?? null,
      };
    }));
  }
  const pageSize = 50;
  const { data: actions, count: actionCount, error: actionsError } = await auth.admin
    .from('admin_team_access_logs')
    .select('id,actor_id,actor_contact,target_user_id,target_contact,action,old_role,new_role,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(actionsOffset, actionsOffset + pageSize - 1);
  if (actionsError) return NextResponse.json({ error: `Journal d’accès indisponible : ${actionsError.message}` }, { status: 500 });
  const rows = actions ?? [];
  const totalActions = actionCount ?? 0;
  const nextActionsOffset = actionsOffset + rows.length;
  return NextResponse.json({ members, actions: rows, actionsOffset, nextActionsOffset, totalActions, hasMoreActions: nextActionsOffset < totalActions }, { headers: { 'Cache-Control': 'private, no-store' } });
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
  let targetUserId = user?.id ?? null;
  let action: 'invited' | 'role_assigned' | 'role_changed' = 'role_assigned';
  let oldRole: string | null = null;
  let targetContact = user?.email || user?.phone || contact;

  if (!user) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      return NextResponse.json({ error: 'Un nouveau membre de l’équipe doit être invité par e-mail. Le téléphone est accepté pour un compte déjà créé.' }, { status: 400 });
    }
    const appUrl = getApplicationUrl(new URL(request.url).origin);
    const { data: invited, error: inviteError } = await auth.admin.auth.admin.inviteUserByEmail(contact.toLowerCase(), {
      redirectTo: `${appUrl}/auth/callback?next=%2Fadmin`,
    });
    if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message || 'Invitation par e-mail impossible.' }, { status: 500 });
    targetUserId = invited.user.id;
    targetContact = invited.user.email || contact.toLowerCase();
    action = 'invited';
  } else {
    const { data: existing } = await auth.admin.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle();
    oldRole = existing?.role ?? null;
    if (user.id === auth.actorId && role !== 'admin') {
      return NextResponse.json({ error: 'Vous ne pouvez pas réduire votre propre rôle administrateur.' }, { status: 400 });
    }
    if (oldRole === 'admin' && role !== 'admin') {
      const { count, error: countError } = await auth.admin.from('admin_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
      if (countError) return NextResponse.json({ error: 'Impossible de vérifier les administrateurs actifs.' }, { status: 500 });
      if ((count ?? 0) <= 1) return NextResponse.json({ error: 'Le dernier administrateur ne peut pas changer de rôle.' }, { status: 400 });
    }
    action = oldRole ? (oldRole === role ? 'role_assigned' : 'role_changed') : 'role_assigned';
  }

  if (!targetUserId) return NextResponse.json({ error: 'Compte cible introuvable.' }, { status: 500 });
  const { data: previousRole } = await auth.admin.from('admin_roles').select('role').eq('user_id', targetUserId).maybeSingle();
  const { error } = await auth.admin.from('admin_roles').upsert({ user_id: targetUserId, role }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: auditError } = await auth.admin.from('admin_team_access_logs').insert({
    actor_id: auth.actorId,
    actor_contact: auth.actorContact,
    target_user_id: targetUserId,
    target_contact: targetContact,
    action,
    old_role: previousRole?.role ?? oldRole,
    new_role: role,
  });
  if (auditError) return NextResponse.json({ error: `Le rôle a été appliqué, mais le journal n’a pas pu être mis à jour : ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, invited: action === 'invited' });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (!('admin' in auth)) return auth.response;
  let body: { userId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  if (typeof body.userId !== 'string' || body.userId === auth.actorId) return NextResponse.json({ error: 'Identifiant invalide ou retrait de votre propre accès interdit.' }, { status: 400 });
  const { data: target } = await auth.admin.from('admin_roles').select('role').eq('user_id', body.userId).maybeSingle();
  if (target?.role === 'admin') {
    const { count, error: countError } = await auth.admin.from('admin_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
    if (countError) return NextResponse.json({ error: 'Impossible de vérifier les administrateurs actifs.' }, { status: 500 });
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'Le dernier administrateur ne peut pas être retiré.' }, { status: 400 });
  }
  const { data: targetAuth } = await auth.admin.auth.admin.getUserById(body.userId);
  const targetContact = targetAuth.user?.email || targetAuth.user?.phone || body.userId;
  const { error } = await auth.admin.from('admin_roles').delete().eq('user_id', body.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: auditError } = await auth.admin.from('admin_team_access_logs').insert({
    actor_id: auth.actorId,
    actor_contact: auth.actorContact,
    target_user_id: body.userId,
    target_contact: targetContact,
    action: 'access_removed',
    old_role: target?.role ?? null,
  });
  if (auditError) return NextResponse.json({ error: `L’accès a été retiré, mais le journal n’a pas pu être mis à jour : ${auditError.message}` }, { status: 500 });
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
