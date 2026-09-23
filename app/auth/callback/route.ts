import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const LINK_WINDOW_MS = 20_000; // marge de tolérance réseau

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
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

  const identities = userData.user.identities ?? [];
  const googleIdentity = identities.find((i) => i.provider === 'google');
  const otherIdentity = identities.find((i) => i.provider !== 'google');

  if (googleIdentity && otherIdentity) {
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
      return NextResponse.redirect(
        `${origin}/connexion?error=${encodeURIComponent(
          'Un compte existe déjà avec cet e-mail. Connectez-vous avec votre mot de passe, puis liez Google depuis votre profil si vous le souhaitez.'
        )}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
