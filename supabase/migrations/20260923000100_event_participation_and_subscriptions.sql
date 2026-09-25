-- Align the existing events table with the application's active-event filters.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Real event catalog seed, idempotent against the existing public.events schema.
-- These three showcase events previously existed only as frontend fallbacks.
INSERT INTO public.events
  (title, description, date, location, city, image_url, total_places, remaining_places, price, is_active)
SELECT seed.title, seed.description, seed.date, seed.location, seed.city,
       seed.image_url, seed.total_places, seed.total_places, seed.price, true
FROM (VALUES
  ('Dîner sous les étoiles', 'Une soirée intime pour prendre le temps de se découvrir autour d’une table généreuse.', '2026-10-16T19:30:00+00'::timestamptz, 'Almadies', 'Dakar', 'https://images.pexels.com/photos/18823960/pexels-photo-18823960.jpeg?auto=compress&cs=tinysrgb&w=1200', 24, 15000),
  ('Sunset & conversations', 'Un moment simple, doux et authentique face à l’océan, pensé pour les belles premières rencontres.', '2026-10-24T17:00:00+00'::timestamptz, 'Ngor', 'Dakar', 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200', 40, 0),
  ('Brunch Téranga', 'Des conversations légères, des sourires et une parenthèse chaleureuse le dimanche matin.', '2026-11-08T11:00:00+00'::timestamptz, 'Fann', 'Dakar', 'https://images.pexels.com/photos/4878006/pexels-photo-4878006.jpeg?auto=compress&cs=tinysrgb&w=1200', 30, 8000)
) AS seed(title, description, date, location, city, image_url, total_places, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.events existing
  WHERE existing.title = seed.title AND existing.date = seed.date
);

-- A member can only have one active registration per event.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_user_event_unique
  ON public.event_registrations (user_id, event_id);

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_event_registrations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_registrations_set_updated_at ON public.event_registrations;
CREATE TRIGGER event_registrations_set_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_event_registrations_updated_at();

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_status_check
  CHECK (status IN ('confirmed', 'payment_pending', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users can mark own notifications read"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_event_place()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET remaining_places = remaining_places - 1
  WHERE id = NEW.event_id
    AND is_active = true
    AND date > now()
    AND remaining_places > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cet événement est complet ou n’accepte plus de participations';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_registration_reserve_place ON public.event_registrations;
CREATE TRIGGER event_registration_reserve_place
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.reserve_event_place();

CREATE OR REPLACE FUNCTION public.register_for_event(target_event_id uuid)
RETURNS TABLE(registration_status text, event_title text, event_date timestamptz, event_price integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  selected_event public.events%ROWTYPE;
  prior_status text;
  new_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO selected_event
  FROM public.events
  WHERE id = target_event_id AND is_active = true AND date > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_UNAVAILABLE';
  END IF;

  SELECT er.status INTO prior_status
  FROM public.event_registrations er
  WHERE er.event_id = target_event_id AND er.user_id = current_user_id;

  IF FOUND AND prior_status <> 'cancelled' THEN
    RETURN QUERY SELECT prior_status, selected_event.title, selected_event.date, COALESCE(selected_event.price, 0)::integer;
    RETURN;
  END IF;

  IF COALESCE(selected_event.remaining_places, 0) <= 0 THEN
    RAISE EXCEPTION 'EVENT_FULL';
  END IF;

  new_status := CASE WHEN COALESCE(selected_event.price, 0) = 0 THEN 'confirmed' ELSE 'payment_pending' END;

  IF prior_status = 'cancelled' THEN
    UPDATE public.event_registrations
    SET status = new_status, created_at = now()
    WHERE event_id = target_event_id AND user_id = current_user_id;
    UPDATE public.events SET remaining_places = remaining_places - 1 WHERE id = target_event_id;
  ELSE
    INSERT INTO public.event_registrations (event_id, user_id, status)
    VALUES (target_event_id, current_user_id, new_status);
  END IF;

  INSERT INTO public.user_notifications (user_id, event_id, kind, title, body)
  VALUES (
    current_user_id,
    target_event_id,
    'event_registration',
    CASE WHEN new_status = 'confirmed' THEN 'Participation confirmée' ELSE 'Paiement requis pour confirmer' END,
    CASE WHEN new_status = 'confirmed'
      THEN 'Ta place pour « ' || selected_event.title || ' » est confirmée. Un rappel sera envoyé à l’approche de l’événement.'
      ELSE 'Ta demande pour « ' || selected_event.title || ' » est enregistrée. La place sera confirmée après paiement.'
    END
  );

  RETURN QUERY SELECT new_status, selected_event.title, selected_event.date, COALESCE(selected_event.price, 0)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid) TO authenticated;
REVOKE INSERT ON public.event_registrations FROM authenticated;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  price_fcfa integer NOT NULL CHECK (price_fcfa >= 0),
  billing_period text NOT NULL CHECK (billing_period IN ('month', 'year', 'none')),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.subscription_plans (code, name, price_fcfa, billing_period, features, sort_order)
VALUES
  ('discovery', 'Découverte', 0, 'none', '["Création du profil", "Découverte", "Participation aux événements"]'::jsonb, 0),
  ('premium', 'Premium', 5000, 'month', '["Likes illimités", "Voir qui vous a liké", "Messagerie illimitée", "Filtres avancés", "Priorité aux événements"]'::jsonb, 1),
  ('elite', 'Élite', 15000, 'month', '["Tous les avantages Premium", "Événements privés", "Profil mis en avant", "Accompagnement dédié"]'::jsonb, 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_fcfa = EXCLUDED.price_fcfa,
  billing_period = EXCLUDED.billing_period,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans(code),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_provider text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_status_idx
  ON public.user_subscriptions (user_id, status, ends_at DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can manage subscriptions"
  ON public.user_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
