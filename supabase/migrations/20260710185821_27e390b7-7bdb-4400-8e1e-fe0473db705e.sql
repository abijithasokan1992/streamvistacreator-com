
DELETE FROM public.email_send_log e
 WHERE e.status = 'pending'
   AND EXISTS (
     SELECT 1
       FROM public.email_send_log s
      WHERE s.message_id = e.message_id
        AND s.status IN ('sent','dlq','bounced','suppressed','failed','complained')
   );
