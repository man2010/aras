import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const flow = searchParams.get('flow') === 'signup' ? 'signup' : 'signin';
  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? origin).replace(/\/$/, '');
  const requestedNext = searchParams.get('next') ?? '/espace';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/espace';

  if (!code) {
    return NextResponse.redirect(`${siteOrigin}/connexion?error=${encodeURIComponent('La réponse de Google est incomplète. Réessayez.')}`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${siteOrigin}/connexion?error=${encodeURIComponent('La connexion Google a échoué. Réessayez.')}`);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${siteOrigin}/connexion?error=${encodeURIComponent('Impossible de vérifier votre session Google. Réessayez.')}`);
  }

  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (adminKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      adminKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const fallbackName =
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Utilisateur';
    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: user.id,
        full_name: fallbackName,
        is_active: true,
        is_online: true,
        avatar_urls: [user.user_metadata?.avatar_url ?? 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600'],
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
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    if (profileError) {
      await supabase.auth.signOut();
      const response = NextResponse.redirect(`${siteOrigin}/connexion?error=${encodeURIComponent('Impossible de préparer votre profil. Réessayez.')}`);
      cookieStore.getAll().forEach(({ name }) => response.cookies.delete(name));
      return response;
    }
  }

  // Supabase automatically links verified email identities. Existing linked
  // users should sign in; a first-time Google signup should complete onboarding.
  const destination = flow === 'signup' ? '/onboarding' : next;
  const response = NextResponse.redirect(`${siteOrigin}${destination}`);
  cookieStore.getAll().forEach(({ name, value }) => {
    if (request.headers.get('cookie')?.includes(`${name}=`)) {
      response.cookies.set(name, value);
    }
  });
  return response;
}
