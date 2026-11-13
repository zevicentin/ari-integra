ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS indicators text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_indicators_known;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_indicators_known
  CHECK (indicators <@ ARRAY['OBR 01','OBR 02','OBR 03','OBR 04','ADES-01','ADES-02','ADES-03','ADES-04','ADES-05','ADES-06','ADES-07','ADES-08']::text[]);