drop policy if exists "Public can create custom requests" on public.custom_requests;

drop policy if exists "Authenticated users can create own custom requests" on public.custom_requests;
create policy "Authenticated users can create own custom requests"
on public.custom_requests
for insert
with check (
  (select auth.uid()) = user_id
  and status = 'new'
  and estimated_price_cents is null
  and admin_notes is null
);
