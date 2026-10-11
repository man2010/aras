DO $$
DECLARE
  target_user_id uuid;
  target_phone text := '+33782141887'; -- Remplace par le numéro à supprimer
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE regexp_replace(phone, '[^0-9]', '', 'g')
      = regexp_replace(target_phone, '[^0-9]', '', 'g');

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun compte trouvé pour ce numéro';
  END IF;

  DELETE FROM public.admin_activity_logs WHERE user_id = target_user_id;
  DELETE FROM public.event_registrations WHERE user_id = target_user_id;
  DELETE FROM public.user_notifications WHERE user_id = target_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.stories WHERE user_id = target_user_id;
  DELETE FROM public.admin_roles WHERE user_id = target_user_id;
  DELETE FROM public.messages
    WHERE sender_id = target_user_id OR receiver_id = target_user_id;

  DELETE FROM public.profile_visits
    WHERE visitor_id = target_user_id OR profile_id = target_user_id;
  DELETE FROM public.swipes
    WHERE swiper_id = target_user_id OR swiped_id = target_user_id;
  DELETE FROM public.blocks
    WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  DELETE FROM public.reports
    WHERE reporter_id = target_user_id OR reported_id = target_user_id;
  DELETE FROM public.matches
    WHERE user_1_id = target_user_id OR user_2_id = target_user_id;

  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END $$;