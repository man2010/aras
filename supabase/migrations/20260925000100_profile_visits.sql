CREATE TABLE IF NOT EXISTS public.profile_visits (
  visitor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, profile_id),
  CONSTRAINT profile_visits_not_self CHECK (visitor_id <> profile_id)
);

CREATE INDEX IF NOT EXISTS profile_visits_profile_last_viewed_idx
  ON public.profile_visits (profile_id, last_viewed_at DESC);

ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can record profile views" ON public.profile_visits;
CREATE POLICY "Members can record profile views"
  ON public.profile_visits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = visitor_id AND visitor_id <> profile_id);

DROP POLICY IF EXISTS "Members can refresh their recorded views" ON public.profile_visits;
CREATE POLICY "Members can refresh their recorded views"
  ON public.profile_visits FOR UPDATE TO authenticated
  USING (auth.uid() = visitor_id)
  WITH CHECK (auth.uid() = visitor_id AND visitor_id <> profile_id);

DROP POLICY IF EXISTS "Members can view visitors of their profile" ON public.profile_visits;
CREATE POLICY "Members can view visitors of their profile"
  ON public.profile_visits FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

GRANT SELECT, INSERT, UPDATE ON public.profile_visits TO authenticated;

-- Members may remove only likes they sent; without this policy PostgREST can
-- return an empty successful DELETE and the like reappears after a refresh.
DROP POLICY IF EXISTS "Users can delete own swipes" ON public.swipes;
CREATE POLICY "Users can delete own swipes"
  ON public.swipes FOR DELETE TO authenticated
  USING (auth.uid() = swiper_id);
GRANT DELETE ON public.swipes TO authenticated;

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.notify_profile_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.type NOT IN ('like', 'superlike') THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(full_name, '') INTO actor_name
  FROM public.profiles WHERE id = NEW.swiper_id;

  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
  VALUES (NEW.swiped_id, NEW.swiper_id, 'like_received', 'Nouveau like reçu',
          COALESCE(actor_name, 'Une personne') || ' aime votre profil.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS swipes_notify_profile_like ON public.swipes;
CREATE TRIGGER swipes_notify_profile_like
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.notify_profile_like();

CREATE OR REPLACE FUNCTION public.dismiss_revoked_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.type IN ('like', 'superlike') THEN
    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE user_id = OLD.swiped_id
      AND actor_id = OLD.swiper_id
      AND kind = 'like_received'
      AND read_at IS NULL;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS swipes_dismiss_revoked_like_notification ON public.swipes;
CREATE TRIGGER swipes_dismiss_revoked_like_notification
  AFTER DELETE ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.dismiss_revoked_like_notification();
