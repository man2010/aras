-- The application profiles table stores the member name in full_name.
-- Repair already-installed snapshot RPCs that were generated against display_name.
DO $$
DECLARE
  function_definition text;
  target_function regprocedure;
BEGIN
  FOREACH target_function IN ARRAY ARRAY[
    'public.get_admin_analytics_snapshot(date,date)'::regprocedure,
    'public.get_admin_recent_activity(integer)'::regprocedure
  ]
  LOOP
    function_definition := pg_get_functiondef(target_function);
    IF position('display_name' IN function_definition) > 0 THEN
      EXECUTE replace(function_definition, 'display_name', 'full_name');
    END IF;
  END LOOP;
END;
$$;
