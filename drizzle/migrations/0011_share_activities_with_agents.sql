-- An activity's owner can mark fellow agents who must then see that activity in their own
-- records. Only the read policy gains one more branch: insert, update and delete keep their
-- owner-only shape, so a participant reads the shared row but never edits or removes it.
ALTER TABLE public.activities
  ADD COLUMN participant_agents uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX activities_participant_agents_idx ON public.activities USING gin (participant_agents);

DROP POLICY IF EXISTS "read activities" ON public.activities;

CREATE POLICY "read activities" ON public.activities FOR SELECT TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    owner_id = auth.uid()
    OR participant_agents @> ARRAY[auth.uid()]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'viewer')
  )
);

-- The list behind the field: approved accounts whose granted role is exactly 'agent'. It never
-- returns privileged or viewer accounts, and it is callable only by an approved signed-in user,
-- so picking a participant needs no read access to other accounts' role rows.
CREATE OR REPLACE FUNCTION public.activity_agent_choices()
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles AS p
  WHERE auth.uid() IS NOT NULL
    AND p.approval_status = 'approved'
    AND public.has_role(p.id, 'agent')
  ORDER BY p.full_name, p.id
$$;

REVOKE ALL ON FUNCTION public.activity_agent_choices() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activity_agent_choices() FROM anon;
GRANT EXECUTE ON FUNCTION public.activity_agent_choices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activity_agent_choices() TO service_role;
