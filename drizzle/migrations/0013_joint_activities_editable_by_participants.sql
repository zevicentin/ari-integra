-- An activity launched jointly belongs to every agent listed in participant_agents: after it is
-- saved, each of them can edit it, not only whoever launched it. Only the update policy gains the
-- participant branch, mirroring the read policy from 0011 — insert stays owner-only, delete stays
-- with the owner and administrators, coordinators stay read-only and viewers cannot write at all.

DROP POLICY IF EXISTS "update activities" ON public.activities;

CREATE POLICY "update activities" ON public.activities FOR UPDATE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    ((owner_id = auth.uid() OR participant_agents @> ARRAY[auth.uid()])
      AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  public.is_account_approved(auth.uid()) AND (
    ((owner_id = auth.uid() OR participant_agents @> ARRAY[auth.uid()])
      AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);
