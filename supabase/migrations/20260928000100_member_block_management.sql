-- Allow members to remove block records they created, so the settings page can unblock profiles.
DROP POLICY IF EXISTS "Users can remove own blocks" ON public.blocks;
CREATE POLICY "Users can remove own blocks"
ON public.blocks FOR DELETE
TO authenticated USING (auth.uid() = blocker_id);
