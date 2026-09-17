CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS monitor_name_trgm_idx
  ON public.monitor USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS monitor_url_trgm_idx
  ON public.monitor USING gin (url gin_trgm_ops);
