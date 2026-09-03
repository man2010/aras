/*
# Create ARAS events and visitor reservations

1. New Tables
- `aras_events`: public discovery events with title, location, date, capacity, price, image and status.
- `aras_event_reservations`: reservation requests for visitors or members, storing contact details and the selected event.

2. Security
- Row Level Security is enabled on both tables.
- Events are readable by anonymous and authenticated visitors because the event catalogue is intentionally public.
- Reservations may be created by anonymous and authenticated visitors, while reservation details remain private to the service role for operational follow-up.

3. Important notes
- Event prices are stored in FCFA as integers.
- A zero price represents a free event and should render an immediate “S’inscrire” action.
- The reservation table does not expose read access to browser roles to protect contact information.
*/

CREATE TABLE IF NOT EXISTS public.aras_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  event_date timestamptz NOT NULL,
  price_fcfa integer NOT NULL DEFAULT 0 CHECK (price_fcfa >= 0),
  capacity integer NOT NULL DEFAULT 30 CHECK (capacity > 0),
  image_url text NOT NULL,
  category text NOT NULL DEFAULT 'Rencontre',
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aras_event_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.aras_events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  contact text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aras_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_event_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view ARAS events" ON public.aras_events;
CREATE POLICY "Public can view ARAS events"
ON public.aras_events FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Visitors can reserve ARAS events" ON public.aras_event_reservations;
CREATE POLICY "Visitors can reserve ARAS events"
ON public.aras_event_reservations FOR INSERT
TO anon, authenticated WITH CHECK (char_length(full_name) BETWEEN 2 AND 120 AND char_length(contact) BETWEEN 5 AND 180);

INSERT INTO public.aras_events (title, description, location, event_date, price_fcfa, capacity, image_url, category, is_featured)
SELECT * FROM (VALUES
  ('Dîner sous les étoiles', 'Une soirée intime pour prendre le temps de se découvrir autour d’une table généreuse.', 'Dakar · Almadies', '2026-09-18T19:30:00+00'::timestamptz, 15000, 24, 'https://images.pexels.com/photos/5632400/pexels-photo-5632400.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Dîner', true),
  ('Sunset & conversations', 'Un moment simple, doux et authentique face à l’océan, pensé pour les belles premières rencontres.', 'Dakar · Ngor', '2026-09-26T17:00:00+00'::timestamptz, 0, 40, 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Apéro', true),
  ('Brunch Téranga', 'Des conversations légères, des sourires et une parenthèse chaleureuse le dimanche matin.', 'Dakar · Fann', '2026-10-04T11:00:00+00'::timestamptz, 8000, 30, 'https://images.pexels.com/photos/3184183/pexels-photo-3184183.jpeg?auto=compress&cs=tinysrgb&w=1200', 'Brunch', false)
) AS seed(title, description, location, event_date, price_fcfa, capacity, image_url, category, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM public.aras_events);
