ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS indicators text[] NOT NULL DEFAULT '{}';

-- Only the 12 official indicators may be stored, so a stale or hand-made client cannot
-- persist a code that does not exist in the program's catalog.
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_indicators_known;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_indicators_known
  CHECK (indicators <@ ARRAY[
    'OBR 01',
    'OBR 02',
    'OBR 03',
    'OBR 04',
    'ADES-01',
    'ADES-02',
    'ADES-03',
    'ADES-04',
    'ADES-05',
    'ADES-06',
    'ADES-07',
    'ADES-08'
  ]::text[]);

-- Duplicates are deliberately not constrained here: Postgres rejects subqueries inside
-- CHECK, so "no repeated code" cannot be expressed on the array. The editor sends each
-- code once (a checkbox toggle), and duplicates would not break the reports.