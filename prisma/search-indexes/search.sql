CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS incident_title_trgm_idx
  ON public.incident USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS incident_description_trgm_idx
  ON public.incident USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS team_name_trgm_idx
  ON public.team USING gin (name gin_trgm_ops);
