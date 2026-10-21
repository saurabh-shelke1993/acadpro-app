-- Kheltriva Notifications Infrastructure — migration review draft
-- NOT APPLIED. This file is intentionally under docs/, not supabase/migrations/.
-- Requires review of announcement audience rules, grants, Realtime and retention before use.

begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  academy_id uuid null references public.academies(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 1000),
  target_path text null,
  entity_type text null,
  entity_id uuid null,
  priority text not null default 'info'
    check (priority in ('info', 'success', 'warning', 'urgent')),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint notifications_recipient_dedupe_unique
    unique (recipient_user_id, dedupe_key)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

-- No direct INSERT/DELETE policy. The recipient cannot edit notification content.
-- Mark-read RPC limits mutation to the caller's own read_at field.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = coalesce(read_at, pg_catalog.now())
   where id = p_notification_id
     and recipient_user_id = auth.uid();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = pg_catalog.now()
   where recipient_user_id = auth.uid()
     and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Explicitly remove broad table privileges before adding only read access.
-- Validate existing default privileges/project grant conventions before applying.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 5000),
  audience text not null
    check (audience in ('all_academy', 'coaches', 'parents')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_publish_state_check
    check ((status = 'published' and published_at is not null)
        or (status <> 'published'))
);

create index announcements_academy_published_idx
  on public.announcements (academy_id, published_at desc)
  where status = 'published';

alter table public.announcements enable row level security;

-- Academy owners may manage announcements only in their own academy.
-- This draft intentionally does not allow changing the academy or author
-- during an update; application/RPC validation must also enforce lifecycle rules.
create policy announcements_owner_select
  on public.announcements
  for select to authenticated
  using (
    lower(coalesce(private.current_user_role(), '')) = 'academy_owner'
    and academy_id = (select private.current_academy_id())
  );

create policy announcements_owner_insert
  on public.announcements
  for insert to authenticated
  with check (
    lower(coalesce(private.current_user_role(), '')) = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
  );

create policy announcements_owner_update
  on public.announcements
  for update to authenticated
  using (
    lower(coalesce(private.current_user_role(), '')) = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
  )
  with check (
    lower(coalesce(private.current_user_role(), '')) = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
  );

-- Announcement audience SELECT policy is intentionally not included in this
-- first SQL draft. It must be finalized after deciding whether parents with
-- linked children in multiple academies see one or multiple academy feeds,
-- and after verifying active enrollment and coach assignment rules.
-- No direct announcement DELETE policy is proposed.

revoke all on public.announcements from anon, authenticated;
grant select, insert, update on public.announcements to authenticated;

-- Retention and Realtime publication are deliberately not changed here.
-- Add notifications to supabase_realtime only after publication support is
-- verified. Add a controlled 12-month cleanup job only after scheduler choice.
-- Business event fan-out is a separate reviewed migration; never client-insert.

commit;
