
-- pgcrypto for password hashing
create extension if not exists pgcrypto with schema public;

-- Helper: is the caller a super admin (platform owner)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  )
$$;

-- Founder vault config (single row by convention, key='primary')
create table if not exists public.founder_vault_config (
  key text primary key default 'primary',
  password_hash text,
  set_by uuid,
  set_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.founder_vault_config to authenticated;
grant all on public.founder_vault_config to service_role;
alter table public.founder_vault_config enable row level security;
create policy "Super admin reads vault config"
  on public.founder_vault_config for select to authenticated
  using (public.is_super_admin());
create policy "Super admin writes vault config"
  on public.founder_vault_config for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit table
create table if not exists public.founder_vault_audit (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists founder_vault_audit_created_idx on public.founder_vault_audit (created_at desc);
grant select, insert on public.founder_vault_audit to authenticated;
grant all on public.founder_vault_audit to service_role;
alter table public.founder_vault_audit enable row level security;
create policy "Super admin reads vault audit"
  on public.founder_vault_audit for select to authenticated
  using (public.is_super_admin());
create policy "Super admin inserts vault audit"
  on public.founder_vault_audit for insert to authenticated
  with check (public.is_super_admin() and (actor is null or actor = auth.uid()));

-- Set / rotate password (super admin only). Minimum 10 chars.
create or replace function public.founder_vault_set_password(new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  if new_password is null or length(new_password) < 10 then
    raise exception 'password too short';
  end if;
  insert into public.founder_vault_config(key, password_hash, set_by, set_at, updated_at)
    values ('primary', crypt(new_password, gen_salt('bf', 12)), uid, now(), now())
  on conflict (key) do update
    set password_hash = excluded.password_hash,
        set_by = excluded.set_by,
        set_at = excluded.set_at,
        updated_at = now();
  insert into public.founder_vault_audit(actor, action, details)
    values (uid, 'password_set', '{}'::jsonb);
end;
$$;
revoke all on function public.founder_vault_set_password(text) from public;
grant execute on function public.founder_vault_set_password(text) to authenticated;

-- Verify password (super admin only). Logs success/failure.
create or replace function public.founder_vault_verify_password(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
  ok boolean := false;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  select password_hash into stored from public.founder_vault_config where key = 'primary';
  if stored is null then
    insert into public.founder_vault_audit(actor, action, details)
      values (uid, 'unlock_attempt', jsonb_build_object('result','no_password_set'));
    return false;
  end if;
  ok := (stored = crypt(candidate, stored));
  insert into public.founder_vault_audit(actor, action, details)
    values (uid, case when ok then 'unlock_success' else 'unlock_failure' end, '{}'::jsonb);
  return ok;
end;
$$;
revoke all on function public.founder_vault_verify_password(text) from public;
grant execute on function public.founder_vault_verify_password(text) to authenticated;

-- Log helper (super admin only)
create or replace function public.founder_vault_log(action text, details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  insert into public.founder_vault_audit(actor, action, details)
    values (uid, action, coalesce(details, '{}'::jsonb));
end;
$$;
revoke all on function public.founder_vault_log(text, jsonb) from public;
grant execute on function public.founder_vault_log(text, jsonb) to authenticated;

-- Storage policies: only super admin can touch the founder-vault bucket.
drop policy if exists "founder_vault_super_admin_select" on storage.objects;
drop policy if exists "founder_vault_super_admin_insert" on storage.objects;
drop policy if exists "founder_vault_super_admin_update" on storage.objects;
drop policy if exists "founder_vault_super_admin_delete" on storage.objects;

create policy "founder_vault_super_admin_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'founder-vault' and public.is_super_admin());
create policy "founder_vault_super_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'founder-vault' and public.is_super_admin());
create policy "founder_vault_super_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'founder-vault' and public.is_super_admin())
  with check (bucket_id = 'founder-vault' and public.is_super_admin());
create policy "founder_vault_super_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'founder-vault' and public.is_super_admin());
