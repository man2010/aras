ALTER TABLE public.profile_photo_enforcement_cases
  DROP CONSTRAINT IF EXISTS profile_photo_enforcement_cases_warning_hours_check;

ALTER TABLE public.profile_photo_enforcement_cases
  ADD CONSTRAINT profile_photo_enforcement_cases_warning_hours_check
  CHECK (warning_hours IN (24, 48, 72, 96, 168, 336, 504, 720));
