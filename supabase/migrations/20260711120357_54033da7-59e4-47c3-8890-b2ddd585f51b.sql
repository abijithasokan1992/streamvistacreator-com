-- Helper to iterate every overload of each named function.
DO $$
DECLARE
  fn text;
  sig text;
  admin_only text[] := ARRAY[
    'admin_create_manual_invoice','admin_update_manual_invoice','admin_grant_invoice_entitlement',
    'admin_failure_counts','admin_infra_snapshot','compute_royalty_run',
    'stage_egress_overage_invoices','retry_failed_distribution_deliveries','enqueue_archive_job',
    'email_queue_dispatch','email_queue_wake','compute_inactive_creator_basic_uploads',
    'pending_legacy_recovery_emails','claim_legacy_films','founder_vault_log',
    'delete_creator_title','sync_upload_to_media_cms'
  ];
  trigger_fns text[] := ARRAY[
    'acquisition_requests_freeze_buyer_cols','acquisition_requests_freeze_buyer_edits',
    'enforce_acq_update','enforce_invite_only_roles','intro_invites_freeze_protected_cols',
    'guard_billing_orders_trusted_fields','log_entity_profile_changes','log_studio_ext_changes',
    'tg_sync_upload_to_media_cms','screening_log_event'
  ];
  auth_only text[] := ARRAY[
    'is_assigned_reviewer','is_assigned_reviewer_any','is_org_member','is_super_admin',
    'has_premium_storage_entitlement','get_workspace_entitlement_snapshot',
    'get_canonical_payg_price','title_delete_eligibility','screening_resolve'
  ];
  public_ok text[] := ARRAY[
    'get_active_branding','list_active_distribution_partners','list_public_recent_productions',
    'handle_global_platform_maintenance','get_onboarding_request_by_token','verify_premium_invitation'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_only LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    END LOOP;
  END LOOP;

  FOREACH fn IN ARRAY trigger_fns LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', sig);
    END LOOP;
  END LOOP;

  FOREACH fn IN ARRAY auth_only LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    END LOOP;
  END LOOP;

  FOREACH fn IN ARRAY public_ok LOOP
    FOR sig IN
      SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', sig);
    END LOOP;
  END LOOP;
END$$;

/* ROLLBACK: re-grant anon, authenticated on the locked-down functions.
DO $$
DECLARE fn text; sig text;
  all_locked text[] := ARRAY[
    'admin_create_manual_invoice','admin_update_manual_invoice','admin_grant_invoice_entitlement',
    'admin_failure_counts','admin_infra_snapshot','compute_royalty_run','stage_egress_overage_invoices',
    'retry_failed_distribution_deliveries','enqueue_archive_job','email_queue_dispatch','email_queue_wake',
    'compute_inactive_creator_basic_uploads','pending_legacy_recovery_emails','claim_legacy_films',
    'founder_vault_log','delete_creator_title','sync_upload_to_media_cms',
    'acquisition_requests_freeze_buyer_cols','acquisition_requests_freeze_buyer_edits','enforce_acq_update',
    'enforce_invite_only_roles','intro_invites_freeze_protected_cols','guard_billing_orders_trusted_fields',
    'log_entity_profile_changes','log_studio_ext_changes','tg_sync_upload_to_media_cms','screening_log_event',
    'is_assigned_reviewer','is_assigned_reviewer_any','is_org_member','is_super_admin',
    'has_premium_storage_entitlement','get_workspace_entitlement_snapshot','get_canonical_payg_price',
    'title_delete_eligibility','screening_resolve'
  ];
BEGIN
  FOREACH fn IN ARRAY all_locked LOOP
    FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=fn LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', sig);
    END LOOP;
  END LOOP;
END$$;
*/