-- Helper: revoke PUBLIC, grant to authenticated + service_role
DO $$
DECLARE
  fn record;
  sig text;
  fn_names text[] := ARRAY[
    'admin_adjust_storage','admin_close_deal_memo','admin_create_manual_invoice',
    'admin_create_screening_invite','admin_deal_close','admin_deal_link_invoice',
    'admin_deal_record_payment','admin_deal_set_approval','admin_deal_upsert_delivery',
    'admin_deal_upsert_payout','admin_extend_screening_invite','admin_handle_title_edit_request',
    'admin_issue_manual_invoice','admin_mark_invoice_paid','admin_provision_creator_plan',
    'admin_provision_studio_plan','admin_revoke_screening_invite','admin_update_manual_invoice',
    'admin_void_manual_invoice','assert_storage_quota','can_write_workspace',
    'create_personal_workspace','creator_lock_title_on_submit','creator_request_title_edit',
    'deal_memo_check_conflict','enforce_free_tier_title_quota','enforce_title_lock_on_assets',
    'enforce_title_lock_on_titles','get_workspace_storage_entitlement','has_accepted_agreement',
    'is_free_tier_user','is_super_admin','is_workspace_admin','is_workspace_member',
    'mfi_seats_taken','sweep_manual_invoices_overdue','sweep_screening_invites_expired',
    'tg_create_commercial_profile','tg_log_commercial_request_state',
    'title_submission_readiness','title_write_allowed','user_in_banner'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY(fn_names)
  LOOP
    sig := format('public.%I(%s)', fn.proname, fn.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END $$;