ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blur_profile_photo boolean NOT NULL DEFAULT false;

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
  p.onboarding_completed,
  p.blur_profile_photo
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
