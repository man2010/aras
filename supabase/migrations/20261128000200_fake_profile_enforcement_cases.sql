CREATE TABLE IF NOT EXISTS public.profile_photo_enforcement_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL UNIQUE REFERENCES public.profile_photo_audits(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  warning_count integer NOT NULL DEFAULT 1 CHECK (warning_count BETWEEN 1 AND 2),
  warning_hours integer NOT NULL CHECK (warning_hours IN (24, 48, 72, 96, 168, 336, 504, 720)),
  warned_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'blocked')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_photo_enforcement_due_idx
  ON public.profile_photo_enforcement_cases (deadline_at, warning_hours)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS profile_photo_enforcement_profile_idx
  ON public.profile_photo_enforcement_cases (profile_id, status, deadline_at DESC);

ALTER TABLE public.profile_photo_enforcement_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_photo_enforcement_cases FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_removed_profile_photo_cases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profile_photo_enforcement_cases c
  SET status = 'resolved', resolved_at = now(), updated_at = now()
  WHERE c.profile_id = NEW.id
    AND c.status = 'active'
    AND c.photo_url IS DISTINCT FROM NEW.photo_url
    AND NOT (c.photo_url = ANY(COALESCE(NEW.avatar_urls, '{}'::text[])));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_removed_profile_photo_cases_trigger ON public.profiles;
CREATE TRIGGER resolve_removed_profile_photo_cases_trigger
AFTER UPDATE OF photo_url, avatar_urls ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.resolve_removed_profile_photo_cases();

CREATE OR REPLACE FUNCTION public.admin_fake_profile_overdue_queue(
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
  WITH overdue AS (
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
      AND c.deadline_at <= now()
      AND p.is_active IS TRUE
      AND p.onboarding_completed IS TRUE
      AND p.profile_status = 'completed'
      AND (c.photo_url = p.photo_url OR c.photo_url = ANY(COALESCE(p.avatar_urls, '{}'::text[])))
      AND (p_warning_hours IS NULL OR c.warning_hours = p_warning_hours)
  )
  SELECT overdue.*, count(*) OVER () AS total_count
  FROM overdue
  ORDER BY deadline_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.admin_fake_profile_overdue_queue(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fake_profile_overdue_queue(integer, integer, integer) TO service_role;
