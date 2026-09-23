import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const LINK_WINDOW_MS = 20_000; // marge de tolérance réseau

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const flow = searchParams.get('flow') === 'signup' ? 'signup' : 'signin';
  // Accept only local paths so an OAuth parameter cannot become an open redirect.
  const requestedNext = searchParams.get('next') ?? '/espace';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/espace';

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?error=oauth_missing_code`);
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
    return NextResponse.redirect(`${origin}/connexion?error=${encodeURIComponent(error.message)}`);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.redirect(`${origin}/connexion?error=${encodeURIComponent('Connexion Google impossible. Réessayez.')}`);
  }

  // OAuth sign-ups bypass the email/phone signup flow, so make sure they also
  // have the minimal profile row required by onboarding and the app.
  const user = userData.user;
  const identities = user.identities ?? [];
  const googleIdentity = identities.find((identity) => identity.provider === 'google');
  const otherIdentity = identities.find((identity) => identity.provider !== 'google');

  // If Google was just attached to an older password/phone account, do not
  // leave the browser authenticated as that existing account after signup.
  if (flow === 'signup' && googleIdentity && otherIdentity) {
    const googleCreatedAt = new Date(googleIdentity.created_at ?? 0).getTime();
    const otherCreatedAt = new Date(otherIdentity.created_at ?? 0).getTime();
    if (googleCreatedAt - otherCreatedAt > LINK_WINDOW_MS) {
      try {
        await supabase.auth.unlinkIdentity(googleIdentity);
      } catch {
        // Continue to clear the OAuth session and show the actionable message.
      }
      await supabase.auth.signOut();
      const response = NextResponse.redirect(
        `${origin}/inscription?error=${encodeURIComponent(
          'Un compte existe déjà avec cette adresse e-mail. Connectez-vous à votre compte existant, puis liez Google depuis votre profil.'
        )}`
      );
      cookieStore.getAll().forEach(({ name }) => response.cookies.delete(name));
      return response;
    }
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
        avatar_urls: [
          user.user_metadata?.avatar_url ??
            'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
        ],
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
      const response = NextResponse.redirect(
        `${origin}/connexion?error=${encodeURIComponent('Impossible de préparer votre profil. Réessayez.')}`
      );
      return response;
    }
  }

  if (flow === 'signin' && googleIdentity && otherIdentity) {
    const googleCreatedAt = new Date(googleIdentity.created_at ?? 0).getTime();
    const otherCreatedAt = new Date(otherIdentity.created_at ?? 0).getTime();
    const now = Date.now();

    const googleJustLinked = now - googleCreatedAt < LINK_WINDOW_MS;
    const otherPreExisted = googleCreatedAt - otherCreatedAt > LINK_WINDOW_MS;

    if (googleJustLinked && otherPreExisted) {
      try {
        await supabase.auth.unlinkIdentity(googleIdentity);
      } catch {
        // best-effort : on continue même si le unlink échoue
      }
      await supabase.auth.signOut();
      const response = NextResponse.redirect(
        `${origin}/connexion?error=${encodeURIComponent(
          'Un compte existe déjà avec cet e-mail. Connectez-vous avec votre mot de passe, puis liez Google depuis votre profil si vous le souhaitez.'
        )}`
      );
      cookieStore.getAll().forEach(({ name }) => response.cookies.delete(name));
      return response;
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
