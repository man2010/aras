-- One permission-checked round trip for dashboard counters and analytics.
-- Results are aggregated in PostgreSQL, so browser row limits cannot truncate charts.
CREATE INDEX IF NOT EXISTS profiles_admin_created_at_idx ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_admin_city_idx ON public.profiles (city);
CREATE INDEX IF NOT EXISTS messages_admin_created_at_idx ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS matches_admin_true_created_at_idx ON public.matches (created_at DESC) WHERE is_match = true;
CREATE INDEX IF NOT EXISTS swipes_admin_likes_date_idx ON public.swipes (created_at DESC, swiped_id) WHERE type = 'like';
CREATE INDEX IF NOT EXISTS subscriptions_admin_active_plan_idx ON public.user_subscriptions (plan_code, ends_at) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l’administration.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'men', (SELECT count(*) FROM public.profiles WHERE gender = 'Homme'),
    'women', (SELECT count(*) FROM public.profiles WHERE gender = 'Femme'),
    'verified', (SELECT count(*) FROM public.profiles WHERE is_verified = true),
    'conversations', (SELECT count(*) FROM public.matches),
    'matches', (SELECT count(*) FROM public.matches WHERE is_match = true),
    'events', (SELECT count(*) FROM public.events),
    'reports', (SELECT count(*) FROM public.reports),
    'likes', (SELECT count(*) FROM public.swipes WHERE type = 'like'),
    'messages', (SELECT count(*) FROM public.messages),
    'newProfiles30', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'incompleteProfiles', (SELECT count(*) FROM public.profiles WHERE COALESCE(onboarding_completed, false) = false),
    'activePremium', (SELECT count(*) FROM public.user_subscriptions WHERE plan_code = 'premium' AND status = 'active' AND (ends_at IS NULL OR ends_at > now())),
    'activeElite', (SELECT count(*) FROM public.user_subscriptions WHERE plan_code = 'elite' AND status = 'active' AND (ends_at IS NULL OR ends_at > now())),
    'goldenPending', (SELECT count(*) FROM public.golden_requests WHERE status = 'new')
  ) INTO snapshot;

  RETURN snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_analytics_snapshot(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l’administration.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 365 THEN
    RAISE EXCEPTION 'Période Analytics invalide.' USING ERRCODE = '22023';
  END IF;

  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  ),
  signups AS (
    SELECT created_at::date AS day, count(*)::integer AS amount
    FROM public.profiles WHERE created_at >= p_from AND created_at < p_to + 1 GROUP BY 1
  ),
  messages AS (
    SELECT created_at::date AS day, count(*)::integer AS amount
    FROM public.messages WHERE created_at >= p_from AND created_at < p_to + 1 GROUP BY 1
  ),
  matches AS (
    SELECT created_at::date AS day, count(*)::integer AS amount
    FROM public.matches WHERE is_match = true AND created_at >= p_from AND created_at < p_to + 1 GROUP BY 1
  ),
  city_counts AS (
    SELECT COALESCE(NULLIF(btrim(city), ''), 'Ville non renseignée') AS city, count(*)::integer AS amount
    FROM public.profiles GROUP BY 1 ORDER BY amount DESC, city ASC LIMIT 20
  ),
  popular AS (
    SELECT s.swiped_id AS profile_id, count(*)::integer AS amount
    FROM public.swipes s
    WHERE s.type = 'like' AND s.created_at >= p_from AND s.created_at < p_to + 1
    GROUP BY s.swiped_id ORDER BY amount DESC, profile_id ASC LIMIT 10
  )
  SELECT jsonb_build_object(
    'dailySignups', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d.day, 'count', COALESCE(s.amount, 0)) ORDER BY d.day) FROM days d LEFT JOIN signups s USING (day)), '[]'::jsonb),
    'dailyMessages', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d.day, 'count', COALESCE(m.amount, 0)) ORDER BY d.day) FROM days d LEFT JOIN messages m USING (day)), '[]'::jsonb),
    'dailyMatches', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d.day, 'count', COALESCE(mt.amount, 0)) ORDER BY d.day) FROM days d LEFT JOIN matches mt USING (day)), '[]'::jsonb),
    'userDemographics', COALESCE((SELECT jsonb_agg(jsonb_build_object('city', city, 'count', amount) ORDER BY amount DESC, city ASC) FROM city_counts), '[]'::jsonb),
    'topProfiles', COALESCE((SELECT jsonb_agg(jsonb_build_object('profileId', p.profile_id, 'profileName', COALESCE(pr.full_name, 'Profil'), 'likes', p.amount) ORDER BY p.amount DESC, p.profile_id ASC) FROM popular p JOIN public.profiles pr ON pr.id = p.profile_id), '[]'::jsonb)
  ) INTO snapshot;

  RETURN snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_recent_activity(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l’administration.' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 300 THEN
    RAISE EXCEPTION 'Nombre d’activités invalide.' USING ERRCODE = '22023';
  END IF;

  WITH activity_rows AS (
    (SELECT 'signup-' || p.id::text AS id, 'new_signup' AS category, 'Nouvelle inscription' AS type,
      COALESCE(p.full_name, 'Un membre') || ' a créé son profil' AS description, p.created_at,
      jsonb_build_object('Nom', COALESCE(p.full_name, 'Non renseigné'), 'Ville', COALESCE(p.city, 'Non renseignée'), 'Profession', COALESCE(p.profession, 'Non renseignée'), 'Identifiant utilisateur', p.id::text) AS details
      FROM public.profiles p WHERE p.created_at >= now() - interval '90 days' ORDER BY p.created_at DESC LIMIT 300)
    UNION ALL
    (SELECT 'message-' || m.id::text, 'new_message', 'Nouveau message', 'Message envoyé par ' || COALESCE(sender.full_name, m.sender_id::text), m.created_at,
      jsonb_build_object('Expéditeur', COALESCE(sender.full_name, m.sender_id::text), 'Destinataire', COALESCE(receiver.full_name, m.receiver_id::text), 'Conversation', COALESCE(m.match_id::text, 'Sans identifiant'), 'ID du message', m.id::text)
      FROM public.messages m LEFT JOIN public.profiles sender ON sender.id = m.sender_id LEFT JOIN public.profiles receiver ON receiver.id = m.receiver_id
      WHERE m.created_at >= now() - interval '90 days' ORDER BY m.created_at DESC LIMIT 300)
    UNION ALL
    (SELECT 'match-' || mt.id::text, 'new_match', 'Nouveau match', COALESCE(first.full_name, 'Membre') || ' et ' || COALESCE(second.full_name, 'membre') || ' ont matché', mt.created_at,
      jsonb_build_object('Membre 1', COALESCE(first.full_name, mt.user_1_id::text), 'Membre 2', COALESCE(second.full_name, mt.user_2_id::text), 'ID du match', mt.id::text)
      FROM public.matches mt LEFT JOIN public.profiles first ON first.id = mt.user_1_id LEFT JOIN public.profiles second ON second.id = mt.user_2_id
      WHERE mt.is_match = true AND mt.created_at >= now() - interval '90 days' ORDER BY mt.created_at DESC LIMIT 300)
    UNION ALL
    (SELECT 'event-' || e.id::text, 'new_event', 'Nouvel événement', e.title, e.created_at,
      jsonb_build_object('Événement', e.title, 'Lieu', e.location, 'Ville', e.city, 'Date', e.date::text, 'ID événement', e.id::text)
      FROM public.events e WHERE e.created_at >= now() - interval '90 days' ORDER BY e.created_at DESC LIMIT 300)
    UNION ALL
    (SELECT 'login-' || l.id::text, 'new_login', 'Nouvelle connexion', COALESCE(p.full_name, 'Utilisateur') || ' · ' || COALESCE(concat_ws(', ', l.city, l.region, l.country), 'Localisation inconnue') || ' · ' || COALESCE(l.browser, 'Navigateur inconnu'), l.created_at,
      jsonb_build_object('Utilisateur', COALESCE(p.full_name, l.user_id::text), 'Ville', COALESCE(l.city, 'Non détectée'), 'Région', COALESCE(l.region, 'Non détectée'), 'Pays', COALESCE(l.country, 'Non détecté'), 'Navigateur', COALESCE(l.browser, 'Inconnu'), 'Système', COALESCE(l.operating_system, 'Inconnu'), 'Appareil', COALESCE(l.device, 'Inconnu'), 'Agent utilisateur', COALESCE(l.user_agent, 'Non disponible'), 'Page', COALESCE(l.page, 'Connexion'), 'Horodatage (UTC)', l.created_at::text)
      FROM public.admin_activity_logs l LEFT JOIN public.profiles p ON p.id = l.user_id
      WHERE l.kind = 'login' AND l.created_at >= now() - interval '90 days' ORDER BY l.created_at DESC LIMIT 300)
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(recent) ORDER BY recent.created_at DESC), '[]'::jsonb)
  INTO activity
  FROM (SELECT * FROM activity_rows ORDER BY created_at DESC LIMIT p_limit) recent;

  RETURN activity;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_analytics_snapshot(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_recent_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_snapshot(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_recent_activity(integer) TO authenticated;
