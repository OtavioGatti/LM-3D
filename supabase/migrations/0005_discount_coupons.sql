create table if not exists public.discount_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_coupons_limit_check check (
    max_redemptions is null or redeemed_count <= max_redemptions
  )
);

create table if not exists public.discount_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.discount_coupons(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  discount_cents integer not null check (discount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create trigger discount_coupons_set_updated_at
  before update on public.discount_coupons
  for each row execute function public.set_updated_at();

create index if not exists discount_coupons_code_idx on public.discount_coupons (upper(code));
create index if not exists discount_coupons_active_idx on public.discount_coupons (is_active);
create index if not exists discount_coupon_redemptions_coupon_id_idx
  on public.discount_coupon_redemptions (coupon_id);
create index if not exists discount_coupon_redemptions_order_id_idx
  on public.discount_coupon_redemptions (order_id);

alter table public.discount_coupons enable row level security;
alter table public.discount_coupon_redemptions enable row level security;

drop policy if exists "Public can read active discount coupons" on public.discount_coupons;
create policy "Public can read active discount coupons"
on public.discount_coupons
for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "Admins can manage discount coupons" on public.discount_coupons;
create policy "Admins can manage discount coupons"
on public.discount_coupons
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins can read coupon redemptions" on public.discount_coupon_redemptions;
create policy "Admins can read coupon redemptions"
on public.discount_coupon_redemptions
for select
using ((select public.is_admin()));
