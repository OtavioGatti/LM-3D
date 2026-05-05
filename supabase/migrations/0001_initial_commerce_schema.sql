create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('customer', 'admin', 'owner');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.product_status as enum (
    'active',
    'draft',
    'archived',
    'out_of_stock',
    'made_to_order'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'pending_payment',
    'paid',
    'payment_failed',
    'in_production',
    'ready',
    'shipped',
    'delivered',
    'canceled',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'refunded',
    'charged_back'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  price_cents integer not null check (price_cents >= 0),
  status public.product_status not null default 'draft',
  material text,
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  dimensions text,
  production_time_days_min integer check (
    production_time_days_min is null or production_time_days_min >= 0
  ),
  production_time_days_max integer check (
    production_time_days_max is null or production_time_days_max >= 0
  ),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  accepts_customization boolean not null default false,
  customization_prompt text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_production_time_range_check check (
    production_time_days_min is null
    or production_time_days_max is null
    or production_time_days_max >= production_time_days_min
  )
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text,
  public_url text,
  alt text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_has_source_check check (
    storage_path is not null or public_url is not null
  )
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_id text,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or anonymous_id is not null)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  customization_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id, customization_notes)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.profiles(id),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'BRL',
  delivery_method text,
  delivery_address jsonb,
  customer_notes text,
  admin_notes text,
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_check check (
    total_cents = subtotal_cents + shipping_cents - discount_cents
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  customization_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_line_total_check check (
    line_total_cents = unit_price_cents * quantity
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'mercado_pago',
  mercado_pago_preference_id text,
  mercado_pago_payment_id text unique,
  external_reference text not null unique,
  status public.payment_status not null default 'pending',
  status_detail text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercado_pago',
  event_id text not null unique,
  event_type text,
  action text,
  resource_id text,
  order_id uuid references public.orders(id),
  payment_id uuid references public.payments(id),
  headers jsonb not null default '{}',
  payload jsonb not null default '{}',
  signature_valid boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_calculation_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filament_kg_cost_cents integer not null default 0 check (filament_kg_cost_cents >= 0),
  kwh_cost_cents integer not null default 0 check (kwh_cost_cents >= 0),
  printer_power_watts integer not null default 0 check (printer_power_watts >= 0),
  marketplace_fee_percent numeric(7,4) not null default 0 check (marketplace_fee_percent >= 0),
  desired_margin_percent numeric(7,4) not null default 0 check (
    desired_margin_percent >= 0 and desired_margin_percent < 100
  ),
  packaging_cost_cents integer not null default 0 check (packaging_cost_cents >= 0),
  labor_cost_cents integer not null default 0 check (labor_cost_cents >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_calculations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  input jsonb not null default '{}',
  filament_cost_cents integer not null default 0 check (filament_cost_cents >= 0),
  energy_cost_cents integer not null default 0 check (energy_cost_cents >= 0),
  operational_cost_cents integer not null default 0 check (operational_cost_cents >= 0),
  suggested_price_cents integer not null default 0 check (suggested_price_cents >= 0),
  minimum_price_cents integer not null default 0 check (minimum_price_cents >= 0),
  estimated_profit_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type text not null,
  title text,
  content jsonb not null default '{}',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'owner')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger product_images_set_updated_at
  before update on public.product_images
  for each row execute function public.set_updated_at();

create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create trigger payment_events_set_updated_at
  before update on public.payment_events
  for each row execute function public.set_updated_at();

create trigger price_calculation_presets_set_updated_at
  before update on public.price_calculation_presets
  for each row execute function public.set_updated_at();

create trigger price_calculations_set_updated_at
  before update on public.price_calculations
  for each row execute function public.set_updated_at();

create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

create index profiles_role_idx on public.profiles (role);
create index categories_active_sort_idx on public.categories (is_active, sort_order);
create index products_status_idx on public.products (status);
create index product_images_product_id_idx on public.product_images (product_id);
create index product_categories_category_id_idx on public.product_categories (category_id);
create index carts_user_id_idx on public.carts (user_id);
create index carts_anonymous_id_idx on public.carts (anonymous_id);
create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status);
create index order_items_order_id_idx on public.order_items (order_id);
create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);
create index payment_events_order_id_idx on public.payment_events (order_id);
create index payment_events_resource_id_idx on public.payment_events (resource_id);
create index price_calculation_presets_owner_id_idx on public.price_calculation_presets (owner_id);
create index price_calculations_product_id_idx on public.price_calculations (product_id);
create index price_calculations_created_by_idx on public.price_calculations (created_by);
create index site_content_published_idx on public.site_content (is_published, type);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_categories enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.price_calculation_presets enable row level security;
alter table public.price_calculations enable row level security;
alter table public.site_content enable row level security;

create policy "Users can read own profile"
on public.profiles
for select
using ((select auth.uid()) = id);

create policy "Users can update own basic profile"
on public.profiles
for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'customer');

create policy "Admins can manage profiles"
on public.profiles
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read active categories"
on public.categories
for select
using (is_active = true);

create policy "Admins can manage categories"
on public.categories
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read sellable products"
on public.products
for select
using (status in ('active', 'made_to_order'));

create policy "Admins can manage products"
on public.products
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read images for sellable products"
on public.product_images
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status in ('active', 'made_to_order')
  )
);

create policy "Admins can manage product images"
on public.product_images
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read category links for sellable products"
on public.product_categories
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status in ('active', 'made_to_order')
  )
);

create policy "Admins can manage product category links"
on public.product_categories
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users can manage own carts"
on public.carts
for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own cart items"
on public.cart_items
for all
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.user_id = (select auth.uid())
  )
);

create policy "Users can read own orders"
on public.orders
for select
using ((select auth.uid()) = user_id);

create policy "Admins can read orders"
on public.orders
for select
using ((select public.is_admin()));

create policy "Admins can update orders"
on public.orders
for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users can read own order items"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "Admins can read order items"
on public.order_items
for select
using ((select public.is_admin()));

create policy "Users can read own payments"
on public.payments
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "Admins can read payments"
on public.payments
for select
using ((select public.is_admin()));

create policy "Admins can read payment events"
on public.payment_events
for select
using ((select public.is_admin()));

create policy "Admins can manage calculation presets"
on public.price_calculation_presets
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can manage price calculations"
on public.price_calculations
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Public can read published site content"
on public.site_content
for select
using (is_published = true);

create policy "Admins can manage site content"
on public.site_content
for all
using ((select public.is_admin()))
with check ((select public.is_admin()));
