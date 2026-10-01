REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_account_approved(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.coordination_participants() FROM anon;