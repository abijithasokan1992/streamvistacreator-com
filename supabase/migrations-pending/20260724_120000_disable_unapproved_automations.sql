-- StreamVista manual-operations cleanup
-- SOURCE ONLY / PENDING: do not execute without explicit production approval.
-- Purpose: disable automatic commercial/destructive jobs while preserving
-- manual admin tools and historical records.

begin;

-- Stop known cron jobs that perform automatic commercial or lifecycle actions.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('streamvista-charge-overages')
      where exists (select 1 from cron.job where jobname = 'streamvista-charge-overages');

    perform cron.unschedule('streamvista-reclaim-idle')
      where exists (select 1 from cron.job where jobname = 'streamvista-reclaim-idle');

    perform cron.unschedule('title-removal-worker')
      where exists (select 1 from cron.job where jobname = 'title-removal-worker');

    perform cron.unschedule('sv-title-removal-worker')
      where exists (select 1 from cron.job where jobname = 'sv-title-removal-worker');
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

-- Rollback guidance (manual and explicit only):
-- Recreate only the individually approved cron job with reviewed authentication,
-- rate limits, observability and a documented manual kill switch.
