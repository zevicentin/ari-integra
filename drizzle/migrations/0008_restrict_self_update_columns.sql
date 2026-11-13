REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, governance, region) ON public.profiles TO authenticated;
REVOKE UPDATE ON public.organizations FROM authenticated;
GRANT UPDATE (kind, name, document, sector, size, maturity, region, stage, contact, email, phone, address, demand, referral, notes) ON public.organizations TO authenticated;
REVOKE UPDATE ON public.actors FROM authenticated;
GRANT UPDATE (institution_type, document, institution_name, phone, address, actor_name, position, birth_date, email) ON public.actors TO authenticated;