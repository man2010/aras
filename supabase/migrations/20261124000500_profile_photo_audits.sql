CREATE TABLE IF NOT EXISTS public.profile_photo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  scan_status text NOT NULL CHECK (scan_status IN ('flagged', 'compliant', 'error')),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'warned', 'blocked', 'cleared')),
  reason text,
  celebrity_names text[] NOT NULL DEFAULT '{}',
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (profile_id, photo_url)
);

CREATE INDEX IF NOT EXISTS profile_photo_audits_queue_idx
  ON public.profile_photo_audits (review_status, scanned_at DESC)
  WHERE scan_status = 'flagged';
CREATE INDEX IF NOT EXISTS profile_photo_audits_profile_idx
  ON public.profile_photo_audits (profile_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_photo_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  profiles_scanned integer NOT NULL DEFAULT 0,
  photos_scanned integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS profile_photo_audit_runs_started_idx
  ON public.profile_photo_audit_runs (started_at DESC);

ALTER TABLE public.profile_photo_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_photo_audits FROM anon, authenticated;
ALTER TABLE public.profile_photo_audit_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_photo_audit_runs FROM anon, authenticated;
