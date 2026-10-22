-- Remove only the showcase events seeded as fictional examples.
-- Registrations are removed with their event records so no orphaned demo
-- participation data remains. Events created independently are preserved.
BEGIN;

DELETE FROM public.event_registrations AS registration
USING public.events AS event
WHERE registration.event_id = event.id
  AND (event.title, event.date) IN (
    ('Dîner sous les étoiles', '2026-10-16T19:30:00+00'::timestamptz),
    ('Sunset & conversations', '2026-10-24T17:00:00+00'::timestamptz),
    ('Brunch Téranga', '2026-11-08T11:00:00+00'::timestamptz)
  );

DELETE FROM public.events AS event
WHERE (event.title, event.date) IN (
  ('Dîner sous les étoiles', '2026-10-16T19:30:00+00'::timestamptz),
  ('Sunset & conversations', '2026-10-24T17:00:00+00'::timestamptz),
  ('Brunch Téranga', '2026-11-08T11:00:00+00'::timestamptz)
);

COMMIT;
