DROP POLICY IF EXISTS "insert activities" ON public.activities;
CREATE POLICY "insert activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
);

DROP POLICY IF EXISTS "update activities" ON public.activities;
CREATE POLICY "update activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "delete activities" ON public.activities;
CREATE POLICY "delete activities"
ON public.activities
FOR DELETE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "insert organizations" ON public.organizations;
CREATE POLICY "insert organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
);

DROP POLICY IF EXISTS "update organizations" ON public.organizations;
CREATE POLICY "update organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "delete organizations" ON public.organizations;
CREATE POLICY "delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "insert actors" ON public.actors;
CREATE POLICY "insert actors"
ON public.actors
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
);

DROP POLICY IF EXISTS "update actors" ON public.actors;
CREATE POLICY "update actors"
ON public.actors
FOR UPDATE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "delete actors" ON public.actors;
CREATE POLICY "delete actors"
ON public.actors
FOR DELETE
TO authenticated
USING (
  (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
CREATE POLICY "insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
)
WITH CHECK (
  id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'coordinator'::public.app_role)
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);