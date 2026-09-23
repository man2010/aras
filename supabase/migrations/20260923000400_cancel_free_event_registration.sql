CREATE OR REPLACE FUNCTION public.cancel_free_event_registration(target_event_id uuid)
RETURNS TABLE(cancellation_status text, event_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  selected_event public.events%ROWTYPE;
  current_registration public.event_registrations%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO selected_event
  FROM public.events
  WHERE id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_UNAVAILABLE';
  END IF;
  IF selected_event.date <= now() THEN
    RAISE EXCEPTION 'EVENT_ALREADY_STARTED';
  END IF;

  SELECT * INTO current_registration
  FROM public.event_registrations
  WHERE event_id = target_event_id AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND OR current_registration.status = 'cancelled' THEN
    RETURN QUERY SELECT 'already_cancelled'::text, selected_event.title;
    RETURN;
  END IF;

  IF COALESCE(selected_event.price, 0) > 0 OR current_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION 'PAID_EVENT_CANCELLATION_UNAVAILABLE';
  END IF;

  UPDATE public.event_registrations
  SET status = 'cancelled'
  WHERE event_id = target_event_id AND user_id = current_user_id;

  UPDATE public.events
  SET remaining_places = LEAST(COALESCE(total_places, remaining_places + 1), COALESCE(remaining_places, 0) + 1)
  WHERE id = target_event_id;

  INSERT INTO public.user_notifications (user_id, event_id, kind, title, body)
  VALUES (
    current_user_id,
    target_event_id,
    'event_cancellation',
    'Participation annulée',
    'Ton inscription à « ' || selected_event.title || ' » a été annulée. Ta place est de nouveau disponible.'
  );

  RETURN QUERY SELECT 'cancelled'::text, selected_event.title;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_free_event_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_free_event_registration(uuid) TO authenticated;
