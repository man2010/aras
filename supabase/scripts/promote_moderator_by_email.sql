-- Exécuter dans Supabase SQL Editor après que le compte ait été créé.
-- Remplacer l’adresse ci-dessous par l’adresse exacte du compte à promouvoir.
DO $$
DECLARE
  target_email text := lower(btrim('nibacilaa@gmail.com'));
  target_user_id uuid;
  existing_role text;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = target_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun compte trouvé pour %.', target_email;
  END IF;

  SELECT role INTO existing_role
  FROM public.admin_roles
  WHERE user_id = target_user_id;

  IF existing_role = 'admin' THEN
    RAISE EXCEPTION 'Ce compte est déjà administrateur. La promotion a été annulée.';
  END IF;

  INSERT INTO public.admin_roles (user_id, role)
  VALUES (target_user_id, 'moderator')
  ON CONFLICT (user_id) DO UPDATE SET role = 'moderator';
END $$;
