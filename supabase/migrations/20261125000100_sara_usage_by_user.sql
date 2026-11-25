ALTER TABLE public.sara_usage_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sara_usage_events_user_created_idx
  ON public.sara_usage_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
