CREATE OR REPLACE FUNCTION public.review_account(_user_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _requested public.app_role;
BEGIN
  IF _decision IS NULL OR _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decisão inválida: %', _decision; END IF;
  SELECT requested_role INTO _requested FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _decision = 'approved' AND (_requested IS NULL OR _requested NOT IN ('agent', 'coordinator')) THEN RAISE EXCEPTION 'Tipo de usuário inválido.'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  IF _decision = 'approved' THEN INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _requested); END IF;
  UPDATE public.profiles SET approval_status = _decision WHERE id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.review_account(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.review_account(uuid, text) TO service_role;

DROP POLICY IF EXISTS "update activities" ON public.activities;
CREATE POLICY "update activities" ON public.activities FOR UPDATE TO authenticated
USING (public.is_account_approved(auth.uid()) AND (((owner_id = auth.uid() OR participant_agents @> ARRAY[auth.uid()]) AND NOT public.has_role(auth.uid(), 'coordinator')) OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (public.is_account_approved(auth.uid()) AND (((owner_id = auth.uid() OR participant_agents @> ARRAY[auth.uid()]) AND NOT public.has_role(auth.uid(), 'coordinator')) OR public.has_role(auth.uid(), 'admin')));

CREATE TABLE public.indicator_values (
  owner_id uuid NOT NULL,
  code text NOT NULL,
  previous text NOT NULL DEFAULT '',
  current text NOT NULL DEFAULT '',
  accumulated text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, code),
  CONSTRAINT indicator_values_code_known CHECK (code IN ('OBR 01','OBR 02','OBR 03','OBR 04','ADES-01','ADES-02','ADES-03','ADES-04','ADES-05','ADES-06','ADES-07','ADES-08'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicator_values TO authenticated;
GRANT ALL ON public.indicator_values TO service_role;
ALTER TABLE public.indicator_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read indicator values" ON public.indicator_values FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "insert indicator values" ON public.indicator_values FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "update indicator values" ON public.indicator_values FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "delete indicator values" ON public.indicator_values FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "read shared evidence" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ari-evidence' AND public.is_account_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.activities AS a WHERE a.evidence ? name));

CREATE OR REPLACE FUNCTION public.enforce_governance_meeting_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'Reunião de governança' THEN NEW.status := 'Concluída'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS activities_governance_meeting_concluded ON public.activities;
CREATE TRIGGER activities_governance_meeting_concluded BEFORE INSERT OR UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.enforce_governance_meeting_status();
UPDATE public.activities SET status = 'Concluída', updated_at = now() WHERE kind = 'Reunião de governança' AND status <> 'Concluída';

CREATE OR REPLACE FUNCTION public.strategy_actions_owner_is_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'O responsável pela ação do plano não pode ser alterado.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS strategy_actions_owner_is_immutable ON public.strategy_actions;
CREATE TRIGGER strategy_actions_owner_is_immutable BEFORE UPDATE ON public.strategy_actions
FOR EACH ROW EXECUTE FUNCTION public.strategy_actions_owner_is_immutable();
GRANT UPDATE (owner_id) ON public.strategy_actions TO authenticated;