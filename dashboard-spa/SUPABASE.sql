create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text null,
  source text null default 'Facebook',
  profile_url text null,
  notes text null,
  stage text not null default 'novo',
  moved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (name);
create index if not exists customers_stage_idx on public.customers (stage);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  occurred_at timestamptz not null,
  amount numeric(12,2) not null check (amount >= 0),
  seller_id text not null,
  payment_method text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_occurred_at_idx on public.sales (occurred_at desc);
create index if not exists sales_customer_id_idx on public.sales (customer_id);
create index if not exists sales_seller_id_idx on public.sales (seller_id);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  amount numeric(12,2) not null check (amount >= 0),
  platform text not null default 'FACEBOOK',
  campaign text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investments_occurred_on_idx on public.investments (occurred_on desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at
before update on public.sales
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_investments_updated_at on public.investments;
create trigger trg_investments_updated_at
before update on public.investments
for each row execute procedure public.set_updated_at();

alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.investments enable row level security;

drop policy if exists "customers_read" on public.customers;
drop policy if exists "customers_write" on public.customers;
drop policy if exists "sales_read" on public.sales;
drop policy if exists "sales_write" on public.sales;
drop policy if exists "investments_read" on public.investments;
drop policy if exists "investments_write" on public.investments;

create policy "customers_read" on public.customers
for select
to authenticated
using (true);

create policy "customers_write" on public.customers
for all
to authenticated
using (true)
with check (true);

create policy "sales_read" on public.sales
for select
to authenticated
using (true);

create policy "sales_write" on public.sales
for all
to authenticated
using (true)
with check (true);

create policy "investments_read" on public.investments
for select
to authenticated
using (true);

create policy "investments_write" on public.investments
for all
to authenticated
using (true)
with check (true);

