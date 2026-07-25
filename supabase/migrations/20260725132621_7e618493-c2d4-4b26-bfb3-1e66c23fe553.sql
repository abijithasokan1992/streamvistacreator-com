
ALTER TABLE public.buyer_offer_audit_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_offer_audit_log;
