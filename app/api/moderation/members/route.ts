import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

type ProfileRow = {
  id: string;
  full_name: string | null;
  gender: string | null;
  birthdate: string | null;
  city: string | null;
  profession: string | null;
  avatar_urls: string[] | null;
  profile_status: string | null;
  onboarding_completed: boolean | null;
};

type ContactMethod = 'email' | 'phone' | null;

function getLoginContact(user: { email?: string; phone?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown>; identities?: { provider?: string }[] }) {
  const provider = String(user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? '').toLowerCase();
  const usesPhone = user.user_metadata?.auth_method === 'phone' || provider === 'phone' || (!user.email && Boolean(user.phone));
  if (usesPhone) return { authContact: user.phone ?? null, authContactMethod: user.phone ? 'phone' as ContactMethod : null };
  if (user.email) return { authContact: user.email, authContactMethod: 'email' as ContactMethod };
  if (user.phone) return { authContact: user.phone, authContactMethod: 'phone' as ContactMethod };
  return { authContact: null, authContactMethod: null as ContactMethod };
}

function matchesContact(user: { email?: string; phone?: string }, query: string) {
  return `${user.email ?? ''} ${user.phone ?? ''}`.toLocaleLowerCase('fr').includes(query);
}

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  const { data: role, error: roleError } = await userClient.rpc('current_staff_role');
  if (roleError || (role !== 'admin' && role !== 'moderator')) return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });

  let body: { query?: unknown; gender?: unknown; incompleteOnly?: unknown; contactMethod?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 120).toLocaleLowerCase('fr') : '';
  const gender = body.gender === 'Homme' || body.gender === 'Femme' ? body.gender : null;
  const incompleteOnly = body.incompleteOnly === true;
  const contactMethod: ContactMethod | 'all' = body.contactMethod === 'email' || body.contactMethod === 'phone' ? body.contactMethod : 'all';
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Recherche de membres indisponible.' }, { status: 503 });

  let profileQuery = admin.from('profiles').select('id,full_name,gender,birthdate,city,profession,avatar_urls,profile_status,onboarding_completed').eq('is_active', true).eq('is_temporarily_deactivated', false).order('created_at', { ascending: false });
  if (gender) profileQuery = profileQuery.eq('gender', gender);
  if (incompleteOnly) profileQuery = profileQuery.or('onboarding_completed.eq.false,onboarding_completed.is.null,profile_status.neq.completed,profile_status.is.null');
  if (query) profileQuery = profileQuery.ilike('full_name', `%${query.replace(/[%_,]/g, ' ')}%`);
  const { data: nameRows, error: profileError } = await profileQuery.limit(30);
  if (profileError) return NextResponse.json({ error: 'Recherche de membres indisponible.' }, { status: 503 });

  const profileById = new Map((nameRows ?? []).map((row) => [row.id, row as ProfileRow]));
  if (query) {
    const normalizedPhoneQuery = query.replace(/[\s()+.-]/g, '');
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return NextResponse.json({ error: 'Recherche de membres indisponible.' }, { status: 503 });
      const matchingIds = data.users.filter((authUser) => {
        const normalizedPhone = (authUser.phone ?? '').replace(/[\s()+.-]/g, '');
        return matchesContact(authUser, query) || (normalizedPhoneQuery.length >= 4 && normalizedPhone.includes(normalizedPhoneQuery));
      }).map((authUser) => authUser.id);
      const missingIds = matchingIds.filter((id) => !profileById.has(id));
      if (missingIds.length) {
        let matchesQuery = admin.from('profiles').select('id,full_name,gender,birthdate,city,profession,avatar_urls,profile_status,onboarding_completed').in('id', missingIds).eq('is_active', true).eq('is_temporarily_deactivated', false);
        if (gender) matchesQuery = matchesQuery.eq('gender', gender);
        if (incompleteOnly) matchesQuery = matchesQuery.or('onboarding_completed.eq.false,onboarding_completed.is.null,profile_status.neq.completed,profile_status.is.null');
        const { data: contactRows, error: contactError } = await matchesQuery.limit(30 - profileById.size);
        if (contactError) return NextResponse.json({ error: 'Recherche de membres indisponible.' }, { status: 503 });
        for (const row of contactRows ?? []) {
          if (profileById.size >= 30) break;
          profileById.set(row.id, row as ProfileRow);
        }
      }
      if (profileById.size >= 30 || data.users.length < 1000) break;
    }
  }

  const rows = Array.from(profileById.values()).slice(0, 30);
  const members = await Promise.all(rows.map(async (profile) => {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    const contact = data.user ? getLoginContact(data.user) : { authContact: null, authContactMethod: null as ContactMethod };
    return { ...profile, ...contact };
  }));
  const filteredMembers = contactMethod === 'all' ? members : members.filter((member) => member.authContactMethod === contactMethod);
  return NextResponse.json({ members: filteredMembers }, { headers: { 'Cache-Control': 'private, no-store' } });
}
