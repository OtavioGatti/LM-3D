insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Product images are publicly readable'
  ) then
    create policy "Product images are publicly readable"
    on storage.objects
    for select
    using (bucket_id = 'product-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Owners can upload product images'
  ) then
    create policy "Owners can upload product images"
    on storage.objects
    for insert
    with check (bucket_id = 'product-images' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Owners can update product images'
  ) then
    create policy "Owners can update product images"
    on storage.objects
    for update
    using (bucket_id = 'product-images' and public.is_admin())
    with check (bucket_id = 'product-images' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Owners can delete product images'
  ) then
    create policy "Owners can delete product images"
    on storage.objects
    for delete
    using (bucket_id = 'product-images' and public.is_admin());
  end if;
end $$;
