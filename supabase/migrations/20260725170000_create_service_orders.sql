create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_code text not null check (service_code in ('film_onboarding','licensing_ready')),
  service_name text not null,
  subtotal_paise integer not null check (subtotal_paise > 0),
  gst_paise integer not null check (gst_paise >= 0),
  total_paise integer not null check (total_paise > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_email text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_orders_user_created_idx
  on public.service_orders(user_id, created_at desc);
create index if not exists service_orders_status_idx
  on public.service_orders(status);

alter table public.service_orders enable row level security;

drop policy if exists "Users can read own service orders" on public.service_orders;
create policy "Users can read own service orders"
  on public.service_orders for select
  using (auth.uid() = user_id);

create or replace function public.set_service_orders_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_orders_updated_at on public.service_orders;
create trigger service_orders_updated_at
before update on public.service_orders
for each row execute function public.set_service_orders_updated_at();
