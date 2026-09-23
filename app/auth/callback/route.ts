import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
  const authCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            authCookies.push({ name, value, options });
            cookieStore.set(name, value, options);
          });
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

  const googleIdentity = user.identities?.find((identity) => identity.provider === 'google');
  const otherIdentity = user.identities?.find((identity) => identity.provider !== 'google');
  const identityCreatedAt = new Date(googleIdentity?.created_at ?? 0).getTime();
  const userCreatedAt = new Date(user.created_at ?? 0).getTime();
  const googleWasJustLinkedToExistingAccount = Boolean(
    googleIdentity && otherIdentity && identityCreatedAt - userCreatedAt > 20_000
  );

  if (googleWasJustLinkedToExistingAccount && googleIdentity) {
    try {
      await supabase.auth.unlinkIdentity(googleIdentity);
    } catch {
      // Still end this OAuth session and explain which sign-in method to use.
    }
    await supabase.auth.signOut();
    const target = flow === 'signup' ? '/inscription' : '/connexion';
    const response = NextResponse.redirect(
      `${siteOrigin}${target}?error=${encodeURIComponent(
        'Un compte existe déjà avec cette adresse e-mail. Connectez-vous avec votre méthode habituelle (e-mail ou téléphone). Vous pourrez lier Google depuis votre profil après connexion.'
      )}`
    );
    authCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
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
    const { data: accessProfile, error: accessError } = await admin.from('profiles').select('is_active').eq('id', user.id).maybeSingle();
    if (accessError || accessProfile?.is_active === false) {
      await supabase.auth.signOut();
      const reason = accessProfile?.is_active === false
        ? 'Votre compte est bloqué. Veuillez contacter contact@aras.sn pour obtenir de l’aide.'
        : 'Nous ne pouvons pas vérifier le statut de votre compte pour le moment. Réessayez dans quelques instants.';
      const response = NextResponse.redirect(`${siteOrigin}/connexion?error=${encodeURIComponent(reason)}`);
      authCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }
    const userAgent = request.headers.get('user-agent') || '';
    const browser = /Edg\//.test(userAgent) ? 'Microsoft Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Navigateur inconnu';
    const operatingSystem = /Windows NT/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'Système inconnu';
    await admin.from('admin_activity_logs').insert({
      user_id: user.id,
      kind: 'login',
      country: request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || request.headers.get('x-nf-geo-country-code'),
      region: request.headers.get('x-vercel-ip-country-region') || request.headers.get('x-nf-geo-region'),
      city: request.headers.get('x-vercel-ip-city') || request.headers.get('x-nf-geo-city'),
      browser,
      operating_system: operatingSystem,
      device: /iPad|Tablet/.test(userAgent) ? 'Tablette' : /Mobile|iPhone|Android/.test(userAgent) ? 'Mobile' : 'Ordinateur',
      user_agent: userAgent,
      page: `Google OAuth · ${flow}`,
    });
  }

  // Supabase automatically links verified email identities. Existing linked
  // users should sign in; a first-time Google signup should complete onboarding.
  const destination = flow === 'signup' ? '/onboarding' : next;
  const response = NextResponse.redirect(`${siteOrigin}${destination}`);
  authCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
