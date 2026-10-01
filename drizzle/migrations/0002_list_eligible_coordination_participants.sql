CREATE OR REPLACE FUNCTION public.coordination_participants()
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles AS p
  WHERE auth.uid() IS NOT NULL
    AND p.full_name NOT IN ('Administrador do Sistema', 'Visualizador')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles AS r
      WHERE r.user_id = p.id AND r.role IN ('admin', 'viewer')
    )
  ORDER BY p.full_name, p.id
$$;
REVOKE ALL ON FUNCTION public.coordination_participants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coordination_participants() FROM anon;
GRANT EXECUTE ON FUNCTION public.coordination_participants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordination_participants() TO service_role;