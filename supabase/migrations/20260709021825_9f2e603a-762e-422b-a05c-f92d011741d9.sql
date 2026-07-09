
-- ============ 1) Enums ============
DO $$ BEGIN
  CREATE TYPE public.title_kind AS ENUM ('film','series','season','episode','collection_entry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.media_version_type AS ENUM
    ('master','broadcast','ott','hdr','sdr','proxy','trailer','screener','clip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.localization_kind AS ENUM
    ('audio_track','subtitle','closed_caption','dub','localized_metadata');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM ('draft','scheduled','available','expired','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribution_readiness AS ENUM ('not_ready','in_prep','ready','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.publish_approval_status AS ENUM ('pending','approved','rejected','changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM ('not_started','queued','in_progress','delivered','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2) content_titles extensions ============
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS kind public.title_kind NOT NULL DEFAULT 'film',
  ADD COLUMN IF NOT EXISTS parent_title_id uuid REFERENCES public.content_titles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS season_number integer,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS content_titles_parent_idx
  ON public.content_titles(parent_title_id) WHERE parent_title_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_titles_kind_idx ON public.content_titles(kind);

-- ============ 3) Franchises ============
CREATE TABLE IF NOT EXISTS public.title_franchises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  workspace_id uuid,
  name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_franchises TO authenticated;
GRANT ALL ON public.title_franchises TO service_role;
ALTER TABLE public.title_franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tf_owner_all" ON public.title_franchises
  FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "tf_admin_read" ON public.title_franchises
  FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "tf_admin_write" ON public.title_franchises
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES public.title_franchises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS content_titles_franchise_idx
  ON public.content_titles(franchise_id) WHERE franchise_id IS NOT NULL;

-- ============ 4) Collections ============
CREATE TABLE IF NOT EXISTS public.title_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  workspace_id uuid,
  name text NOT NULL,
  description text,
  cover_asset_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_collections TO authenticated;
GRANT ALL ON public.title_collections TO service_role;
ALTER TABLE public.title_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tc_owner_all" ON public.title_collections
  FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "tc_admin_all" ON public.title_collections
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.title_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.title_collections(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_collection_items TO authenticated;
GRANT ALL ON public.title_collection_items TO service_role;
ALTER TABLE public.title_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tci_owner_all" ON public.title_collection_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.title_collections c
            WHERE c.id = collection_id AND c.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.title_collections c
            WHERE c.id = collection_id AND c.owner_user_id = auth.uid())
  );
CREATE POLICY "tci_admin_all" ON public.title_collection_items
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS tci_collection_idx ON public.title_collection_items(collection_id, sort_order);
CREATE INDEX IF NOT EXISTS tci_title_idx ON public.title_collection_items(title_id);

-- ============ 5) Media Versions ============
CREATE TABLE IF NOT EXISTS public.title_media_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  version_type public.media_version_type NOT NULL,
  label text,
  source_asset_id uuid,
  -- Technical metadata (structured fields for indexing / filtering)
  codec text,
  container text,
  frame_rate numeric(6,3),
  aspect_ratio text,
  bitrate_kbps integer,
  audio_layout text,           -- e.g. "5.1", "stereo", "atmos"
  loudness_lufs numeric(6,2),
  -- Extended payloads (flexible jsonb for HDR / IMF / vendor-specific)
  hdr_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,   -- transfer, primaries, MaxCLL, MaxFALL, mastering display
  imf_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,   -- CPL, PKL, ASSETMAP references
  tech_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- anything else
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_media_versions TO authenticated;
GRANT ALL ON public.title_media_versions TO service_role;
ALTER TABLE public.title_media_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmv_owner_all" ON public.title_media_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  );
CREATE POLICY "tmv_admin_all" ON public.title_media_versions
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS tmv_title_idx ON public.title_media_versions(title_id);
CREATE INDEX IF NOT EXISTS tmv_type_idx ON public.title_media_versions(title_id, version_type);

-- ============ 6) Localizations ============
CREATE TABLE IF NOT EXISTS public.title_localizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  kind public.localization_kind NOT NULL,
  language text NOT NULL,          -- BCP-47 code, e.g. "en", "hi-IN"
  region text,                     -- optional territory / market
  label text,
  asset_id uuid,                   -- optional link to recent_uploads / title_assets
  is_default boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,   -- title / synopsis / keywords / caption format / SDH flag / etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_localizations TO authenticated;
GRANT ALL ON public.title_localizations TO service_role;
ALTER TABLE public.title_localizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tl_owner_all" ON public.title_localizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  );
CREATE POLICY "tl_admin_all" ON public.title_localizations
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS tl_title_idx ON public.title_localizations(title_id);
CREATE INDEX IF NOT EXISTS tl_kind_idx ON public.title_localizations(title_id, kind);

-- ============ 7) Publishing ============
CREATE TABLE IF NOT EXISTS public.title_publishing (
  title_id uuid PRIMARY KEY REFERENCES public.content_titles(id) ON DELETE CASCADE,
  availability public.availability_status NOT NULL DEFAULT 'draft',
  distribution public.distribution_readiness NOT NULL DEFAULT 'not_ready',
  approval public.publish_approval_status NOT NULL DEFAULT 'pending',
  delivery public.delivery_status NOT NULL DEFAULT 'not_started',
  available_from timestamptz,
  available_until timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_publishing TO authenticated;
GRANT ALL ON public.title_publishing TO service_role;
ALTER TABLE public.title_publishing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tp_owner_all" ON public.title_publishing
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_titles t
            WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  );
CREATE POLICY "tp_admin_all" ON public.title_publishing
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============ 8) updated_at triggers ============
CREATE OR REPLACE FUNCTION public._mediacms_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tf_touch BEFORE UPDATE ON public.title_franchises
    FOR EACH ROW EXECUTE FUNCTION public._mediacms_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tc_touch BEFORE UPDATE ON public.title_collections
    FOR EACH ROW EXECUTE FUNCTION public._mediacms_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tmv_touch BEFORE UPDATE ON public.title_media_versions
    FOR EACH ROW EXECUTE FUNCTION public._mediacms_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tl_touch BEFORE UPDATE ON public.title_localizations
    FOR EACH ROW EXECUTE FUNCTION public._mediacms_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tp_touch BEFORE UPDATE ON public.title_publishing
    FOR EACH ROW EXECUTE FUNCTION public._mediacms_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
