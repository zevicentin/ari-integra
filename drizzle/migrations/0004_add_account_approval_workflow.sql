ALTER TABLE public.profiles
  ADD COLUMN requested_role public.app_role,
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles
SET approval_status = 'approved'
WHERE approval_status = 'pending';

CREATE OR REPLACE FUNCTION public.is_account_approved(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND approval_status = 'approved'
  )
$$;

REVOKE ALL ON FUNCTION public.is_account_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_approved(uuid) TO service_role;

DROP POLICY IF EXISTS "read activities" ON public.activities;
DROP POLICY IF EXISTS "insert activities" ON public.activities;
DROP POLICY IF EXISTS "update activities" ON public.activities;
DROP POLICY IF EXISTS "delete activities" ON public.activities;

CREATE POLICY "read activities" ON public.activities FOR SELECT TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'viewer')
  )
);
CREATE POLICY "insert activities" ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_approved(auth.uid())
  AND owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer')
  AND NOT public.has_role(auth.uid(), 'coordinator')
);
CREATE POLICY "update activities" ON public.activities FOR UPDATE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "delete activities" ON public.activities FOR DELETE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "read organizations" ON public.organizations;
DROP POLICY IF EXISTS "insert organizations" ON public.organizations;
DROP POLICY IF EXISTS "update organizations" ON public.organizations;
DROP POLICY IF EXISTS "delete organizations" ON public.organizations;

CREATE POLICY "read organizations" ON public.organizations FOR SELECT TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'viewer')
  )
);
CREATE POLICY "insert organizations" ON public.organizations FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_approved(auth.uid())
  AND owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer')
  AND NOT public.has_role(auth.uid(), 'coordinator')
);
CREATE POLICY "update organizations" ON public.organizations FOR UPDATE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "delete organizations" ON public.organizations FOR DELETE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "read actors" ON public.actors;
DROP POLICY IF EXISTS "insert actors" ON public.actors;
DROP POLICY IF EXISTS "update actors" ON public.actors;
DROP POLICY IF EXISTS "delete actors" ON public.actors;

CREATE POLICY "read actors" ON public.actors FOR SELECT TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'viewer')
  )
);
CREATE POLICY "insert actors" ON public.actors FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_approved(auth.uid())
  AND owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer')
  AND NOT public.has_role(auth.uid(), 'coordinator')
);
CREATE POLICY "update actors" ON public.actors FOR UPDATE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "delete actors" ON public.actors FOR DELETE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "read profiles" ON public.profiles;
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    public.is_account_approved(auth.uid()) AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coordinator')
    )
  )
);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid()
  AND approval_status = 'pending'
  AND requested_role IN ('agent', 'coordinator')
  AND NOT public.has_role(auth.uid(), 'coordinator')
  AND NOT public.has_role(auth.uid(), 'viewer')
);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  AND public.is_account_approved(auth.uid())
  AND NOT public.has_role(auth.uid(), 'coordinator')
  AND NOT public.has_role(auth.uid(), 'viewer')
)
WITH CHECK (
  id = auth.uid()
  AND approval_status = 'approved'
  AND NOT public.has_role(auth.uid(), 'coordinator')
  AND NOT public.has_role(auth.uid(), 'viewer')
);

CREATE OR REPLACE FUNCTION public.coordination_participants()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles AS p
  WHERE auth.uid() IS NOT NULL
    AND public.is_account_approved(auth.uid())
    AND p.approval_status = 'approved'
    AND p.full_name NOT IN ('Administrador do Sistema', 'Visualizador')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles AS r
      WHERE r.user_id = p.id AND r.role IN ('admin', 'viewer')
    )
  ORDER BY p.full_name, p.id
$$;