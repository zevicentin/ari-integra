-- Older clients sent owner_id back on every strategy-plan update. The column grant did not
-- include owner_id, so Postgres refused the whole save with "permission denied for table
-- strategy_actions" even when the value was unchanged. Keep the column writable only in
-- appearance: the trigger below refuses any real change, so an agent still cannot move an
-- action to another owner and created_at stays untouched.
CREATE OR REPLACE FUNCTION public.strategy_actions_owner_is_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'O responsável pela ação do plano não pode ser alterado.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strategy_actions_owner_is_immutable ON public.strategy_actions;
CREATE TRIGGER strategy_actions_owner_is_immutable
BEFORE UPDATE ON public.strategy_actions
FOR EACH ROW EXECUTE FUNCTION public.strategy_actions_owner_is_immutable();

GRANT UPDATE (owner_id) ON public.strategy_actions TO authenticated;
