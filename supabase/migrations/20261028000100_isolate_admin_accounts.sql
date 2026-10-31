-- Administrative accounts use the back office only. They are excluded from
-- member discovery, likes, matches, and conversations at the database layer.

CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = target_user_id
      AND ar.role IN ('admin', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.profiles_visible WITH (security_barrier = true) AS
SELECT
  p.id,
  p.updated_at,
  p.full_name,
  p.gender,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_age, true) THEN p.birthdate ELSE NULL END AS birthdate,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_distance, true) THEN p.city ELSE NULL END AS city,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_distance, true) THEN p.zone ELSE NULL END AS zone,
  p.bio,
  p.interests,
  p.languages,
  p.religion,
  p.caste,
  p.marital_status,
  p.smoking_habit,
  p.avatar_urls,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_distance, true) THEN p.lat ELSE NULL END AS lat,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_distance, true) THEN p.lng ELSE NULL END AS lng,
  p.is_active,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_online_status, true) THEN p.is_online ELSE false END AS is_online,
  CASE WHEN auth.uid() = p.id OR COALESCE(p.show_online_status, true) THEN p.last_seen_at ELSE NULL END AS last_seen_at,
  p.is_verified,
  p.is_premium,
  p.view_count,
  p.show_age,
  p.show_online_status,
  p.show_distance,
  p.created_at,
  p.height,
  p.profession,
  p.profile_status,
  p.onboarding_completed
FROM public.profiles AS p
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = p.id AND ar.role IN ('admin', 'moderator')
  )
  AND (
    (p.is_active = true AND p.is_temporarily_deactivated = false)
    OR auth.uid() = p.id
  );

GRANT SELECT ON public.profiles_visible TO anon, authenticated;

-- Hide any past admin member activity from member-facing queries.
UPDATE public.profiles p
SET is_online = false, last_seen_at = NULL
WHERE public.is_admin_user(p.id);

DROP POLICY IF EXISTS "Users can view own swipes" ON public.swipes;
CREATE POLICY "Users can view member swipes"
ON public.swipes FOR SELECT TO authenticated
USING (
  auth.uid() IN (swiper_id, swiped_id)
  AND NOT public.is_admin_user(swiper_id)
  AND NOT public.is_admin_user(swiped_id)
);

DROP POLICY IF EXISTS "Users can create own swipes" ON public.swipes;
CREATE POLICY "Members can create own swipes"
ON public.swipes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = swiper_id
  AND swiper_id <> swiped_id
  AND NOT public.is_admin_user(swiper_id)
  AND NOT public.is_admin_user(swiped_id)
);

DROP POLICY IF EXISTS "Users can update own swipes" ON public.swipes;
CREATE POLICY "Members can update own swipes"
ON public.swipes FOR UPDATE TO authenticated
USING (auth.uid() = swiper_id AND NOT public.is_admin_user(swiper_id) AND NOT public.is_admin_user(swiped_id))
WITH CHECK (auth.uid() = swiper_id AND swiper_id <> swiped_id AND NOT public.is_admin_user(swiper_id) AND NOT public.is_admin_user(swiped_id));

DROP POLICY IF EXISTS "Users can delete own swipes" ON public.swipes;
CREATE POLICY "Members can delete own swipes"
ON public.swipes FOR DELETE TO authenticated
USING (auth.uid() = swiper_id AND NOT public.is_admin_user(swiper_id) AND NOT public.is_admin_user(swiped_id));

DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Members can view own matches"
ON public.matches FOR SELECT TO authenticated
USING (
  auth.uid() IN (user_1_id, user_2_id)
  AND NOT public.is_admin_user(user_1_id)
  AND NOT public.is_admin_user(user_2_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = user_1_id AND b.blocked_id = user_2_id)
       OR (b.blocker_id = user_2_id AND b.blocked_id = user_1_id)
  )
);

DROP POLICY IF EXISTS "Users can create reciprocal matches" ON public.matches;
CREATE POLICY "Members can create reciprocal matches"
ON public.matches FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IN (user_1_id, user_2_id)
  AND user_1_id <> user_2_id
  AND NOT public.is_admin_user(user_1_id)
  AND NOT public.is_admin_user(user_2_id)
  AND EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = user_1_id AND swiped_id = user_2_id AND type IN ('like', 'superlike')
  )
  AND EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = user_2_id AND swiped_id = user_1_id AND type IN ('like', 'superlike')
  )
);

CREATE OR REPLACE FUNCTION public.create_match_from_swipe(target_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  first_user_id uuid;
  second_user_id uuid;
  match_id uuid;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = current_user_id THEN RAISE EXCEPTION 'Invalid match partner'; END IF;
  IF public.is_admin_user(current_user_id) OR public.is_admin_user(target_profile_id) THEN
    RAISE EXCEPTION 'Administrative accounts cannot participate in member matches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id AND is_active = true AND is_temporarily_deactivated = false) THEN
    RAISE EXCEPTION 'Target profile unavailable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.swipes WHERE swiper_id = current_user_id AND swiped_id = target_profile_id AND type IN ('like', 'superlike')) THEN
    RAISE EXCEPTION 'Current user has not liked this profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.swipes WHERE swiper_id = target_profile_id AND swiped_id = current_user_id AND type IN ('like', 'superlike')) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = current_user_id AND blocked_id = target_profile_id)
       OR (blocker_id = target_profile_id AND blocked_id = current_user_id)
  ) THEN RAISE EXCEPTION 'Profile blocked'; END IF;

  first_user_id := LEAST(current_user_id, target_profile_id);
  second_user_id := GREATEST(current_user_id, target_profile_id);
  INSERT INTO public.matches (user_1_id, user_2_id, is_match, updated_at)
  VALUES (first_user_id, second_user_id, true, now())
  ON CONFLICT (user_1_id, user_2_id)
  DO UPDATE SET updated_at = now(), is_match = true
  RETURNING id INTO match_id;
  RETURN match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match_from_swipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_from_swipe(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_direct_conversation(target_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  first_user_id uuid;
  second_user_id uuid;
  conversation_id uuid;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = current_user_id THEN RAISE EXCEPTION 'Invalid conversation partner'; END IF;
  IF public.is_admin_user(current_user_id) OR public.is_admin_user(target_profile_id) THEN
    RAISE EXCEPTION 'Administrative accounts cannot participate in member conversations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id AND is_active = true AND is_temporarily_deactivated = false) THEN
    RAISE EXCEPTION 'Target profile unavailable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = current_user_id AND blocked_id = target_profile_id)
       OR (blocker_id = target_profile_id AND blocked_id = current_user_id)
  ) THEN RAISE EXCEPTION 'Profile blocked'; END IF;

  first_user_id := LEAST(current_user_id, target_profile_id);
  second_user_id := GREATEST(current_user_id, target_profile_id);
  SELECT id INTO conversation_id FROM public.matches
  WHERE user_1_id = first_user_id AND user_2_id = second_user_id
  LIMIT 1;
  IF conversation_id IS NOT NULL THEN RETURN conversation_id; END IF;

  INSERT INTO public.matches (user_1_id, user_2_id, is_match, updated_at)
  VALUES (first_user_id, second_user_id, false, now())
  ON CONFLICT (user_1_id, user_2_id)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO conversation_id;
  RETURN conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_direct_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can record profile views" ON public.profile_visits;
CREATE POLICY "Members can record profile views"
ON public.profile_visits FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = visitor_id
  AND visitor_id <> profile_id
  AND NOT public.is_admin_user(visitor_id)
  AND NOT public.is_admin_user(profile_id)
);

DROP POLICY IF EXISTS "Members can refresh their recorded views" ON public.profile_visits;
CREATE POLICY "Members can refresh their recorded views"
ON public.profile_visits FOR UPDATE TO authenticated
USING (auth.uid() = visitor_id AND NOT public.is_admin_user(visitor_id) AND NOT public.is_admin_user(profile_id))
WITH CHECK (auth.uid() = visitor_id AND visitor_id <> profile_id AND NOT public.is_admin_user(visitor_id) AND NOT public.is_admin_user(profile_id));

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Members can view own messages"
ON public.messages FOR SELECT TO authenticated
USING (
  auth.uid() IN (sender_id, receiver_id)
  AND NOT public.is_admin_user(sender_id)
  AND NOT public.is_admin_user(receiver_id)
  AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND sender_id IN (m.user_1_id, m.user_2_id) AND receiver_id IN (m.user_1_id, m.user_2_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
);

DROP POLICY IF EXISTS "Users can send own conversation messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send own match messages" ON public.messages;
CREATE POLICY "Members can send own conversation messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
  AND NOT public.is_admin_user(sender_id)
  AND NOT public.is_admin_user(receiver_id)
  AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND sender_id IN (m.user_1_id, m.user_2_id) AND receiver_id IN (m.user_1_id, m.user_2_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
);

DROP POLICY IF EXISTS "Users can mark received messages read" ON public.messages;
CREATE POLICY "Members can mark received messages read"
ON public.messages FOR UPDATE TO authenticated
USING (
  auth.uid() = receiver_id
  AND NOT public.is_admin_user(sender_id)
  AND NOT public.is_admin_user(receiver_id)
  AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND sender_id IN (m.user_1_id, m.user_2_id) AND receiver_id IN (m.user_1_id, m.user_2_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
)
WITH CHECK (auth.uid() = receiver_id AND NOT public.is_admin_user(sender_id) AND NOT public.is_admin_user(receiver_id));
