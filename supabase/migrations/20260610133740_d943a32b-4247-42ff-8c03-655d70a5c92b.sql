
-- Extend projects with optional production metadata
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS crew jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS script_url text,
  ADD COLUMN IF NOT EXISTS script_object_key text,
  ADD COLUMN IF NOT EXISTS camera_brand text,
  ADD COLUMN IF NOT EXISTS lens_brand text,
  ADD COLUMN IF NOT EXISTS capture_format text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS schedule_charting text,
  ADD COLUMN IF NOT EXISTS schedule_artists text,
  ADD COLUMN IF NOT EXISTS schedule_equipment text,
  ADD COLUMN IF NOT EXISTS foldering_mode_archive text NOT NULL DEFAULT 'automated',
  ADD COLUMN IF NOT EXISTS foldering_mode_raw text NOT NULL DEFAULT 'automated';

-- Tag uploads with optional project + category for DIT folder organization
ALTER TABLE public.recent_uploads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS recent_uploads_project_id_idx ON public.recent_uploads(project_id);
