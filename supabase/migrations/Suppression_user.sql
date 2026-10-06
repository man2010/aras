DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('basyllandeye@gmail.com');

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun compte trouvé pour cet e-mail';
  END IF;

  -- Données liées directement à auth.users
  DELETE FROM public.admin_activity_logs WHERE user_id = target_user_id;
  DELETE FROM public.event_registrations WHERE user_id = target_user_id;
  DELETE FROM public.user_notifications WHERE user_id = target_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.stories WHERE user_id = target_user_id;
  DELETE FROM public.admin_roles WHERE user_id = target_user_id;
  DELETE FROM public.messages
    WHERE sender_id = target_user_id OR receiver_id = target_user_id;

  -- Relations liées au profil
  DELETE FROM public.profile_visits
    WHERE visitor_id = target_user_id OR profile_id = target_user_id;
  DELETE FROM public.swipes
    WHERE swiper_id = target_user_id OR swiped_id = target_user_id;
  DELETE FROM public.blocks
    WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  DELETE FROM public.reports
    WHERE reporter_id = target_user_id OR reported_id = target_user_id;

  -- Les messages référencent aussi les matchs
  DELETE FROM public.matches
    WHERE user_1_id = target_user_id OR user_2_id = target_user_id;

  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END $$;