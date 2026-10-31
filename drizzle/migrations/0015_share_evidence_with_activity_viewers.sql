-- Evidence objects stay in their owner's folder, but a joint activity is visible to every agent
-- listed in participant_agents and to coordinators, administrators and viewers. Those readers can
-- open the activity row but the storage read policy only matched the owner's folder, so the signed
-- URLs behind its images were refused for everyone else. The extra policy grants read access to an
-- object when it is referenced by an activity the current user can already read; the row policy on
-- public.activities is what keeps the visibility rules in one place.

CREATE POLICY "read shared evidence" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ari-evidence'
  AND public.is_account_approved(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.activities AS a
    WHERE a.evidence ? name
  )
);
