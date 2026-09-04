/*
# Create ARAS reports table for admin moderation
*/

CREATE TABLE IF NOT EXISTS public.aras_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_profile_id uuid NOT NULL REFERENCES public.aras_profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'other',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aras_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create reports
CREATE POLICY "Users can create reports"
  ON public.aras_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Policy: Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.aras_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Admins can update reports
CREATE POLICY "Admins can update reports"
  ON public.aras_reports
  FOR UPDATE
  TO authenticated
  USING (true);