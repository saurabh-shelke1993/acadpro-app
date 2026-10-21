-- Kheltriva Notifications Infrastructure — final review SQL proposal
-- STATUS: REVIEW ONLY. DO NOT APPLY TO LIVE SUPABASE.
-- Kept under docs/ because the repository does not yet contain a complete,
-- reproducible supabase/migrations history. This is not an executable migration.
--
-- Frozen scope: in-app only; Realtime; Academy Owner announcements;
-- 12-month retention; scheduled reminders Phase 2.
-- Excludes schedule/trial reminders, email/SMS/WhatsApp/push, and Super Admin
-- copies. Existing business RPC definitions are not replaced or modified.
--
-- Preconditions before any application:
-- 1. Agree the canonical migration-history strategy.
-- 2. Re-check all target table columns, constraints and current grants.
-- 3. Run on a disposable database/branch (with cost approval if billable).
-- 4. Confirm the supabase_realtime publication exists and is managed as expected.
-- 5. Review and explicitly approve the final SQL.

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
  created_at timestamptz not null default pg_catalog.now(),
  read_at timestamptz null,
  constraint notifications_recipient_dedupe_unique
    unique (recipient_user_id, dedupe_key)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;
create index notifications_academy_created_idx
  on public.notifications (academy_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

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

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 5000),
  audience text not null check (audience in ('all_academy', 'coaches', 'parents')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint announcements_published_timestamp_check
    check (status <> 'published' or published_at is not null)
);

create index announcements_academy_published_idx
  on public.announcements (academy_id, published_at desc)
  where status = 'published';

alter table public.announcements enable row level security;

-- Owner management is scoped to their academy. Direct table writes are
-- restricted to drafts; publishing/archiving must go through the RPC below.
create policy announcements_owner_select
  on public.announcements for select to authenticated
  using (
    private.current_user_role() = 'academy_owner'
    and academy_id = (select private.current_academy_id())
  );

create policy announcements_owner_insert_draft
  on public.announcements for insert to authenticated
  with check (
    private.current_user_role() = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
    and status = 'draft'
    and published_at is null
  );

create policy announcements_owner_update_draft
  on public.announcements for update to authenticated
  using (
    private.current_user_role() = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
    and status = 'draft'
  )
  with check (
    private.current_user_role() = 'academy_owner'
    and academy_id = (select private.current_academy_id())
    and created_by_user_id = (select auth.uid())
    and status = 'draft'
    and published_at is null
  );

-- Audience feed: only published announcements and explicit role branches.
create policy announcements_published_audience_select
  on public.announcements for select to authenticated
  using (
    status = 'published'
    and (
      (
        private.current_user_role() = 'academy_owner'
        and academy_id = (select private.current_academy_id())
      )
      or (
        private.current_user_role() = 'coach'
        and exists (
          select 1
          from public.coaches c
          where c.user_id = (select auth.uid())
            and c.academy_id = announcements.academy_id
            and coalesce(c.is_active, false) = true
        )
        and audience in ('all_academy', 'coaches')
      )
      or (
        private.current_user_role() = 'parent'
        and audience in ('all_academy', 'parents')
        and exists (
          select 1
          from public.parents p
          join public.users u on u.id = p.user_id
          join public.players pl on pl.parent_id = p.id
          where p.user_id = (select auth.uid())
            and coalesce(p.is_active, false) = true
            and u.role = 'parent'
            and pl.academy_id = announcements.academy_id
        )
      )
    )
  );

revoke all on public.announcements from public, anon, authenticated;
grant select, insert, update on public.announcements to authenticated;

create or replace function private.set_announcement_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

revoke all on function private.set_announcement_updated_at() from public, anon, authenticated;

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function private.set_announcement_updated_at();

-- Internal notification insertion helper. No client EXECUTE grant.
create or replace function private.insert_notification(
  p_recipient_user_id uuid,
  p_academy_id uuid,
  p_event_type text,
  p_title text,
  p_message text,
  p_target_path text,
  p_entity_type text,
  p_entity_id uuid,
  p_priority text,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_recipient_user_id is null or p_event_type is null or p_dedupe_key is null then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id, academy_id, event_type, title, message,
    target_path, entity_type, entity_id, priority, dedupe_key
  )
  values (
    p_recipient_user_id, p_academy_id, p_event_type, p_title, p_message,
    p_target_path, p_entity_type, p_entity_id, coalesce(p_priority, 'info'), p_dedupe_key
  )
  on conflict (recipient_user_id, dedupe_key) do nothing;
end;
$function$;

revoke all on function private.insert_notification(uuid, uuid, text, text, text, text, text, uuid, text, text)
  from public, anon, authenticated;

-- Owner announcement publishing. Fan-out is one idempotent inbox item per
-- eligible recipient; the acting owner is excluded from self-notifications.
create or replace function public.publish_academy_announcement(p_announcement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_academy_id uuid := private.current_academy_id();
  v_announcement public.announcements%rowtype;
  v_recipient uuid;
begin
  if v_user_id is null or private.current_user_role() <> 'academy_owner' or v_academy_id is null then
    raise exception 'Only an authenticated Academy Owner can publish announcements'
      using errcode = '42501';
  end if;

  select * into v_announcement
  from public.announcements a
  where a.id = p_announcement_id
    and a.academy_id = v_academy_id
    and a.created_by_user_id = v_user_id
  for update;

  if not found then
    raise exception 'Announcement not found in the current academy'
      using errcode = '42501';
  end if;

  if v_announcement.status = 'published' then
    return false;
  end if;
  if v_announcement.status <> 'draft' then
    raise exception 'Only draft announcements can be published';
  end if;

  update public.announcements
     set status = 'published',
         published_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   where id = v_announcement.id;

  for v_recipient in
    select distinct u.id
    from public.users u
    where u.id <> v_user_id
      and (
        (v_announcement.audience = 'all_academy'
          and u.role = 'academy_owner' and u.academy_id = v_academy_id)
        or
        (v_announcement.audience in ('all_academy', 'coaches')
          and u.role = 'coach'
          and exists (
            select 1 from public.coaches c
            where c.user_id = u.id
              and c.academy_id = v_academy_id
              and coalesce(c.is_active, false) = true
          ))
        or
        (v_announcement.audience in ('all_academy', 'parents')
          and u.role = 'parent'
          and exists (
            select 1
            from public.parents p
            join public.players pl on pl.parent_id = p.id
            where p.user_id = u.id
              and coalesce(p.is_active, false) = true
              and pl.academy_id = v_academy_id
          ))
      )
  loop
    perform private.insert_notification(
      v_recipient, v_academy_id, 'announcement.published',
      v_announcement.title, v_announcement.message,
      '/announcements/' || v_announcement.id::text,
      'announcement', v_announcement.id, 'info',
      'announcement.published:' || v_announcement.id::text
    );
  end loop;

  return true;
end;
$function$;

create or replace function public.archive_academy_announcement(p_announcement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_academy_id uuid := private.current_academy_id();
  v_announcement public.announcements%rowtype;
begin
  if v_user_id is null or private.current_user_role() <> 'academy_owner' or v_academy_id is null then
    raise exception 'Only an authenticated Academy Owner can archive announcements'
      using errcode = '42501';
  end if;

  select * into v_announcement
  from public.announcements a
  where a.id = p_announcement_id
    and a.academy_id = v_academy_id
    and a.created_by_user_id = v_user_id
  for update;

  if not found then
    raise exception 'Announcement not found in the current academy'
      using errcode = '42501';
  end if;

  if v_announcement.status = 'archived' then
    return false;
  end if;

  update public.announcements
     set status = 'archived', updated_at = pg_catalog.now()
   where id = v_announcement.id;

  return true;
end;
$function$;

revoke all on function public.publish_academy_announcement(uuid) from public, anon;
revoke all on function public.archive_academy_announcement(uuid) from public, anon;
grant execute on function public.publish_academy_announcement(uuid) to authenticated;
grant execute on function public.archive_academy_announcement(uuid) to authenticated;

-- Business event fan-out uses AFTER triggers so notification writes share the
-- authoritative transaction and roll back with it. The existing RPC definitions
-- and grants are not changed. Notifications contain generic text and do not
-- copy parent contact details or transaction references into the inbox.

create or replace function private.notify_parent_payment_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_user_id uuid;
begin
  if tg_op = 'INSERT' then
    for v_owner_user_id in
      select u.id
      from public.users u
      where u.role = 'academy_owner'
        and u.academy_id = new.academy_id
    loop
      perform private.insert_notification(
        v_owner_user_id, new.academy_id, 'payment_claim.submitted',
        'Parent payment submitted', 'A parent submitted a UPI payment claim for review.',
        '/payments/parent-submissions', 'parent_payment_submission', new.id,
        'info', 'payment_claim.submitted:' || new.id::text
      );
    end loop;
  elsif old.status = 'pending' and new.status in ('accepted', 'rejected') then
    perform private.insert_notification(
      new.submitted_by_user_id, new.academy_id,
      'payment_claim.' || new.status,
      case when new.status = 'accepted' then 'Payment claim accepted' else 'Payment claim rejected' end,
      case when new.status = 'accepted'
        then 'Your UPI payment claim was accepted. It is not recorded as a payment until the academy records it.'
        else 'Your UPI payment claim was rejected. Open the payment section for the review details.'
      end,
      '/parent/payments', 'parent_payment_submission', new.id,
      case when new.status = 'rejected' then 'warning' else 'success' end,
      'payment_claim.reviewed:' || new.id::text
    );
  elsif old.status is distinct from 'recorded' and new.status = 'recorded' then
    perform private.insert_notification(
      new.submitted_by_user_id, new.academy_id, 'payment.recorded',
      'Payment recorded', 'The academy recorded your submitted UPI payment.',
      '/parent/payments', 'parent_payment_submission', new.id,
      'success', 'payment.recorded:' || new.id::text
    );
  end if;
  return new;
end;
$function$;

create trigger notifications_parent_payment_submission_event
after insert or update of status on public.parent_payment_submissions
for each row execute function private.notify_parent_payment_submission_event();

create or replace function private.notify_inquiry_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_user_id uuid;
begin
  for v_owner_user_id in
    select u.id
    from public.users u
    where u.role = 'academy_owner'
      and u.academy_id = new.academy_id
      and u.id is distinct from new.created_by
  loop
    perform private.insert_notification(
      v_owner_user_id, new.academy_id, 'inquiry.created',
      'New enquiry', 'A new player enquiry was created.',
      '/enquiries', 'inquiry', new.id, 'info',
      'inquiry.created:' || new.id::text
    );
  end loop;
  return new;
end;
$function$;

create trigger notifications_inquiry_created
after insert on public.inquiries
for each row execute function private.notify_inquiry_created();

revoke all on function private.notify_parent_payment_submission_event() from public, anon, authenticated;
revoke all on function private.notify_inquiry_created() from public, anon, authenticated;

-- Retention routine only. It deliberately does not install a scheduler.
-- Scheduler/cron configuration is a separate approved deployment step.
create or replace function private.delete_expired_notifications()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted bigint;
begin
  delete from public.notifications
   where created_at < pg_catalog.now() - interval '12 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function private.delete_expired_notifications() from public, anon, authenticated;

-- The live supabase_realtime publication exists. The last read-only
-- publication-table query showed no notification table membership. Add only
-- the notifications table, and only if not already present. This remains
-- proposal SQL and must not be applied before explicit approval.
do $publication$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$publication$;

commit;

-- Review/testing checklist before approval:
-- [ ] Run in a disposable database with matching schema and policies.
-- [ ] Confirm announcement owner policies work with existing role helpers.
-- [ ] Confirm RLS combines owner-management and published-audience SELECT policies
--     as intended; test draft/published/archived states by all roles.
-- [ ] Test multiple parents/children and coach profile active/inactive cases.
-- [ ] Test UPI pending -> accepted/rejected -> recorded; verify no duplicate
--     payment-recorded event from collect_payment and its wrapper.
-- [ ] Test repeated trigger execution/idempotency and transaction rollback.
-- [ ] Test recipient cannot alter content/recipient or read another inbox.
-- [ ] Test mark-read and mark-all-read only affect the caller's rows.
-- [ ] Review direct table privileges, default privileges, and trigger ownership.
-- [ ] Verify Supabase Realtime publication; choose/verify retention scheduler.
-- [ ] Establish canonical migration-history workflow before making executable.
