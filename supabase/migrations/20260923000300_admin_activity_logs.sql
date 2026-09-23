-- Detailed login audit entries for the admin activity journal.
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

-- Ensure the admin roster can read registrations under RLS.
DROP POLICY IF EXISTS "Admins can view all event registrations" ON public.event_registrations;
CREATE POLICY "Admins can view all event registrations"
  ON public.event_registrations FOR SELECT TO authenticated USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_registrations') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_activity_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_activity_logs;
    END IF;
  END IF;
END $$;
