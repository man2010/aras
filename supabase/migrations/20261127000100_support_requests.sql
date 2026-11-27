CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('account', 'technical', 'billing', 'moderation', 'events', 'other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_status_created_idx ON public.support_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_requests_category_created_idx ON public.support_requests (category, created_at DESC);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view support requests" ON public.support_requests;
CREATE POLICY "Admins can view support requests" ON public.support_requests FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can update support requests" ON public.support_requests;
CREATE POLICY "Admins can update support requests" ON public.support_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.support_requests FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.support_requests TO authenticated;
GRANT INSERT ON public.support_requests TO service_role;

CREATE OR REPLACE FUNCTION public.set_support_request_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS support_requests_set_updated_at ON public.support_requests;
CREATE TRIGGER support_requests_set_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.set_support_request_updated_at();
