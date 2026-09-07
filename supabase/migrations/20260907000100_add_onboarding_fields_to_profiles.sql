/*
Add onboarding fields to public.profiles.
This keeps auth in auth.users and profile progress in public.profiles.
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS birthdate date,
ADD COLUMN IF NOT EXISTS location_label text,
ADD COLUMN IF NOT EXISTS lat numeric,
ADD COLUMN IF NOT EXISTS lng numeric,
ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_profile_status_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_profile_status_check
    CHECK (profile_status IN ('pending', 'verified', 'completed'));
  END IF;
END $$;

