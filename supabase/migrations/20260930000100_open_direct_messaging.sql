-- Keep match status separate from the existence of a conversation.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_match boolean NOT NULL DEFAULT true;

-- If a direct conversation later becomes a mutual like, keep its history and
-- promote the existing row to a real match instead of creating a duplicate.
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
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_profile_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot match yourself';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_profile_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target profile unavailable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = current_user_id AND swiped_id = target_profile_id
      AND type IN ('like', 'superlike')
  ) THEN
    RAISE EXCEPTION 'Current user has not liked this profile';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = target_profile_id AND swiped_id = current_user_id
      AND type IN ('like', 'superlike')
  ) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = current_user_id AND blocked_id = target_profile_id)
       OR (blocker_id = target_profile_id AND blocked_id = current_user_id)
  ) THEN
    RAISE EXCEPTION 'Profile blocked';
  END IF;

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
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF target_profile_id IS NULL OR target_profile_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid conversation partner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_profile_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target profile unavailable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = current_user_id AND blocked_id = target_profile_id)
       OR (blocker_id = target_profile_id AND blocked_id = current_user_id)
  ) THEN
    RAISE EXCEPTION 'Profile blocked';
  END IF;

  first_user_id := LEAST(current_user_id, target_profile_id);
  second_user_id := GREATEST(current_user_id, target_profile_id);

  SELECT id INTO conversation_id
  FROM public.matches
  WHERE (user_1_id = first_user_id AND user_2_id = second_user_id)
     OR (user_1_id = second_user_id AND user_2_id = first_user_id)
  LIMIT 1;

  IF conversation_id IS NOT NULL THEN
    RETURN conversation_id;
  END IF;

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

-- A blocked pair cannot see the old conversation or its messages. Once the
-- blocker removes the block, the same conversation and history become visible.
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
ON public.matches FOR SELECT TO authenticated
USING (
  auth.uid() IN (user_1_id, user_2_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = user_1_id AND b.blocked_id = user_2_id)
       OR (b.blocker_id = user_2_id AND b.blocked_id = user_1_id)
  )
);

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT TO authenticated
USING (
  auth.uid() IN (sender_id, receiver_id)
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND sender_id IN (m.user_1_id, m.user_2_id)
      AND receiver_id IN (m.user_1_id, m.user_2_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
);

DROP POLICY IF EXISTS "Users can send own match messages" ON public.messages;
CREATE POLICY "Users can send own conversation messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND sender_id IN (m.user_1_id, m.user_2_id)
      AND receiver_id IN (m.user_1_id, m.user_2_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
);

DROP POLICY IF EXISTS "Users can mark received messages read" ON public.messages;
CREATE POLICY "Users can mark received messages read"
ON public.messages FOR UPDATE TO authenticated
USING (
  auth.uid() = receiver_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND sender_id IN (m.user_1_id, m.user_2_id)
      AND receiver_id IN (m.user_1_id, m.user_2_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
       OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
  )
)
WITH CHECK (auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS matches_pair_kind_idx
  ON public.matches (user_1_id, user_2_id, is_match);
