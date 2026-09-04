/*
# Harden real ARAS schema

This migration targets the production schema described in "Schema SQL ARAS.docx":
profiles, swipes, matches, messages, events, event_registrations, blocks, reports.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
      AND ar.role IN ('admin', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'swipes_swiper_swiped_unique'
  ) THEN
    ALTER TABLE public.swipes
    ADD CONSTRAINT swipes_swiper_swiped_unique UNIQUE (swiper_id, swiped_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_pair_unique'
  ) THEN
    ALTER TABLE public.matches
    ADD CONSTRAINT matches_pair_unique UNIQUE (user_1_id, user_2_id);
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view roles" ON public.admin_roles;
CREATE POLICY "Admins can view roles"
ON public.admin_roles FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view active profiles" ON public.profiles;
CREATE POLICY "Public can view active profiles"
ON public.profiles FOR SELECT
TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
ON public.profiles FOR ALL
TO authenticated USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own swipes" ON public.swipes;
CREATE POLICY "Users can view own swipes"
ON public.swipes FOR SELECT
TO authenticated USING (auth.uid() = swiper_id OR auth.uid() = swiped_id);

DROP POLICY IF EXISTS "Users can create own swipes" ON public.swipes;
CREATE POLICY "Users can create own swipes"
ON public.swipes FOR INSERT
TO authenticated WITH CHECK (auth.uid() = swiper_id AND swiper_id <> swiped_id);

DROP POLICY IF EXISTS "Users can update own swipes" ON public.swipes;
CREATE POLICY "Users can update own swipes"
ON public.swipes FOR UPDATE
TO authenticated USING (auth.uid() = swiper_id)
WITH CHECK (auth.uid() = swiper_id AND swiper_id <> swiped_id);

DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
ON public.matches FOR SELECT
TO authenticated USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

DROP POLICY IF EXISTS "Users can create reciprocal matches" ON public.matches;
CREATE POLICY "Users can create reciprocal matches"
ON public.matches FOR INSERT
TO authenticated WITH CHECK (
  auth.uid() IN (user_1_id, user_2_id)
  AND user_1_id <> user_2_id
  AND EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = user_1_id AND swiped_id = user_2_id AND type IN ('like', 'superlike')
  )
  AND EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = user_2_id AND swiped_id = user_1_id AND type IN ('like', 'superlike')
  )
);

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send own match messages" ON public.messages;
CREATE POLICY "Users can send own match messages"
ON public.messages FOR INSERT
TO authenticated WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND sender_id IN (m.user_1_id, m.user_2_id)
      AND receiver_id IN (m.user_1_id, m.user_2_id)
  )
);

DROP POLICY IF EXISTS "Users can mark received messages read" ON public.messages;
CREATE POLICY "Users can mark received messages read"
ON public.messages FOR UPDATE
TO authenticated USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Public can view events" ON public.events;
CREATE POLICY "Public can view events"
ON public.events FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can register to events" ON public.event_registrations;
CREATE POLICY "Users can register to events"
ON public.event_registrations FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own registrations" ON public.event_registrations;
CREATE POLICY "Users can view own registrations"
ON public.event_registrations FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create blocks" ON public.blocks;
CREATE POLICY "Users can create blocks"
ON public.blocks FOR INSERT
TO authenticated WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocks;
CREATE POLICY "Users can view own blocks"
ON public.blocks FOR SELECT
TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports"
ON public.reports FOR INSERT
TO authenticated WITH CHECK (auth.uid() = reporter_id AND reporter_id <> reported_id);

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports"
ON public.reports FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
ON public.reports FOR UPDATE
TO authenticated USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_match_from_swipe(target_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  first_user_id uuid;
  second_user_id uuid;
  match_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF target_profile_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot match yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_profile_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target profile unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = current_user_id
      AND swiped_id = target_profile_id
      AND type IN ('like', 'superlike')
  ) THEN
    RAISE EXCEPTION 'Current user has not liked this profile';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.swipes
    WHERE swiper_id = target_profile_id
      AND swiped_id = current_user_id
      AND type IN ('like', 'superlike')
  ) THEN
    RETURN NULL;
  END IF;

  first_user_id := LEAST(current_user_id, target_profile_id);
  second_user_id := GREATEST(current_user_id, target_profile_id);

  INSERT INTO public.matches (user_1_id, user_2_id)
  VALUES (first_user_id, second_user_id)
  ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO match_id;

  RETURN match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match_from_swipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_from_swipe(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
) WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
