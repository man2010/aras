-- Standardize reports used by the member flow and admin moderation page.
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'other',
  reason text NOT NULL DEFAULT '',
  description text,
  status text NOT NULL DEFAULT 'pending',
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'other';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'reported_profile_id'
  ) THEN
    EXECUTE 'UPDATE public.reports SET reported_id = reported_profile_id WHERE reported_id IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'status'
  ) THEN
    UPDATE public.reports SET resolved = true WHERE status = 'resolved' AND resolved = false;
  END IF;
END $$;

-- Preserve reports recorded in the legacy table created by the first schema.
DO $$
BEGIN
  IF to_regclass('public.aras_reports') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO public.reports (id, reporter_id, reported_id, type, reason, status, resolved, created_at)
      SELECT id, reporter_id, reported_profile_id, type, reason,
             CASE WHEN status = 'resolved' THEN 'resolved' ELSE 'pending' END,
             status = 'resolved', created_at
      FROM public.aras_reports
      WHERE reported_profile_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = aras_reports.reported_profile_id)
      ON CONFLICT (id) DO NOTHING
    $copy$;
  END IF;
END $$;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create own reports" ON public.reports;
CREATE POLICY "Users can create own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND reporter_id <> reported_id);
DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports"
  ON public.reports FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('login')),
  country text,
  region text,
  city text,
  browser text,
  operating_system text,
  device text,
  user_agent text,
  page text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_logs_kind_created_idx ON public.admin_activity_logs (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_logs_user_created_idx ON public.admin_activity_logs (user_id, created_at DESC);
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;
CREATE POLICY "Admins can view activity logs"
  ON public.admin_activity_logs FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.admin_activity_logs FROM anon, authenticated;
GRANT SELECT ON public.admin_activity_logs TO authenticated;

-- The admin console uses the browser Supabase client; explicitly permit admins
-- to read the operational rows it aggregates, without widening member access.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can view all matches" ON public.matches;
CREATE POLICY "Admins can view all matches"
  ON public.matches FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can view all swipes" ON public.swipes;
CREATE POLICY "Admins can view all swipes"
  ON public.swipes FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can view all event registrations" ON public.event_registrations;
CREATE POLICY "Admins can view all event registrations"
  ON public.event_registrations FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
CREATE POLICY "Admins can delete messages"
  ON public.messages FOR DELETE TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reports') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_registrations') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations;
    END IF;
  END IF;
END $$;
