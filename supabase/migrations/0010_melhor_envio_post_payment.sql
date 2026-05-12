-- Melhor Envio post-payment shipment purchase support.
-- Run this manually in Supabase before enabling automatic label purchase.

alter table public.orders
  add column if not exists customer_document text,
  add column if not exists shipping_melhor_envio_order_id text,
  add column if not exists shipping_melhor_envio_protocol text,
  add column if not exists shipping_melhor_envio_purchase_id text,
  add column if not exists shipping_melhor_envio_purchase_protocol text,
  add column if not exists shipping_melhor_envio_purchase_status text,
  add column if not exists shipping_label_status text,
  add column if not exists shipping_label_created_at timestamptz,
  add column if not exists shipping_label_purchased_at timestamptz,
  add column if not exists shipping_label_error text,
  add column if not exists shipping_label_payload jsonb not null default '{}'::jsonb;

create index if not exists orders_shipping_label_status_idx
on public.orders (shipping_label_status);

create unique index if not exists orders_shipping_melhor_envio_order_id_idx
on public.orders (shipping_melhor_envio_order_id)
where shipping_melhor_envio_order_id is not null;

create index if not exists orders_customer_document_idx
on public.orders (customer_document)
where customer_document is not null;
