create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_contact text not null,
  customer_email text,
  customer_phone text,
  title text not null,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  desired_material text,
  desired_colors text,
  deadline text,
  reference_url text,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'quoted', 'converted', 'closed', 'canceled')
  ),
  estimated_price_cents integer check (
    estimated_price_cents is null or estimated_price_cents >= 0
  ),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger custom_requests_set_updated_at
  before update on public.custom_requests
  for each row execute function public.set_updated_at();

create index if not exists custom_requests_user_id_idx on public.custom_requests (user_id);
create index if not exists custom_requests_status_idx on public.custom_requests (status);
create index if not exists custom_requests_created_at_idx on public.custom_requests (created_at desc);

alter table public.custom_requests enable row level security;

drop policy if exists "Public can create custom requests" on public.custom_requests;
create policy "Public can create custom requests"
on public.custom_requests
for insert
with check (
  status = 'new'
  and estimated_price_cents is null
  and admin_notes is null
);

drop policy if exists "Users can read own custom requests" on public.custom_requests;
create policy "Users can read own custom requests"
on public.custom_requests
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can manage custom requests" on public.custom_requests;
create policy "Admins can manage custom requests"
on public.custom_requests
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));
