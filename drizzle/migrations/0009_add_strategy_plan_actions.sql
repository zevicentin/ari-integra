CREATE TABLE public.strategy_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  axis text NOT NULL,
  status text NOT NULL DEFAULT 'Não iniciada',
  description text NOT NULL DEFAULT '',
  problem text NOT NULL DEFAULT '',
  problem_description text NOT NULL DEFAULT '',
  solution text NOT NULL DEFAULT '',
  solution_description text NOT NULL DEFAULT '',
  expected_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_actions_axis_known CHECK (axis IN ('Governança do Ecossistema','Programas e Ações de Inovação','Comunidade Empreendedora','Ambiente de Inovação','Relação Academia/Empresa','Políticas Públicas','Comunicação','Captação de Recursos','Sensibilização de Atores','Setorial')),
  CONSTRAINT strategy_actions_status_known CHECK (status IN ('Não iniciada', 'Iniciada', 'Concluída')),
  CONSTRAINT strategy_actions_expected_results_array CHECK (jsonb_typeof(expected_results) = 'array'),
  CONSTRAINT strategy_actions_activities_array CHECK (jsonb_typeof(activities) = 'array')
);

CREATE OR REPLACE FUNCTION public.strategy_actions_lists_are_well_formed() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.expected_results) <> 'array' OR jsonb_typeof(NEW.activities) <> 'array' THEN
    RAISE EXCEPTION 'Os resultados esperados e as atividades do plano devem ser listas.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.expected_results) entry WHERE jsonb_typeof(entry) <> 'object' OR NOT (entry ? 'description'))
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.activities) entry WHERE jsonb_typeof(entry) <> 'object' OR NOT (entry ? 'description')) THEN
    RAISE EXCEPTION 'Cada resultado esperado e cada atividade do plano precisam de um campo description.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER strategy_actions_lists_are_well_formed
  BEFORE INSERT OR UPDATE OF expected_results, activities ON public.strategy_actions
  FOR EACH ROW EXECUTE FUNCTION public.strategy_actions_lists_are_well_formed();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_actions TO authenticated;
GRANT ALL ON public.strategy_actions TO service_role;
ALTER TABLE public.strategy_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read strategy actions" ON public.strategy_actions FOR SELECT TO authenticated
USING (public.is_account_approved(auth.uid()) AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator') OR public.has_role(auth.uid(), 'viewer')));
CREATE POLICY "insert strategy actions" ON public.strategy_actions FOR INSERT TO authenticated
WITH CHECK (public.is_account_approved(auth.uid()) AND owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'viewer') AND NOT public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "update strategy actions" ON public.strategy_actions FOR UPDATE TO authenticated
USING (public.is_account_approved(auth.uid()) AND ((owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator')) OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (public.is_account_approved(auth.uid()) AND ((owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator')) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "delete strategy actions" ON public.strategy_actions FOR DELETE TO authenticated
USING (public.is_account_approved(auth.uid()) AND ((owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator')) OR public.has_role(auth.uid(), 'admin')));

CREATE INDEX strategy_actions_owner_idx ON public.strategy_actions(owner_id);

REVOKE UPDATE ON public.strategy_actions FROM authenticated;
GRANT UPDATE (axis, status, description, problem, problem_description, solution, solution_description, expected_results, activities, updated_at) ON public.strategy_actions TO authenticated;