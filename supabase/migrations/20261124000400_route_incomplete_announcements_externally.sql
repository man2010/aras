CREATE OR REPLACE FUNCTION public.send_moderator_announcement_batch(
  p_title text,
  p_body text,
  p_recipient_ids uuid[] DEFAULT '{}',
  p_target_incomplete_only boolean DEFAULT false,
  p_target_gender text DEFAULT NULL,
  p_send_to_all boolean DEFAULT false
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
  target_ids uuid[] := COALESCE(p_recipient_ids, '{}');
BEGIN
  IF sender IS NULL OR NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Accès réservé au personnel de modération.' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
     OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Le titre doit faire 1 à 120 caractères et le message 1 à 2000 caractères.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(target_ids) > 500 THEN
    RAISE EXCEPTION 'La sélection dépasse 500 membres.' USING ERRCODE = '22023';
  END IF;
  IF p_target_gender IS NOT NULL AND p_target_gender NOT IN ('Homme', 'Femme') THEN
    RAISE EXCEPTION 'Le genre ciblé est invalide.' USING ERRCODE = '22023';
  END IF;
  IF ((CASE WHEN p_send_to_all THEN 1 ELSE 0 END)
      + (CASE WHEN p_target_incomplete_only THEN 1 ELSE 0 END)
      + (CASE WHEN cardinality(target_ids) > 0 THEN 1 ELSE 0 END)) <> 1 THEN
    RAISE EXCEPTION 'Choisis soit tout le monde, soit les comptes incomplets, soit une sélection de profils.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(target_ids) > 0 AND EXISTS (
    SELECT 1 FROM unnest(target_ids) selected_id
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = selected_id)
       OR public.is_admin_user(selected_id)
  ) THEN
    RAISE EXCEPTION 'Un ou plusieurs profils sélectionnés ne sont pas disponibles.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.moderator_announcements (sender_id, recipient_id, recipient_ids, target_incomplete_only, title, body)
  VALUES (
    sender,
    CASE WHEN cardinality(target_ids) = 1 THEN target_ids[1] ELSE NULL END,
    target_ids,
    p_target_incomplete_only,
    btrim(p_title),
    btrim(p_body)
  )
  RETURNING id INTO new_announcement_id;

  -- Les comptes en onboarding sont contactés par e-mail/SMS depuis l’API.
  -- Ils ne doivent jamais recevoir de notification interne inaccessible.
  INSERT INTO public.user_notifications (user_id, actor_id, kind, title, body)
  SELECT p.id, sender, 'moderator_announcement', btrim(p_title), btrim(p_body)
  FROM public.profiles p
  WHERE NOT public.is_admin_user(p.id)
    AND COALESCE(p.onboarding_completed, false) = true
    AND COALESCE(p.profile_status, '') = 'completed'
    AND (
      p_send_to_all
      OR p.id = ANY(target_ids)
    );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.moderator_announcements ma
  SET recipient_count = inserted_count
  WHERE ma.id = new_announcement_id;

  RETURN QUERY SELECT new_announcement_id, inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_moderator_announcement_batch(text, text, uuid[], boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_moderator_announcement_batch(text, text, uuid[], boolean, text, boolean) TO authenticated;
