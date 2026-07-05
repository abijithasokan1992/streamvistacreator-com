
-- 1) acquisition_requests: split update policy, add column-level WITH CHECK

DROP POLICY IF EXISTS acq_party_update ON public.acquisition_requests;

CREATE POLICY acq_buyer_update ON public.acquisition_requests
FOR UPDATE TO authenticated
USING (buyer_user_id = auth.uid() AND status = 'pending'::acquisition_status)
WITH CHECK (
  buyer_user_id = auth.uid()
  -- Buyer may only leave the row pending or explicitly withdraw it.
  AND status IN ('pending'::acquisition_status, 'withdrawn'::acquisition_status)
  -- Buyer cannot write owner-decision fields.
  AND responded_by IS NULL
  AND responded_at IS NULL
  AND counter_amount IS NULL
  AND counter_terms IS NULL
);

CREATE POLICY acq_owner_update ON public.acquisition_requests
FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (
  owner_user_id = auth.uid()
  -- Owner may only decide (or counter). They cannot reset to pending or withdraw a buyer request.
  AND status IN ('accepted'::acquisition_status, 'declined'::acquisition_status, 'countered'::acquisition_status)
  -- responded_by, when set, must be the owner.
  AND (responded_by IS NULL OR responded_by = auth.uid())
);

CREATE POLICY acq_admin_update ON public.acquisition_requests
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));


-- 2) commercial_requests: restrict owner update to legitimate transitions only

DROP POLICY IF EXISTS "Owner updates only awaiting_creator_review" ON public.commercial_requests;

CREATE POLICY "Owner updates awaiting_creator_review to decision"
ON public.commercial_requests
FOR UPDATE TO authenticated
USING (
  owner_user_id = auth.uid()
  AND state = 'awaiting_creator_review'::commercial_request_state
)
WITH CHECK (
  owner_user_id = auth.uid()
  -- Owner may only accept-for-negotiation or reject. All other transitions are admin-only.
  AND state IN (
    'approved_for_negotiation'::commercial_request_state,
    'rejected'::commercial_request_state
  )
);


-- 3) billing_orders: drop user INSERT; edge functions use service_role and bypass RLS

DROP POLICY IF EXISTS billing_orders_owner_insert ON public.billing_orders;


-- 4) agent_events: drop user INSERT; edge functions use service_role and bypass RLS

DROP POLICY IF EXISTS "Users insert their own agent events" ON public.agent_events;


-- 5) screening_events: let title owners read events on their own screening invites

CREATE POLICY screening_events_title_owner_read ON public.screening_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.screening_invites si
    JOIN public.content_titles ct ON ct.id = si.title_id
    WHERE si.id = screening_events.invite_id
      AND ct.owner_user_id = auth.uid()
  )
);


-- 6) Storage: bind anonymous DMCA / MFI uploads to an existing request row

DROP POLICY IF EXISTS "Public can upload DMCA evidence (scoped)" ON storage.objects;

CREATE POLICY "Public can upload DMCA evidence (bound to request)"
ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'dmca-evidence'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._\-]{1,200}\.(pdf|png|jpe?g|webp|gif|mp4|mov|txt|docx?|PDF|PNG|JPE?G|WEBP|GIF|MP4|MOV|TXT|DOCX?)$'
  AND EXISTS (
    SELECT 1 FROM public.dmca_requests r
    WHERE r.id::text = split_part(storage.objects.name, '/', 1)
  )
);

DROP POLICY IF EXISTS "Public can upload MFI proof (scoped)" ON storage.objects;

CREATE POLICY "Public can upload MFI proof (bound to request)"
ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'mfi-proof'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/proof\.(pdf|png|jpe?g|webp|PDF|PNG|JPE?G|WEBP)$'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_requests r
    WHERE r.id::text = split_part(storage.objects.name, '/', 1)
  )
);
