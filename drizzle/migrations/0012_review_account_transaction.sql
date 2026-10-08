-- Approving or refusing an account writes three rows: the account's role row and its approval
-- status. Each statement used to run on its own server round-trip, so a failure in the middle
-- could leave a refused account still holding a role, or an approved account without one. One
-- SQL function is a single transaction: either every write lands or none of them does.
CREATE OR REPLACE FUNCTION public.review_account(_user_id uuid, _decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested public.app_role;
BEGIN
  IF _decision IS NULL OR _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %', _decision;
  END IF;

  SELECT requested_role INTO _requested
  FROM public.profiles
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;

  IF _decision = 'approved' AND (_requested IS NULL OR _requested NOT IN ('agent', 'coordinator')) THEN
    RAISE EXCEPTION 'Tipo de usuário inválido.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;

  IF _decision = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _requested);
  END IF;

  UPDATE public.profiles SET approval_status = _decision WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.review_account(uuid, text) TO service_role;
