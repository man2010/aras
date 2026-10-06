-- Ensure all privacy and notification preferences exist for current and new members.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_age boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_distance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_likes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_matches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_events boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET show_age = COALESCE(show_age, true),
    show_online_status = COALESCE(show_online_status, true),
    show_distance = COALESCE(show_distance, true),
    notif_messages = COALESCE(notif_messages, true),
    notif_likes = COALESCE(notif_likes, true),
    notif_matches = COALESCE(notif_matches, true),
    notif_events = COALESCE(notif_events, true)
WHERE show_age IS NULL
   OR show_online_status IS NULL
   OR show_distance IS NULL
   OR notif_messages IS NULL
   OR notif_likes IS NULL
   OR notif_matches IS NULL
   OR notif_events IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN show_age SET DEFAULT true,
  ALTER COLUMN show_age SET NOT NULL,
  ALTER COLUMN show_online_status SET DEFAULT true,
  ALTER COLUMN show_online_status SET NOT NULL,
  ALTER COLUMN show_distance SET DEFAULT true,
  ALTER COLUMN show_distance SET NOT NULL,
  ALTER COLUMN notif_messages SET DEFAULT true,
  ALTER COLUMN notif_messages SET NOT NULL,
  ALTER COLUMN notif_likes SET DEFAULT true,
  ALTER COLUMN notif_likes SET NOT NULL,
  ALTER COLUMN notif_matches SET DEFAULT true,
  ALTER COLUMN notif_matches SET NOT NULL,
  ALTER COLUMN notif_events SET DEFAULT true,
  ALTER COLUMN notif_events SET NOT NULL;

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Members must read other profiles through a view that enforces visibility
-- preferences; direct table reads remain available only to the owner/admin.
DROP POLICY IF EXISTS "Public can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

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
WHERE p.is_active = true OR (auth.uid() = p.id);

GRANT SELECT ON public.profiles_visible TO anon, authenticated;

-- Do not create an in-app like notification when the recipient opted out.
CREATE OR REPLACE FUNCTION public.notify_profile_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
  should_notify boolean;
BEGIN
  IF NEW.type NOT IN ('like', 'superlike') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(notif_likes, true) INTO should_notify
  FROM public.profiles WHERE id = NEW.swiped_id;
  SELECT NULLIF(full_name, '') INTO actor_name
  FROM public.profiles WHERE id = NEW.swiper_id;

  IF NOT COALESCE(should_notify, true) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
  VALUES (NEW.swiped_id, NEW.swiper_id, 'like_received', 'Nouveau like reçu',
          COALESCE(actor_name, 'Une personne') || ' aime votre profil.');
  RETURN NEW;
END;
$$;

-- Notify both members on a new mutual match, respecting each recipient's setting.
CREATE OR REPLACE FUNCTION public.notify_new_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_name text;
  second_name text;
BEGIN
  IF NEW.is_match IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_match IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(full_name, '') INTO first_name FROM public.profiles WHERE id = NEW.user_1_id;
  SELECT NULLIF(full_name, '') INTO second_name FROM public.profiles WHERE id = NEW.user_2_id;

  IF COALESCE((SELECT notif_matches FROM public.profiles WHERE id = NEW.user_1_id), true) THEN
    INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
    VALUES (NEW.user_1_id, NEW.user_2_id, 'match_created', 'Nouveau match',
            'Vous et ' || COALESCE(second_name, 'un membre') || ' vous plaisez mutuellement.');
  END IF;

  IF COALESCE((SELECT notif_matches FROM public.profiles WHERE id = NEW.user_2_id), true) THEN
    INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
    VALUES (NEW.user_2_id, NEW.user_1_id, 'match_created', 'Nouveau match',
            'Vous et ' || COALESCE(first_name, 'un membre') || ' vous plaisez mutuellement.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_notify_members ON public.matches;
CREATE TRIGGER matches_notify_members
  AFTER INSERT OR UPDATE OF is_match ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_match();
