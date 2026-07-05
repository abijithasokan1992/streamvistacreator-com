ALTER TABLE public.ingest_job_items
  ADD COLUMN IF NOT EXISTS client_checksum text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS proxy_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS thumbnail_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ingest_job_items_dedupe_idx
  ON public.ingest_job_items (dedupe_key)
  WHERE dedupe_key IS NOT NULL;