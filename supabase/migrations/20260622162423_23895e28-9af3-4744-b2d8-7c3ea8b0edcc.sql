-- Allow buyer requests without a pre-linked title
ALTER TABLE public.commercial_requests ALTER COLUMN title_id DROP NOT NULL;
ALTER TABLE public.commercial_requests ALTER COLUMN owner_user_id DROP NOT NULL;
ALTER TABLE public.commercial_requests ADD COLUMN IF NOT EXISTS title_query text;
ALTER TABLE public.commercial_requests ADD COLUMN IF NOT EXISTS interest_summary text;

ALTER TABLE public.commercial_requests DROP CONSTRAINT IF EXISTS commercial_requests_title_id_fkey;
ALTER TABLE public.commercial_requests
  ADD CONSTRAINT commercial_requests_title_id_fkey
  FOREIGN KEY (title_id) REFERENCES public.content_titles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_requests_state_created_idx
  ON public.commercial_requests (state, created_at DESC);

-- Support_requests: add plan_upgrade type for founder-assisted plan queue
ALTER TABLE public.support_requests DROP CONSTRAINT IF EXISTS support_requests_request_type_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_request_type_check
  CHECK (request_type = ANY (ARRAY['support','service','archival','upgrade','plan_upgrade','other']));

CREATE INDEX IF NOT EXISTS support_requests_type_status_created_idx
  ON public.support_requests (request_type, status, created_at DESC);

COMMENT ON COLUMN public.support_requests.request_type IS
  'Taxonomy: support=help ticket; service=paid operator/service request (qc, mastering, anti_piracy, delivery_prep, ingest); plan_upgrade=founder-assisted Creator Pro / Creator Studio / Studio plan request; upgrade=legacy generic upgrade; archival=archive-related; other.';
COMMENT ON COLUMN public.support_requests.metadata IS
  'Convention: { surface: "creator"|"studio"|"buyer", service_kind?: "qc"|"mastering"|"anti_piracy"|"delivery_prep"|"ingest"|"other", target_plan?: text, urgency?: "normal"|"high", workspace_id?: uuid }';