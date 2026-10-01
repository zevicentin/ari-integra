DROP POLICY IF EXISTS "read own evidence" ON storage.objects;
DROP POLICY IF EXISTS "upload own evidence" ON storage.objects;
DROP POLICY IF EXISTS "delete own evidence" ON storage.objects;

CREATE POLICY "read own evidence" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ari-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_account_approved(auth.uid())
);
CREATE POLICY "upload own evidence" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ari-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_account_approved(auth.uid())
);
CREATE POLICY "delete own evidence" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ari-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_account_approved(auth.uid())
);

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
REVOKE ALL ON FUNCTION public.coordination_participants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coordination_participants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordination_participants() TO service_role;