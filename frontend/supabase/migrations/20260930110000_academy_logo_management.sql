-- Academy write authorization and logo storage
-- Applied to Supabase project: AcadPro Project

drop policy if exists "academies_insert_super_admin" on public.academies;
drop policy if exists "academies_update_super_admin" on public.academies;
drop policy if exists "academies_delete_super_admin" on public.academies;

create policy "academies_insert_super_admin"
on public.academies
for insert
to authenticated
with check ((select private.is_super_admin()));

create policy "academies_update_super_admin"
on public.academies
for update
to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

create policy "academies_delete_super_admin"
on public.academies
for delete
to authenticated
using ((select private.is_super_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-logos',
  'academy-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "academy_logos_public_read" on storage.objects;
drop policy if exists "academy_logos_super_admin_insert" on storage.objects;
drop policy if exists "academy_logos_super_admin_update" on storage.objects;
drop policy if exists "academy_logos_super_admin_delete" on storage.objects;

create policy "academy_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'academy-logos');

create policy "academy_logos_super_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'academy-logos'
  and (select private.is_super_admin())
);

create policy "academy_logos_super_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'academy-logos'
  and (select private.is_super_admin())
)
with check (
  bucket_id = 'academy-logos'
  and (select private.is_super_admin())
);

create policy "academy_logos_super_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'academy-logos'
  and (select private.is_super_admin())
);
