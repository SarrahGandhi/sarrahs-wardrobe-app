begin;

-- Persist the private object key, never an expiring signed URL.
alter table public.wardrobe_items add column image_path text;
alter table public.wardrobe_items add constraint wardrobe_image_owner_path check (
  image_path is null or image_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.jpg$')
);
alter table public.wardrobe_items add constraint wardrobe_image_source check (
  image_path is null or image_url is null
);
create unique index wardrobe_items_image_path_idx on public.wardrobe_items(image_path) where image_path is not null;
comment on column public.wardrobe_items.image_path is 'Private wardrobe-images bucket key: user UUID/photo UUID.jpg. Resolve with a short-lived signed URL.';

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe-images', 'wardrobe-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

-- Restrictive guard keeps this bucket private even if another bucket has a broad
-- permissive policy. It does not change access rules for other buckets.
create policy wardrobe_images_owner_guard on storage.objects as restrictive for all to public
using (bucket_id <> 'wardrobe-images' or (select auth.uid())::text = (storage.foldername(name))[1])
with check (bucket_id <> 'wardrobe-images' or (select auth.uid())::text = (storage.foldername(name))[1]);

create policy wardrobe_images_read on storage.objects for select to authenticated
using (bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy wardrobe_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'wardrobe-images' and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$'));
-- Uploads use unique immutable paths. No UPDATE policy: clients cannot overwrite images.
create policy wardrobe_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.wardrobe_items where image_path = storage.objects.name));

commit;
