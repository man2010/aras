-- An issued warning is an open follow-up, not a completed moderation decision.
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

CREATE OR REPLACE FUNCTION public.admin_fake_profile_waiting_queue(
  p_warning_hours integer DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS TABLE (
  case_id uuid,
  audit_id uuid,
  profile_id uuid,
  photo_url text,
  reason text,
  celebrity_names text[],
  findings jsonb,
  warning_count integer,
  warning_hours integer,
  warned_at timestamptz,
  deadline_at timestamptz,
  profile jsonb,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH waiting AS (
    SELECT
      c.id AS case_id,
      a.id AS audit_id,
      c.profile_id,
      c.photo_url,
      a.reason,
      a.celebrity_names,
      a.findings,
      c.warning_count,
      c.warning_hours,
      c.warned_at,
      c.deadline_at,
      jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'city', p.city,
        'avatar_urls', p.avatar_urls,
        'is_active', p.is_active,
        'onboarding_completed', p.onboarding_completed,
        'profile_status', p.profile_status
      ) AS profile
    FROM public.profile_photo_enforcement_cases c
    JOIN public.profile_photo_audits a ON a.id = c.audit_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.status = 'active'
      AND c.deadline_at > now()
      AND p.is_active IS TRUE
      AND p.onboarding_completed IS TRUE
      AND p.profile_status = 'completed'
      AND (c.photo_url = p.photo_url OR c.photo_url = ANY(COALESCE(p.avatar_urls, '{}'::text[])))
      AND (p_warning_hours IS NULL OR c.warning_hours = p_warning_hours)
  )
  SELECT waiting.*, count(*) OVER () AS total_count
  FROM waiting
  ORDER BY deadline_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.admin_fake_profile_waiting_queue(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fake_profile_waiting_queue(integer, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_removed_profile_photo_cases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH resolved AS (
    UPDATE public.profile_photo_enforcement_cases c
    SET status = 'resolved', resolved_at = now(), updated_at = now()
    WHERE c.profile_id = NEW.id
      AND c.status = 'active'
      AND c.photo_url IS DISTINCT FROM NEW.photo_url
      AND NOT (c.photo_url = ANY(COALESCE(NEW.avatar_urls, '{}'::text[])))
    RETURNING c.audit_id
  )
  UPDATE public.profile_photo_audits a
  SET review_status = 'cleared', reviewed_at = now()
  FROM resolved r
  WHERE a.id = r.audit_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_removed_profile_photo_cases_trigger ON public.profiles;
CREATE TRIGGER resolve_removed_profile_photo_cases_trigger
AFTER UPDATE OF photo_url, avatar_urls ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.resolve_removed_profile_photo_cases();

REVOKE ALL ON FUNCTION public.admin_fake_profile_queue(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fake_profile_queue(text, integer, integer) TO service_role;
