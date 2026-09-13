/*
  Empêche les utilisateurs de s'auto-attribuer le badge is_verified.
  Seul le service role (API serveur après Turnstile) ou un admin peut définir is_verified à true.
*/

CREATE OR REPLACE FUNCTION public.profiles_guard_is_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.is_verified := OLD.is_verified;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_is_verified_trigger ON public.profiles;
CREATE TRIGGER profiles_guard_is_verified_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_is_verified();
