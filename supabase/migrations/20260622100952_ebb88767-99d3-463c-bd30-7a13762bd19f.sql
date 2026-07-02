-- Revoke anon EXECUTE on admin-only RPCs (defence in depth; internal checks remain)
DO $$
DECLARE
  fn text;
  admin_fns text[] := ARRAY[
    'admin_billing_order_detail(uuid)',
    'admin_billing_orders_list(text,text,text,integer)',
    'admin_grant_storage(uuid,integer,text)',
    'admin_mark_order_paid(uuid,text)',
    'admin_pending_manual_reviews(integer)',
    'admin_review_manual_payment(uuid,text,text)',
    'admin_review_queue(text)',
    'admin_title_history(uuid)',
    'admin_exists()',
    'billing_sync_from_storage_topup(uuid)',
    'fulfill_billing_order(uuid)',
    'grant_creator_role(uuid)',
    'revoke_creator_role(uuid)',
    'studio_vault_upsert_product(jsonb)',
    'studio_vault_create_topup(uuid,integer,integer)',
    'sweep_abandoned_topups(integer)',
    'validate_razorpay_config()',
    'submit_manual_payment_proof(uuid,text,bigint,timestamptz,text,text,text,text,text,text,text)',
    'submit_title_to_admin(uuid,text)',
    'transition_title_status(uuid,text,text)',
    'complete_title_asset_upload(uuid,uuid,text,boolean)',
    'create_manual_vault_order(uuid,integer,text,text)',
    'request_creator_link(text)',
    'payment_trace_upsert(text,jsonb)',
    'record_payment_trace_event(text,text,jsonb)',
    'project_topup_entitlement(uuid)',
    'get_payment_method_configs_for_my_order(uuid)',
    'list_shares_for_me()',
    'creator_free_tier_status(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', fn, SQLERRM;
    END;
  END LOOP;
END $$;

-- Revoke anon/public EXECUTE on internal trigger functions (they run as table owner via triggers)
DO $$
DECLARE
  fn text;
  trig_fns text[] := ARRAY[
    'audit_site_config_oracle_changes()',
    'intro_invites_block_immutable_updates()',
    'log_onboarding_delete()',
    'log_onboarding_full_update()',
    'notify_on_content_approval()',
    'onboarding_requests_scrub_anon_fields()',
    'recent_uploads_immutable_guard()',
    'redeem_premium_invitation_on_signup()',
    'route_studio_asset()',
    'title_assets_lock_guard()',
    'content_titles_lock_guard()',
    'trg_billing_orders_autofulfill()',
    'trg_billing_sync_storage_topup()',
    'workspaces_add_owner_member()',
    'assign_default_role()',
    'accept_intro_invite_on_signup()'
  ];
BEGIN
  FOREACH fn IN ARRAY trig_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', fn, SQLERRM;
    END;
  END LOOP;
END $$;