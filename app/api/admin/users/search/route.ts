import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const PAGE_SIZE = 1000;

type AuthContact = { value: string | null; method: 'email' | 'phone' | null };

export async function GET(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin');
  if (adminCheckError || !isAdmin) return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const search = (params.get('q') ?? '').trim().slice(0, 100);
  const gender = params.get('gender') ?? 'all';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  if (search.length < 2) return NextResponse.json({ profiles: [], total: 0, page });
  if (gender !== 'all' && gender !== 'Homme' && gender !== 'Femme') return NextResponse.json({ error: 'Filtre de genre invalide.' }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Recherche indisponible.' }, { status: 503 });

  // Search profile names in the database and login e-mail/phone in Supabase Auth.
  // Auth contact information is never exposed for profiles that did not match.
  const safeSearch = search.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!safeSearch) return NextResponse.json({ profiles: [], total: 0, page });
  const normalizedSearch = search.toLocaleLowerCase('fr').replace(/[\s()+.-]/g, '');
  const matchedContacts = new Map<string, AuthContact>();
  try {
    const AUTH_PAGE_BATCH_SIZE = 4;
    for (let firstPage = 1; ; firstPage += AUTH_PAGE_BATCH_SIZE) {
      const pages = await Promise.all(Array.from({ length: AUTH_PAGE_BATCH_SIZE }, (_, index) =>
        admin.auth.admin.listUsers({ page: firstPage + index, perPage: PAGE_SIZE })
      ));
      if (pages.some(({ error }) => error)) return NextResponse.json({ error: 'Recherche des contacts impossible.' }, { status: 502 });
      for (const { data } of pages) {
        for (const authUser of data.users) {
          const provider = String(authUser.app_metadata?.provider ?? authUser.identities?.[0]?.provider ?? '').toLowerCase();
          const usesPhone = provider === 'phone' || (!authUser.email && Boolean(authUser.phone));
          const value = usesPhone ? authUser.phone ?? null : authUser.email ?? authUser.phone ?? null;
          const searchable = (value ?? '').toLocaleLowerCase('fr');
          const normalizedContact = searchable.replace(/[\s()+.-]/g, '');
          if (searchable.includes(search.toLocaleLowerCase('fr')) || (normalizedSearch.length >= 4 && normalizedContact.includes(normalizedSearch))) {
            matchedContacts.set(authUser.id, { value, method: usesPhone ? 'phone' : authUser.email ? 'email' : authUser.phone ? 'phone' : null });
          }
        }
      }
      if (pages.some(({ data }) => data.users.length < PAGE_SIZE)) break;
    }

    const profileIds = new Set<string>();
    let nameQuery = admin.from('profiles').select('id').ilike('full_name', `%${safeSearch}%`);
    if (gender !== 'all') nameQuery = nameQuery.eq('gender', gender);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await nameQuery.order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
      if (error) return NextResponse.json({ error: 'Recherche des profils impossible.' }, { status: 502 });
      for (const profile of data ?? []) profileIds.add(profile.id);
      if (!data || data.length < PAGE_SIZE) break;
    }

    const contactIds = Array.from(matchedContacts.keys());
    if (contactIds.length) {
      const contactSet = new Set(contactIds);
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let contactQuery = admin.from('profiles').select('id').in('id', contactIds.slice(offset, offset + PAGE_SIZE));
        if (gender !== 'all') contactQuery = contactQuery.eq('gender', gender);
        const { data, error } = await contactQuery;
        if (error) return NextResponse.json({ error: 'Recherche des contacts impossible.' }, { status: 502 });
        for (const profile of data ?? []) if (contactSet.has(profile.id)) profileIds.add(profile.id);
        if (contactIds.slice(offset, offset + PAGE_SIZE).length < PAGE_SIZE) break;
      }
    }

    const allIds = Array.from(profileIds);
    const allProfiles: Record<string, unknown>[] = [];
    for (let offset = 0; offset < allIds.length; offset += 200) {
      const ids = allIds.slice(offset, offset + 200);
      let profilesQuery = admin.from('profiles').select('*').in('id', ids);
      if (gender !== 'all') profilesQuery = profilesQuery.eq('gender', gender);
      const { data, error } = await profilesQuery;
      if (error) return NextResponse.json({ error: 'Chargement des profils correspondants impossible.' }, { status: 502 });
      allProfiles.push(...(data ?? []));
    }

    allProfiles.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    const total = allProfiles.length;
    const start = (page - 1) * 10;
    const profiles = allProfiles.slice(start, start + 10).map((profile) => ({
      ...profile,
      authContact: matchedContacts.get(String(profile.id))?.value ?? null,
      authContactMethod: matchedContacts.get(String(profile.id))?.method ?? null,
    }));
    return NextResponse.json({ profiles, total, page }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[admin/users/search] Search failed.', error);
    return NextResponse.json({ error: 'La recherche globale a échoué.' }, { status: 500 });
  }
}
