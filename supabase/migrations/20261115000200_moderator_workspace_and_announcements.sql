-- Separate moderator access from the admin back office and add audited
-- in-app announcements to all members or to one member.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid() AND ar.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid() AND ar.role IN ('admin', 'moderator')
  );
$$;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ar.role FROM public.admin_roles ar WHERE ar.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

DROP POLICY IF EXISTS "Moderators can view reports" ON public.reports;
CREATE POLICY "Moderators can view reports"
  ON public.reports FOR SELECT TO authenticated USING (public.is_moderator());
DROP POLICY IF EXISTS "Moderators can update reports" ON public.reports;
CREATE POLICY "Moderators can update reports"
  ON public.reports FOR UPDATE TO authenticated USING (public.is_moderator()) WITH CHECK (public.is_moderator());

CREATE TABLE IF NOT EXISTS public.moderator_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderator_announcements_created_idx
  ON public.moderator_announcements (created_at DESC);
ALTER TABLE public.moderator_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderator_announcements FROM anon, authenticated;
GRANT SELECT ON public.moderator_announcements TO authenticated;
DROP POLICY IF EXISTS "Staff can view moderator announcements" ON public.moderator_announcements;
CREATE POLICY "Staff can view moderator announcements"
  ON public.moderator_announcements FOR SELECT TO authenticated USING (public.is_moderator());

CREATE OR REPLACE FUNCTION public.send_moderator_announcement(
  p_title text,
  p_body text,
  p_recipient_id uuid DEFAULT NULL
)
RETURNS TABLE (announcement_id uuid, recipient_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender uuid := auth.uid();
  new_announcement_id uuid;
  inserted_count integer := 0;
BEGIN
  IF sender IS NULL OR NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Accès réservé au personnel de modération.' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
     OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Le titre doit faire 1 à 120 caractères et le message 1 à 2000 caractères.' USING ERRCODE = '22023';
  END IF;

  IF p_recipient_id IS NOT NULL AND (
    NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_recipient_id)
    OR public.is_admin_user(p_recipient_id)
  ) THEN
    RAISE EXCEPTION 'Ce destinataire est introuvable ou ne peut pas recevoir de message membre.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.moderator_announcements (sender_id, recipient_id, title, body)
  VALUES (sender, p_recipient_id, btrim(p_title), btrim(p_body))
  RETURNING id INTO new_announcement_id;

  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
  SELECT p.id, sender, 'moderator_announcement', btrim(p_title), btrim(p_body)
  FROM public.profiles p
  WHERE (p_recipient_id IS NULL OR p.id = p_recipient_id)
    AND NOT public.is_admin_user(p.id);
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.moderator_announcements ma
  SET recipient_count = inserted_count
  WHERE ma.id = new_announcement_id;

  RETURN QUERY SELECT new_announcement_id, inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.send_moderator_announcement(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_moderator_announcement(text, text, uuid) TO authenticated;
