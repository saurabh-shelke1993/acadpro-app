insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists player_photos_authorized_read on storage.objects;
create policy player_photos_authorized_read
on storage.objects for select to authenticated
using (
  bucket_id = 'player-photos'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and array_length(string_to_array(name, '/'), 1) = 3
  and exists (
    select 1 from public.players p
    where p.id::text = split_part(storage.objects.name, '/', 2)
      and p.academy_id::text = split_part(storage.objects.name, '/', 1)
  )
);

drop policy if exists player_photos_owner_insert on storage.objects;
create policy player_photos_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-photos'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 3) ~* '^[^/]+\.(png|jpe?g|webp)$'
  and array_length(string_to_array(name, '/'), 1) = 3
  and private.is_academy_owner()
  and split_part(name, '/', 1) = (select private.current_academy_id())::text
  and exists (
    select 1 from public.players p
    where p.id::text = split_part(storage.objects.name, '/', 2)
      and p.academy_id = (select private.current_academy_id())
  )
);

drop policy if exists player_photos_owner_update on storage.objects;
create policy player_photos_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'player-photos'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and array_length(string_to_array(name, '/'), 1) = 3
  and private.is_academy_owner()
  and split_part(name, '/', 1) = (select private.current_academy_id())::text
  and exists (
    select 1 from public.players p
    where p.id::text = split_part(storage.objects.name, '/', 2)
      and p.academy_id = (select private.current_academy_id())
  )
)
with check (
  bucket_id = 'player-photos'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 3) ~* '^[^/]+\.(png|jpe?g|webp)$'
  and array_length(string_to_array(name, '/'), 1) = 3
  and private.is_academy_owner()
  and split_part(name, '/', 1) = (select private.current_academy_id())::text
  and exists (
    select 1 from public.players p
    where p.id::text = split_part(storage.objects.name, '/', 2)
      and p.academy_id = (select private.current_academy_id())
  )
);

drop policy if exists player_photos_owner_delete on storage.objects;
create policy player_photos_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'player-photos'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and array_length(string_to_array(name, '/'), 1) = 3
  and private.is_academy_owner()
  and split_part(name, '/', 1) = (select private.current_academy_id())::text
  and exists (
    select 1 from public.players p
    where p.id::text = split_part(storage.objects.name, '/', 2)
      and p.academy_id = (select private.current_academy_id())
  )
);
