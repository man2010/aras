-- Prevent authenticated clients from bypassing the server-side moderation route
-- by uploading profile photos directly to the public avatars bucket.
-- Other avatar bucket paths remain available to existing application features.
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND name NOT LIKE (auth.uid()::text || '/profile-%')
);

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND name NOT LIKE (auth.uid()::text || '/profile-%')
) WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND name NOT LIKE (auth.uid()::text || '/profile-%')
);
