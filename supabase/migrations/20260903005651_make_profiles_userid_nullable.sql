/*
# Make aras_profiles user_id nullable for demo profiles

1. Schema change
- ALTER aras_profiles.user_id to be nullable so demo/featured profiles can be seeded without an auth context
- Real user profiles created via the app will still set user_id via auth.uid() default
*/

ALTER TABLE public.aras_profiles ALTER COLUMN user_id DROP NOT NULL;
