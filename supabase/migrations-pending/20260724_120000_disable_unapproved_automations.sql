-- StreamVista manual-operations cleanup
-- SOURCE ONLY / PENDING: do not execute without explicit production approval.
-- Purpose: keep only the eight approved core automations and disable other
-- automatic commercial, lifecycle, research and cleanup jobs.

begin;

-- Stop known cron jobs outside the approved core automation set.
do $$
declare
  v_job text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    foreach v_job in array array[
      'streamvista-track-usage',
      'streamvista-charge-overages',
      'streamvista-reclaim-idle',
      'sv-archive-sweep-daily',
      'sv-egress-sweep-monthly',
      'topup-sweep',
      'sv-topup-sweep',
      'oci-multipart-reclaim',
      'sv-oci-multipart-reclaim',
      'intelligence-snapshots-daily',
      'sv-intelligence-snapshots-daily',
      'title-removal-worker',
      'sv-title-removal-worker'
    ] loop
      perform cron.unschedule(v_job)
        where exists (select 1 from cron.job where jobname = v_job);
    end loop;
  end if;
end $$;

-- Fail closed for automatic charging when the legacy switch exists.
do $$
begin
  if to_regclass('public.billing_config') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'billing_config'
         and column_name = 'auto_charge_enabled'
     ) then
    execute 'update public.billing_config set auto_charge_enabled = false where auto_charge_enabled is distinct from false';
  end if;
end $$;

commit;

-- Approved core automation set retained in source:
-- 1. Failed email retry
-- 2. Failed upload recovery
-- 3. Payment webhook protection
-- 4. Title autosave and resume
-- 5. Legal/QC status tracking
-- 6. Role and access security
-- 7. Audit logging
-- 8. Important notifications
--
-- Rollback guidance: recreate only an individually approved cron job after
-- security review, tests, observability and a documented manual kill switch.
