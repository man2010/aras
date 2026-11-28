CREATE OR REPLACE FUNCTION public.admin_fake_profile_queue(
  p_review_status text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  profile_id uuid,
  photo_url text,
  scan_status text,
  review_status text,
  reason text,
  celebrity_names text[],
  findings jsonb,
  scanned_at timestamptz,
  reviewed_at timestamptz,
  profile jsonb,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT
      a.id,
      a.profile_id,
      a.photo_url,
      a.scan_status,
      a.review_status,
      a.reason,
      a.celebrity_names,
      a.findings,
      a.scanned_at,
      a.reviewed_at,
      jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'city', p.city,
        'avatar_urls', p.avatar_urls,
        'is_active', p.is_active,
        'onboarding_completed', p.onboarding_completed,
        'profile_status', p.profile_status
      ) AS profile
    FROM public.profile_photo_audits a
    JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.scan_status = 'flagged'
      AND p.onboarding_completed IS TRUE
      AND p.profile_status = 'completed'
      AND (
        (p_review_status = 'pending' AND a.review_status = 'pending')
        OR (p_review_status = 'treated' AND a.review_status IN ('blocked', 'cleared'))
      )
  )
  SELECT visible.*, count(*) OVER () AS total_count
  FROM visible
  ORDER BY scanned_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.admin_fake_profile_queue(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fake_profile_queue(text, integer, integer) TO service_role;
