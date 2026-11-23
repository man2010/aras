-- Keep unfinished onboarding data private to its owner and available across devices.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_draft jsonb;

COMMENT ON COLUMN public.profiles.onboarding_draft IS
  'Private, resumable onboarding form state for this profile owner.';
