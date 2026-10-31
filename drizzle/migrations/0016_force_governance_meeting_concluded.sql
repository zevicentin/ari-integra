-- A governance meeting is a record of a meeting that already happened, so it is always concluded.
-- The rule lives in the database as well as in the forms: an import, a shared edit or any future
-- client writing directly to the table cannot leave one of them open.
UPDATE public.activities
SET status = 'Concluída', updated_at = now()
WHERE kind = 'Reunião de governança'
  AND status <> 'Concluída';

CREATE OR REPLACE FUNCTION public.enforce_governance_meeting_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'Reunião de governança' THEN
    NEW.status := 'Concluída';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_governance_meeting_concluded ON public.activities;
CREATE TRIGGER activities_governance_meeting_concluded
BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.enforce_governance_meeting_status();
