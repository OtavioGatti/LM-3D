-- Shipping support for Melhor Envio quotes.
-- Run this manually in Supabase before enabling Melhor Envio in production.

alter table public.products
  add column if not exists package_width_cm numeric(8, 2) check (
    package_width_cm is null or package_width_cm > 0
  ),
  add column if not exists package_height_cm numeric(8, 2) check (
    package_height_cm is null or package_height_cm > 0
  ),
  add column if not exists package_length_cm numeric(8, 2) check (
    package_length_cm is null or package_length_cm > 0
  );

update public.products
set
  package_width_cm = coalesce(package_width_cm, 12),
  package_height_cm = coalesce(package_height_cm, 8),
  package_length_cm = coalesce(package_length_cm, 28)
where slug = 'dragao-articulado';

update public.products
set
  package_width_cm = coalesce(package_width_cm, 8),
  package_height_cm = coalesce(package_height_cm, 2),
  package_length_cm = coalesce(package_length_cm, 8)
where slug = 'chaveiro-nome';

update public.products
set
  package_width_cm = coalesce(package_width_cm, 16),
  package_height_cm = coalesce(package_height_cm, 8),
  package_length_cm = coalesce(package_length_cm, 9)
where slug = 'organizador-mesa';

update public.products
set
  package_width_cm = coalesce(package_width_cm, 11),
  package_height_cm = coalesce(package_height_cm, 10),
  package_length_cm = coalesce(package_length_cm, 9)
where slug = 'suporte-controle';

alter table public.orders
  add column if not exists shipping_provider text,
  add column if not exists shipping_service_id text,
  add column if not exists shipping_service_name text,
  add column if not exists shipping_company_name text,
  add column if not exists shipping_delivery_time_days integer check (
    shipping_delivery_time_days is null or shipping_delivery_time_days >= 0
  ),
  add column if not exists shipping_origin_postal_code text,
  add column if not exists shipping_destination_postal_code text,
  add column if not exists shipping_quote jsonb not null default '{}'::jsonb;

create index if not exists orders_shipping_provider_idx
on public.orders (shipping_provider);

create index if not exists orders_shipping_service_id_idx
on public.orders (shipping_service_id);
