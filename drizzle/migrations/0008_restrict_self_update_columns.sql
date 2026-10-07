-- Privilege escalation fix.
--
-- The "update own profile" policy constrains approval_status through its WITH CHECK,
-- but RLS cannot restrict *which columns* a row may change. An approved agent could
-- therefore send a hand-made PATCH setting its own requested_role to 'coordinator'
-- (or 'admin'), simply because the UI never renders that field.
--
-- Column-level privileges are the right tool: they hold no matter how the request is
-- built, and they keep RLS responsible for *which rows* may be touched.
REVOKE UPDATE ON public.profiles FROM authenticated;

-- The only self-service columns. requested_role and approval_status stay
-- administrator-only, which is why the approval flow uses service_role.
GRANT UPDATE (full_name, phone, governance, region)
  ON public.profiles TO authenticated;

-- Close the same hole on organizations and actors: an owner must not be able to
-- reassign a record to somebody else, nor to nobody.
REVOKE UPDATE ON public.organizations FROM authenticated;
GRANT UPDATE (kind, name, document, sector, size, maturity, region, stage, contact, email, phone, address, demand, referral, notes)
  ON public.organizations TO authenticated;

REVOKE UPDATE ON public.actors FROM authenticated;
GRANT UPDATE (institution_type, document, institution_name, phone, address, actor_name, position, birth_date, email)
  ON public.actors TO authenticated;