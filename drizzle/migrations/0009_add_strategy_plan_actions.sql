-- Strategy-plan actions on a table of their own.
--
-- Until now the plan only existed as activities of kind 'Atividade do plano de estratégias',
-- which mixed the plan with the agent's day-to-day registry: it could not be listed, filtered
-- by axis or reported on separately, and an ordinary activity and a plan action were
-- indistinguishable once saved. This table gives the plan its own home while keeping the
-- owner-scoped, approval-gated and coordinator-read-only model used by every other table.
--
-- One axis carries several actions, so a row is one action and not one axis: `axis` repeats.
-- An action keeps both lists the editor offers: `expected_results` holds several results, each
-- only a description, and `activities` holds several activities, each with a status and a period.
-- The action's own `status` is what the plan progress reports on. The legacy activity rows keep
-- their nested `outcomes` JSON untouched, so both shapes are edited by the code that suits them.
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
  -- Several expected results, each of them a description and nothing else.
  expected_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Several activities, each of them a description with a status and a period.
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- The axis is a closed catalog, so a stale or hand-made client cannot persist a value the
  -- editor never offers and the axis filter on the page cannot miss a row.
  CONSTRAINT strategy_actions_axis_known
  CHECK (axis IN (
    'Governança do Ecossistema',
    'Programas e Ações de Inovação',
    'Comunidade Empreendedora',
    'Ambiente de Inovação',
    'Relação Academia/Empresa',
    'Políticas Públicas',
    'Comunicação',
    'Captação de Recursos',
    'Sensibilização de Atores',
    'Setorial'
  )),

  -- The same closed catalog as the axis, so a row cannot report a status the page never shows.
  CONSTRAINT strategy_actions_status_known
  CHECK (status IN ('Não iniciada', 'Iniciada', 'Concluída')),

-- Every other jsonb column in this database relies on its NOT NULL default, but a JSON
  -- array is still the only shape the editor reads, so a hand-made write cannot make either
  -- list unreadable.
  CONSTRAINT strategy_actions_expected_results_array
    CHECK (jsonb_typeof(expected_results) = 'array'),
  CONSTRAINT strategy_actions_activities_array
    CHECK (jsonb_typeof(activities) = 'array')
);

-- Every entry of either list is an object carrying a description: a result has nothing else and
-- an activity adds its status and period. The page never reads an entry without that key, so a
-- hand-made write cannot leave an entry the editor would drop on save.
CREATE OR REPLACE FUNCTION public.strategy_actions_lists_are_well_formed() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- The CHECK constraints below reject a list that is not an array, but a BEFORE trigger runs
  -- first and reads these two columns as arrays, so it refuses one itself with a message that
  -- says what is wrong instead of failing inside jsonb_array_elements.
  IF jsonb_typeof(NEW.expected_results) <> 'array' OR jsonb_typeof(NEW.activities) <> 'array' THEN
    RAISE EXCEPTION 'Os resultados esperados e as atividades do plano devem ser listas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.expected_results) entry
    WHERE jsonb_typeof(entry) <> 'object' OR NOT (entry ? 'description')
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.activities) entry
    WHERE jsonb_typeof(entry) <> 'object' OR NOT (entry ? 'description')
  ) THEN
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
USING (
  public.is_account_approved(auth.uid()) AND (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'viewer')
  )
);
CREATE POLICY "insert strategy actions" ON public.strategy_actions FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_approved(auth.uid())
  AND owner_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'viewer')
  AND NOT public.has_role(auth.uid(), 'coordinator')
);
CREATE POLICY "update strategy actions" ON public.strategy_actions FOR UPDATE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "delete strategy actions" ON public.strategy_actions FOR DELETE TO authenticated
USING (
  public.is_account_approved(auth.uid()) AND (
    (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'coordinator'))
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE INDEX strategy_actions_owner_idx ON public.strategy_actions(owner_id);

-- RLS decides which rows an account may touch; column grants decide which columns it may
-- change. Without this an approved agent could hand-craft a PATCH that moves a plan action
-- to another owner, so owner_id and created_at stay administrator-only (same reasoning as
-- 0008_restrict_self_update_columns).
REVOKE UPDATE ON public.strategy_actions FROM authenticated;
GRANT UPDATE (axis, status, description, problem, problem_description, solution, solution_description, expected_results, activities, updated_at)
  ON public.strategy_actions TO authenticated;