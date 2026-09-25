CREATE OR REPLACE FUNCTION public.get_latest_match_messages(target_match_ids uuid[])
RETURNS TABLE (match_id uuid, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT DISTINCT ON (message.match_id)
    message.match_id,
    message.content,
    message.created_at
  FROM public.messages AS message
  WHERE message.match_id = ANY(COALESCE(target_match_ids, ARRAY[]::uuid[]))
  ORDER BY message.match_id, message.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_latest_match_messages(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_match_messages(uuid[]) TO authenticated;

CREATE INDEX IF NOT EXISTS swipes_swiped_type_idx
  ON public.swipes (swiped_id, type);

CREATE INDEX IF NOT EXISTS messages_match_created_at_idx
  ON public.messages (match_id, created_at DESC);
