-- StreamVista Live Business Control
-- Persistent owner-visible activity, issue, report and skill registry.

create table if not exists public.business_activity_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  contact_name text not null default '',
  contact_channel text not null default '',
  industry text not null default '',
  item_or_service text not null default '',
  status text not null default 'discovered' check (status in (
    'discovered','contacted','replied','qualified','offer','approval','contract',
    'payment','delivery','won','lost','blocked'
  )),
  summary text not null default '',
  next_action text not null default '',
  amount numeric(18,2),
  currency text not null default 'INR',
  source text not null default 'manual',
  evidence_url text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists business_activity_events_occurred_idx
  on public.business_activity_events (occurred_at desc);
create index if not exists business_activity_events_status_idx
  on public.business_activity_events (status);
create index if not exists business_activity_events_company_idx
  on public.business_activity_events (company);

create table if not exists public.business_control_issues (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open','investigating','blocked','resolved')),
  owner_action text not null default '',
  evidence_url text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists business_control_issues_created_idx
  on public.business_control_issues (created_at desc);

create table if not exists public.business_skill_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'general',
  capability text not null default '',
  level text not null default 'developing' check (level in ('planned','developing','working','verified')),
  evidence text not null default '',
  source_repo text,
  last_used_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.business_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  window_start timestamptz not null,
  window_end timestamptz not null,
  movements integer not null default 0,
  buyer_signals integer not null default 0,
  approvals_waiting integer not null default 0,
  blockers integer not null default 0,
  wins integer not null default 0,
  locked_pipeline numeric(18,2) not null default 0,
  narrative text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'system'
);

alter table public.business_activity_events enable row level security;
alter table public.business_control_issues enable row level security;
alter table public.business_skill_registry enable row level security;
alter table public.business_daily_reports enable row level security;

-- Founder/admin-only policies. Uses the existing profiles role model.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_activity_events' and policyname='admins manage business activity') then
    create policy "admins manage business activity" on public.business_activity_events
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_control_issues' and policyname='admins manage business issues') then
    create policy "admins manage business issues" on public.business_control_issues
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_skill_registry' and policyname='admins manage skill registry') then
    create policy "admins manage skill registry" on public.business_skill_registry
      for all to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_daily_reports' and policyname='admins read business reports') then
    create policy "admins read business reports" on public.business_daily_reports
      for select to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','founder','super_admin')));
  end if;
end $$;

insert into public.business_skill_registry (name, category, capability, level, evidence)
values
  ('Opportunity Intelligence', 'sales', 'Extract and qualify commercial opportunities from mail, Drive, sheets and connected systems.', 'working', 'Gmail, Hostinger and Drive audit workflow'),
  ('Film Rights Versioning', 'rights', 'Model title × right × language × territory × platform × term × exclusivity.', 'developing', 'Cinema Master DB and Rights Versioning sheets'),
  ('Localization Planning', 'media', 'Plan subtitles, dubbing, artwork, metadata and delivery versions by territory.', 'developing', 'Localization Pipeline sheet'),
  ('Partner Deal Operations', 'sales', 'Track contact, reply, offer, approval, contract, payment and delivery.', 'working', 'Market Engagement DB and live control page'),
  ('Error and Audit Visibility', 'operations', 'Expose blockers, evidence, next action and unresolved mistakes to the founder.', 'working', 'Live Business Movement Map')
on conflict (name) do update set
  category = excluded.category,
  capability = excluded.capability,
  level = excluded.level,
  evidence = excluded.evidence,
  updated_at = now();

comment on table public.business_activity_events is 'Founder-visible evidence timeline for leads, conversations, approvals, deals, payments and deliveries.';
comment on table public.business_skill_registry is 'Living registry of agent and platform capabilities with evidence, not unsupported claims.';
