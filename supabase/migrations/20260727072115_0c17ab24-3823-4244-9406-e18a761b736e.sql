
DO $$
DECLARE
  r record;
  keep_auth text[] := ARRAY[
    -- admin_* actually called by client
    'admin_adjust_storage','admin_billing_order_detail','admin_billing_orders_list',
    'admin_close_deal_memo','admin_commercial_request_set_note','admin_create_manual_invoice',
    'admin_create_screening_invite','admin_deal_close','admin_deal_link_invoice',
    'admin_deal_record_payment','admin_deal_set_approval','admin_deal_set_internal_notes',
    'admin_deal_upsert_delivery','admin_deal_upsert_payout','admin_extend_screening_invite',
    'admin_failure_counts','admin_grant_invoice_entitlement','admin_handle_title_edit_request',
    'admin_issue_manual_invoice','admin_list_commercial_requests','admin_list_creator_storage_risk',
    'admin_list_deal_memos','admin_list_title_commercial_profiles','admin_mark_invoice_paid',
    'admin_mark_order_paid','admin_pending_manual_reviews','admin_provision_creator_plan',
    'admin_provision_studio_plan','admin_review_manual_payment','admin_review_onboarding_request',
    'admin_review_queue','admin_revoke_screening_invite','admin_set_title_status',
    'admin_studio_vault_purchases','admin_tcp_set_internal_notes','admin_title_history',
    'admin_update_manual_invoice','admin_void_manual_invoice',
    -- founder_* and mcp_* client-called
    'founder_vault_log',
    'mcp_authorize_and_log','mcp_delete_draft_titles','mcp_find_duplicate_draft_titles',
    'mcp_get_public_schema','mcp_get_security_advisors','mcp_import_legacy_titles'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proname LIKE 'admin\_%' OR p.proname LIKE 'mcp\_%' OR p.proname LIKE 'founder\_%')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.args
    );
    IF r.proname = ANY(keep_auth) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        r.proname, r.args
      );
    END IF;
    -- service_role always retains EXECUTE via default ownership; nothing to do
  END LOOP;
END $$;
