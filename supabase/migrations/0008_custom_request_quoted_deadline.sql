alter table public.custom_requests
  add column if not exists quoted_deadline text;

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
);
