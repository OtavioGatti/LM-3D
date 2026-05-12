-- Package data for shipping custom request quotes through Melhor Envio.
-- Run this manually in Supabase before charging shipping on custom request payments.

alter table public.custom_requests
  add column if not exists quoted_weight_grams integer check (
    quoted_weight_grams is null or quoted_weight_grams > 0
  ),
  add column if not exists quoted_package_width_cm numeric(8, 2) check (
    quoted_package_width_cm is null or quoted_package_width_cm > 0
  ),
  add column if not exists quoted_package_height_cm numeric(8, 2) check (
    quoted_package_height_cm is null or quoted_package_height_cm > 0
  ),
  add column if not exists quoted_package_length_cm numeric(8, 2) check (
    quoted_package_length_cm is null or quoted_package_length_cm > 0
  );

drop policy if exists "Authenticated users can create own custom requests" on public.custom_requests;
create policy "Authenticated users can create own custom requests"
on public.custom_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'new'
  and estimated_price_cents is null
  and admin_notes is null
  and quote_message is null
  and quoted_deadline is null
  and quoted_weight_grams is null
  and quoted_package_width_cm is null
  and quoted_package_height_cm is null
  and quoted_package_length_cm is null
);
