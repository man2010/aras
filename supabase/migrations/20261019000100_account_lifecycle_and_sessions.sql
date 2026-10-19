-- Separate member initiated deactivation from administrative account blocking.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_temporarily_deactivated boolean NOT NULL DEFAULT false;

-- Reapply the existing visibility contract while excluding voluntarily
-- deactivated profiles from all member discovery queries.
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
WHERE (p.is_active = true AND p.is_temporarily_deactivated = false)
   OR auth.uid() = p.id;

GRANT SELECT ON public.profiles_visible TO anon, authenticated;

-- A device is considered active while its heartbeat is younger than two minutes.
CREATE TABLE IF NOT EXISTS public.account_sessions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  device_label text NOT NULL DEFAULT 'Appareil',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_key)
);

ALTER TABLE public.account_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage own account sessions" ON public.account_sessions;
CREATE POLICY "Members manage own account sessions"
  ON public.account_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_sessions TO authenticated;

-- User-requested permanent deletion. Child rows are removed before auth.users
-- so deletion remains reliable even where legacy foreign keys lack cascades.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid := auth.uid();
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Session requise';
  END IF;

  DELETE FROM public.admin_activity_logs WHERE user_id = target_user_id;
  DELETE FROM public.event_registrations WHERE user_id = target_user_id;
  DELETE FROM public.user_notifications WHERE user_id = target_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.stories WHERE user_id = target_user_id;
  DELETE FROM public.admin_roles WHERE user_id = target_user_id;
  DELETE FROM public.messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  DELETE FROM public.profile_visits WHERE visitor_id = target_user_id OR profile_id = target_user_id;
  DELETE FROM public.swipes WHERE swiper_id = target_user_id OR swiped_id = target_user_id;
  DELETE FROM public.blocks WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  DELETE FROM public.reports WHERE reporter_id = target_user_id OR reported_id = target_user_id;
  DELETE FROM public.matches WHERE user_1_id = target_user_id OR user_2_id = target_user_id;
  DELETE FROM public.account_sessions WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
