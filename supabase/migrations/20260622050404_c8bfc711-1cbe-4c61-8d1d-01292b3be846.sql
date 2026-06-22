
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS support_requests_request_type_status_idx
  ON public.support_requests (request_type, status);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS support_request_id uuid
    REFERENCES public.support_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_support_request_id_idx
  ON public.invoices (support_request_id);
