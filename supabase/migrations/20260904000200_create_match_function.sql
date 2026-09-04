/*
# Create match creation function from swipes
This function automatically creates a match when two users have liked each other
*/

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
    WHERE swiper_id = current_user_id
      AND swiped_id = target_profile_id
      AND type IN ('like', 'superlike')
  ) THEN
    RAISE EXCEPTION 'Current user has not liked this profile';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = target_profile_id
      AND swiped_id = current_user_id
      AND type IN ('like', 'superlike')
  ) THEN
    RETURN NULL;
  END IF;

  first_user_id := LEAST(current_user_id, target_profile_id);
  second_user_id := GREATEST(current_user_id, target_profile_id);

  INSERT INTO public.matches (user_1_id, user_2_id)
  VALUES (first_user_id, second_user_id)
  ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO match_id;

  RETURN match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match_from_swipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_from_swipe(uuid) TO authenticated;