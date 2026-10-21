# Kheltriva Notifications — SQL/RLS Review Draft

**Status:** Review-only draft. Do not apply this SQL to Supabase yet.
**Related design:** [NOTIFICATIONS_INFRASTRUCTURE_DESIGN.md](./NOTIFICATIONS_INFRASTRUCTURE_DESIGN.md)

## Decisions used for this draft

These are conservative proposed defaults to keep work moving; they are not production approvals.

1. **Atomic event creation:** For initial events, insert notification rows in the same database transaction as the authoritative business operation. If the operation rolls back, its notifications roll back too. Do not use frontend event creation. Revisit a transactional outbox only if asynchronous processing is later required.
2. **Announcements:** Initial audiences are `all_academy`, `coaches`, and `parents`. A published announcement edit updates the announcement but does not resend notifications. Republish/resend should be an explicit action and is deferred.
3. **Super Admin:** No default access to academy inboxes. Only explicitly defined platform-level oversight events may notify Super Admin.
4. **Idempotency:** Each event must have a stable dedupe key generated from the authoritative source event and recipient. A duplicate event-recipient pair must not create a second inbox row.

## Live inspection findings (read-only)

- Project inspected: `acadpro-db` (`ulyealhkmlorsbdiknrh`).
- `public.users.id` matched `auth.users.id` for the currently existing accounts: Academy Owner 2/2, Coach 2/2, Parent 2/2, Super Admin 1/1. This is encouraging evidence, not a substitute for ensuring the FK and signup flows preserve the relationship.
- Existing relevant tables have RLS enabled: `users`, `parents`, `coaches`, `players`, `batches`, `player_batches`, `inquiries`, and `parent_payment_submissions`.
- No `public.notifications` or `public.announcements` table exists at inspection time.
- The inspected publication query returned no rows for these proposed tables (they do not exist yet). Realtime publication configuration must be checked again after a migration is approved.
- The inspected extension query did not establish an available scheduled cleanup mechanism. Retention scheduling remains unresolved.
- Existing policy patterns use `auth.uid()`, `private.current_user_role()`, `private.current_academy_id()`, `private.current_parent_id()`, and relationship helpers. Do not replace or weaken existing policies.

## Proposed notification table shape

The following is a schema sketch for review, not a ready-to-run migration:

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  academy_id uuid null references public.academies(id) on delete set null,
  event_type text not null,
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 1000),
  target_path text null,
  entity_type text null,
  entity_id uuid null,
  priority text not null default 'info'
    check (priority in ('info', 'success', 'warning', 'urgent')),
  dedupe_key text not null,
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

-- Prefer a narrowly scoped SECURITY DEFINER RPC for mark-read and mark-all-read.
-- Do not grant broad UPDATE on the table if column-level privileges cannot
-- guarantee that the recipient cannot change event content or ownership.
-- No client INSERT or DELETE policy is proposed.
```

### Important schema questions before turning the sketch into a migration

- Confirm whether `public.academies.id` is the correct FK target and its delete semantics.
- Confirm whether `public.users.id` has an FK to `auth.users.id` and whether any legitimate user records can exist without an Auth account.
- Confirm migration baseline and the project's current use of `gen_random_uuid()`.
- Decide whether academy-scoped events should retain their academy FK after academy deletion; `ON DELETE SET NULL` may not be suitable if null means platform-level.
- Validate and allowlist `target_path` in the UI; it is never an authorization token.
- Use the database's supported grant workflow to deny direct client insert/delete and narrowly scope read-state writes.

## Announcements RLS — deliberately not executable yet

Do not finalize audience policies until the exact join paths and active/inactive semantics are confirmed for:
- Academy Owner identity to their academy.
- Coach identity to coach profile and eligible academy audience.
- Parent identity to parent profile and the academy(s) of linked children.
- Whether a parent with linked children in multiple academies should see one announcement per academy or one deduplicated inbox item.

The live policy inspection shows relevant relationship patterns but not enough to safely author the final audience policy without inspecting all required constraints and helper definitions. Avoid a broad `academy_id = current_academy_id()` policy for parents or coaches unless that helper is confirmed to represent their intended audience.

## Event integration findings

The following inspected function behavior supports the initial event boundaries:

- `submit_parent_upi_payment` creates a parent claim. It does not record a payment.
- `review_parent_upi_payment` accepts/rejects a claim but explicitly does not write to `payments` or update `payment_dues`.
- `record_accepted_parent_upi_submission` is the successful boundary for actual ledger recording; it calls `collect_payment` and updates the claim in the same transaction.
- `collect_payment` validates caller role/scope, locks the due, inserts a payment, and updates the due.
- `create_inquiry` inserts an inquiry after role, academy, center, and field validation.
- `record_inquiry_conversion` creates the player and marks the inquiry converted in one transaction.
- `update_inquiry` handles editable status/trial fields; notification events should be selected deliberately (e.g., trial scheduled) rather than notifying on every edit.

If notifications are added to these functions, preserve their authorization checks and atomicity. Review function execute grants and any triggers before editing definitions. Do not attach a generic trigger to every row update.

## Remaining read-only checks before migration approval

1. Inspect table definitions/FKs for `academies`, `users`, `parents`, `coaches`, `players`, `batches`, `player_batches`, `inquiries`, and `parent_payment_submissions`.
2. Inspect the relevant private helper definitions and function execute grants.
3. Confirm exact parent-to-academy and coach-to-academy audience joins, including multiple linked children/batches.
4. Inspect migration history and confirm the repository's canonical migration folder/naming convention.
5. Confirm Realtime publication support and an approved retention scheduler.
6. Convert this review draft to a versioned migration only after schema and policy review. Applying it requires a separate explicit go-ahead.

## Safety boundary

No database schema, RLS policy, production data, application code, or Realtime configuration was changed while preparing this document.


## Audience relationship verification (read-only, 2026-10-21)

Live table metadata confirms the following actual paths:

- Owner identity: `public.users.id` is the auth-linked user key and `public.users.academy_id` references `public.academies.id`. The existing private helper `private.current_academy_id()` reads this mapping.
- Coach identity: `public.coaches.user_id` references `auth.users.id`; `public.coaches.academy_id` references `public.academies.id`. Assignment tables include `public.coach_batches(coach_id, batch_id)`, `public.coach_batch_assignments(coach_id, batch_id, academy_id, is_active)`, and `public.coach_batch_schedule_assignments(coach_id, batch_schedule_id, academy_id, is_active, assigned_from, assigned_until)`. These are distinct and must not be substituted for one another without matching the desired audience semantics.
- Parent identity: `public.parents.user_id` references `public.users.id`, and `public.parents.academy_id` references `public.academies.id`. `public.players.parent_id` references `public.parents.id`, while `public.players.academy_id` independently references `public.academies.id`. This supports validating parent access through the parent profile and, where needed, the parent's linked players.
- The metadata query returned no `public.notifications` or `public.announcements` tables at the time of inspection.

These are relationship facts from live table metadata, not a final authorization approval. The metadata does not by itself establish active-account semantics, whether cross-academy parent links are permitted by application invariants, or which coach assignment table is canonical for every feature. Those behaviors must be checked against existing RLS policies/functions and application flows before final SQL is approved.

## Announcement audience policy proposal (review only; not executable)

Use a published-announcement feed predicate with explicit role branches rather than a single academy helper for every role:

1. **Academy Owner:** only announcements where `academy_id = private.current_academy_id()`, and only if the current role is `academy_owner`.
2. **Coach:** require an authenticated coach profile linked by `coaches.user_id = auth.uid()`, with `coaches.academy_id = announcements.academy_id`. For audience `coaches`, include it; for `all_academy`, include it only if product semantics explicitly intend academy-wide announcements to include coaches. Do not require a batch assignment unless the product decision is that coach announcements are restricted to assigned batches or centers.
3. **Parent:** require the authenticated user to map to an active parent profile. Scope the announcement to the parent profile's academy and/or a verified linked player's academy according to the product's final multi-academy rule. Audience `parents` is parent-only; `all_academy` may include parents if the owner chose an all-academy audience. Do not assume `private.current_academy_id()` alone correctly represents parent scope.
4. **Super Admin:** no academy announcement feed access by default.
5. **Draft/archived:** not visible in the audience feed. Owner management policies remain separate from audience read policies.

Before turning this into SQL, confirm whether a parent may have children in multiple academies and whether `parents.academy_id` is guaranteed to match every linked player's `academy_id`. Also confirm coach active/inactive semantics and the canonical coach assignment table for any assignment-scoped audience.

## Role-isolation test matrix (required before migration approval)

| Test | Expected result |
|---|---|
| Owner reads own academy drafts | Allowed through owner-management policy only |
| Owner reads another academy's announcements | Denied |
| Coach reads published `coaches` audience in their academy | Allowed |
| Coach reads another academy's announcement | Denied |
| Coach reads draft or archived announcement | Denied from audience feed |
| Parent reads published `parents` audience for an eligible linked-child academy | Allowed |
| Parent reads another academy's parent-only announcement | Denied |
| Parent with children in two academies | Only the explicitly approved linked-child/parent-academy scope is visible; test both academies |
| Super Admin queries an academy audience feed | Denied by default |
| Anonymous user queries announcement feed | Denied |
| Owner attempts to change `academy_id` or `created_by_user_id` on update | Denied |
| Owner attempts to publish by bypassing approved lifecycle action | Denied; publication must be controlled |
| Editing a published announcement | Does not fan out duplicate notifications |
| Repeated authoritative event for same recipient/dedupe key | No duplicate notification row |
| User calls mark-read for another user's notification ID | No other user's row is changed |
| User calls mark-all-read | Only caller's unread rows change |

## Migration workflow and retention follow-up

The live migration history includes versions through `20261021052601` (`private_player_photo_storage`). The repository's checked-in notification SQL remains under `docs/`, not `supabase/migrations/`; reconcile the canonical migration workflow and migration-history baseline before creating a timestamped executable migration.

The extension catalog lists `pg_cron` as available, but the earlier live check did not establish that it is installed or that `cron.job` exists. Do not schedule cleanup yet. Verify the installed extension and scheduler capability; then implement and monitor a 12-month retention cleanup only in an approved migration. Realtime publication configuration also remains unchanged and must be explicitly reviewed when the notifications table is approved.

**Safety status:** This update records read-only schema findings and a review/test proposal. It does not approve or apply schema changes, RLS policies, Realtime publication changes, or scheduled jobs.
