-- StreamVista Self-Operated Rights OS foundation
-- SOURCE ONLY: do not execute in production without review and explicit approval.

begin;

create type if not exists public.workflow_review_status as enum (
  'pending', 'submitted', 'needs_clarification', 'verified', 'rejected', 'expired'
);

create type if not exists public.asset_access_level as enum (
  'metadata', 'poster', 'trailer', 'screener', 'documents', 'master'
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null check (organization_type in ('seller','buyer','platform','service_provider')),
  verification_status public.workflow_review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pan_masked text,
  gstin text,
  cin text,
  bank_verified boolean not null default false,
  kyc_status public.workflow_review_status not null default 'pending',
  mandate_status public.workflow_review_status not null default 'pending',
  rights_owner_status public.workflow_review_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.title_rights_inventory (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.content_titles(id) on delete cascade,
  rights_category text not null check (rights_category in (
    'digital','satellite','theatrical','dubbing','remake','music','avod','fast','youtube','inflight','ancillary'
  )),
  language_code text,
  territory_code text not null default 'WORLD',
  exclusivity text not null check (exclusivity in ('exclusive','non_exclusive','shared','unavailable','unknown')),
  availability_status text not null check (availability_status in ('available','reserved','licensed','expired','blocked','verification_required')),
  valid_from date,
  valid_until date,
  source_document_path text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create unique index if not exists title_rights_inventory_scope_unique
  on public.title_rights_inventory (
    title_id,
    rights_category,
    coalesce(language_code, ''),
    territory_code,
    exclusivity,
    coalesce(valid_from, date '1900-01-01'),
    coalesce(valid_until, date '9999-12-31')
  );

create table if not exists public.title_assets (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.content_titles(id) on delete cascade,
  asset_type text not null check (asset_type in ('poster_vertical','poster_horizontal','thumbnail','teaser','trailer','screener','master','subtitle','audio','document')),
  storage_path text not null,
  approval_status public.workflow_review_status not null default 'pending',
  buyer_visible boolean not null default false,
  public_visible boolean not null default false,
  download_allowed boolean not null default false,
  copyright_confirmed boolean not null default false,
  uploaded_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_reviews (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.content_titles(id) on delete cascade,
  status public.workflow_review_status not null default 'pending',
  ownership_clear boolean not null default false,
  mandate_clear boolean not null default false,
  territory_term_clear boolean not null default false,
  conflict_found boolean not null default false,
  internal_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qc_reviews (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.content_titles(id) on delete cascade,
  status public.workflow_review_status not null default 'pending',
  metadata_passed boolean not null default false,
  video_passed boolean not null default false,
  audio_passed boolean not null default false,
  subtitle_passed boolean not null default false,
  artwork_passed boolean not null default false,
  internal_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  languages text[] not null default '{}',
  genres text[] not null default '{}',
  territories text[] not null default '{}',
  rights_categories text[] not null default '{}',
  budget_min numeric,
  budget_max numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.deal_rooms (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.content_titles(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired','revoked','closed')),
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_title_access (
  id uuid primary key default gen_random_uuid(),
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  title_id uuid not null references public.content_titles(id) on delete cascade,
  deal_room_id uuid references public.deal_rooms(id) on delete cascade,
  access_levels public.asset_access_level[] not null default '{metadata,poster,trailer}',
  allow_download boolean not null default false,
  expires_at timestamptz,
  approved_by uuid not null references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (buyer_organization_id, title_id, deal_room_id)
);

create table if not exists public.buyer_offers (
  id uuid primary key default gen_random_uuid(),
  deal_room_id uuid not null references public.deal_rooms(id) on delete cascade,
  rights_scope jsonb not null default '{}'::jsonb,
  commercial_model text not null check (commercial_model in ('mg','outright','revenue_share','hybrid','other')),
  offer_amount numeric,
  currency text not null default 'INR',
  status text not null default 'submitted' check (status in ('draft','submitted','negotiation','seller_approved','seller_rejected','contracted','withdrawn','expired')),
  submitted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  title_id uuid not null references public.content_titles(id),
  asset_id uuid references public.title_assets(id),
  deal_room_id uuid references public.deal_rooms(id),
  action text not null check (action in ('view','play','download','request','deny')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.seller_verifications enable row level security;
alter table public.title_rights_inventory enable row level security;
alter table public.title_assets enable row level security;
alter table public.legal_reviews enable row level security;
alter table public.qc_reviews enable row level security;
alter table public.buyer_preferences enable row level security;
alter table public.deal_rooms enable row level security;
alter table public.buyer_title_access enable row level security;
alter table public.buyer_offers enable row level security;
alter table public.asset_access_logs enable row level security;

-- Intentionally no permissive policies in this pending migration.
-- Policies must be added only after mapping to the repository's existing role helpers.
-- Default-deny remains active until that review is complete.

commit;
