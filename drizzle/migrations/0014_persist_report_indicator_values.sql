-- The values handwritten into the monthly report's SETI indicator table are kept per account, so
-- the next count starts from the accumulated result that was last kept instead of an empty row.
-- OBR 02 and ADES-01 are not activity counts: OBR 02 is the annual ecosystem maturity score whose
-- single value replaces the previous one when updated, and ADES-01 is money raised through editals
-- whose new value sums into the accumulated result. Everything stays text so "1.234,56" or "3,5"
-- reads exactly as typed, and one row per owner and code is all the report needs.
CREATE TABLE public.indicator_values (
  owner_id uuid NOT NULL,
  code text NOT NULL,
  previous text NOT NULL DEFAULT '',
  current text NOT NULL DEFAULT '',
  accumulated text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, code)
);

-- Only the 12 official codes may be stored (same catalog as the activities column).
ALTER TABLE public.indicator_values
  ADD CONSTRAINT indicator_values_code_known
  CHECK (code IN (
    'OBR 01', 'OBR 02', 'OBR 03', 'OBR 04',
    'ADES-01', 'ADES-02', 'ADES-03', 'ADES-04',
    'ADES-05', 'ADES-06', 'ADES-07', 'ADES-08'
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicator_values TO authenticated;
GRANT ALL ON public.indicator_values TO service_role;

ALTER TABLE public.indicator_values ENABLE ROW LEVEL SECURITY;

-- Each account keeps its own report values; the coordinator may read any agent's column to audit
-- a report, but only the owner writes.
CREATE POLICY "read indicator values" ON public.indicator_values FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordinator')
);

CREATE POLICY "insert indicator values" ON public.indicator_values FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND NOT public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "update indicator values" ON public.indicator_values FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "delete indicator values" ON public.indicator_values FOR DELETE TO authenticated
USING (owner_id = auth.uid());