-- Persist Golden requests so the admin queue can be used without relying on email inboxes.
CREATE TABLE IF NOT EXISTS public.golden_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Femme', 'Homme')),
  birthdate date NOT NULL,
  location text NOT NULL,
  marital_status text NOT NULL,
  religion text,
  age_range text,
  preferred_location text,
  expectations text,
  contact text NOT NULL,
  preferred_contact text NOT NULL,
  privacy_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'archived')),
  private_notes text,
  suggested_match_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  proposed_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.golden_requests ADD COLUMN IF NOT EXISTS proposed_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS golden_requests_status_created_idx ON public.golden_requests (status, created_at DESC);
ALTER TABLE public.golden_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view golden requests" ON public.golden_requests;
CREATE POLICY "Admins can view golden requests" ON public.golden_requests FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can update golden requests" ON public.golden_requests;
CREATE POLICY "Admins can update golden requests" ON public.golden_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.golden_requests FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.golden_requests TO authenticated;

-- Usage telemetry contains no prompts or answers; it only supports aggregate SARA counts.
CREATE TABLE IF NOT EXISTS public.sara_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outcome text NOT NULL CHECK (outcome IN ('answered', 'fallback', 'disabled', 'error')),
  model text,
  elapsed_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sara_usage_events_created_idx ON public.sara_usage_events (created_at DESC);
ALTER TABLE public.sara_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view SARA aggregate logs" ON public.sara_usage_events;
CREATE POLICY "Admins can view SARA aggregate logs" ON public.sara_usage_events FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.sara_usage_events FROM anon, authenticated;
GRANT SELECT ON public.sara_usage_events TO authenticated;
GRANT INSERT ON public.sara_usage_events TO service_role;

-- Admins may update catalog pricing. Public users still only see active plans.
INSERT INTO public.subscription_plans (code, name, price_fcfa, billing_period, features, sort_order)
VALUES ('golden', 'Golden', 29500, 'none', '["Accompagnement personnalisé", "Événements privés"]'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;
UPDATE public.subscription_plans SET price_fcfa = 4500 WHERE code = 'premium';
UPDATE public.subscription_plans SET price_fcfa = 14500 WHERE code = 'elite';
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage subscription plans" ON public.subscription_plans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT UPDATE ON public.subscription_plans TO authenticated;

ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS attended_at timestamptz;
DROP POLICY IF EXISTS "Admins can mark event attendance" ON public.event_registrations;
CREATE POLICY "Admins can mark event attendance" ON public.event_registrations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT UPDATE (attended_at) ON public.event_registrations TO authenticated;

-- Add constrained metadata for app settings used by the admin console; values remain in settings.
