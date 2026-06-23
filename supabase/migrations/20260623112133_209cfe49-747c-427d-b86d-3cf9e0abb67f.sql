ALTER TABLE public.storage_topups REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.storage_topups;