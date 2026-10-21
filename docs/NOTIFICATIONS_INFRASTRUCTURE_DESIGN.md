# Kheltriva Notifications Infrastructure — Design Proposal

**Status:** Draft for review; not approved for implementation  
**Scope:** N1 functional specification and N2 inspection/design outcomes  
**Branch target:** `main`  
**Important:** This document does not authorize a database migration or application implementation. No schema changes are proposed as applied.

## 1. Frozen product decisions

- Delivery: in-app only for initial release.
- Live updates: Supabase Realtime, after publication and authorization are verified.
- Scheduled reminders: Phase 2.
- Announcements: Academy Owner may publish within their own academy to approved audiences.
- Retention: 12 months, with controlled cleanup.
- Roles: Super Admin, Academy Owner, Coach, Parent.

## 2. Product behavior

The shared application shell will expose a notification bell with unread count, recent items, and a link to the full notification inbox. The inbox will support All/Unread/Read filters, mark-one-read, mark-all-read, loading/empty/error states, bounded retrieval/pagination, and safe navigation to authorized in-app destinations.

Read state is per recipient. Clicking a notification does not grant permission to view its target record. The destination must independently enforce the existing application authorization rules.

Notification text should be concise and avoid unnecessary personal, child, or payment details. No email, WhatsApp, SMS, push delivery, or scheduled reminders are in the initial scope.

## 3. Candidate event matrix

The event list is a proposal. Each event must be tied to a confirmed authoritative success point and verified recipient resolution before implementation.

| Event key | Candidate recipient(s) | Trigger boundary / caveat |
|---|---|---|
| `payment.claim_submitted` | Academy Owner(s) authorized for the relevant academy | After parent UPI claim submission succeeds; not a confirmed payment |
| `payment.claim_accepted` | Submitting Parent | After acceptance decision succeeds |
| `payment.claim_rejected` | Submitting Parent | After rejection decision succeeds |
| `payment.recorded` | Parent and/or Academy Owner according to approved event policy | Only after the ledger entry and due update succeed |
| `inquiry.created` | Academy Owner(s) authorized for the inquiry's academy | After inquiry creation succeeds |
| `inquiry.converted` | Academy Owner | After conversion succeeds |
| `schedule.changed` | Affected Coaches and relevant linked Parents | Only for users whose actual assignment/enrollment is affected |
| `announcement.published` | Selected Coach and/or Parent audience within the academy | After authorized publication succeeds |

Defer correction-workflow and broad attendance notifications until the core engine is proven. Super Admin notifications should be explicitly defined platform-oversight events, not an automatic copy of every academy's routine notifications.

## 4. Proposed database model (not applied)

### 4.1 `public.notifications`

| Column | Proposed type / constraint | Purpose |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | Unique notification |
| `recipient_user_id` | `uuid not null references public.users(id)` | Owner of this inbox row |
| `academy_id` | `uuid null references public.academies(id)` | Scope for academy events; null only for explicitly approved global events |
| `event_type` | `text not null` | Stable event key |
| `title` | `text not null` | Short heading |
| `message` | `text not null` | Minimal display message |
| `target_path` | `text null` | Internal route only; validate/allowlist before navigation |
| `entity_type` | `text null` | Optional related entity kind |
| `entity_id` | `uuid null` | Optional related entity ID; not an authorization grant |
| `priority` | constrained text, default `info` | Proposed values: `info`, `success`, `warning`, `urgent` |
| `dedupe_key` | `text null` | Idempotency key for event-recipient pair |
| `created_at` | `timestamptz not null default now()` | Creation time |
| `read_at` | `timestamptz null` | Null means unread; avoids contradictory boolean/timestamp state |

Proposed indexes:
- Recipient and newest-first retrieval: `(recipient_user_id, created_at desc)`.
- Unread retrieval: partial index on `(recipient_user_id, created_at desc) where read_at is null`.
- A unique constraint on a suitably scoped dedupe key only if key generation and nullable semantics are finalized.

Use a stable database enum or CHECK constraint for priority and an allowlist/validation for event types where feasible. Final FK targets, delete behavior, naming conventions, and migration style must be checked against the live schema before implementation.

### 4.2 `public.announcements` (proposed)

A separate table is recommended because authoring and publishing has a lifecycle distinct from system-generated notification rows.

Candidate fields:
- `id` UUID primary key
- `academy_id` UUID not null
- `created_by_user_id` UUID not null
- `title`, `message`
- `audience` constrained to `all_academy`, `coaches`, `parents` for the first release
- `status` constrained to `draft`, `published`, `archived`
- `published_at`, `created_at`, `updated_at`

Publication should create one notification per eligible recipient, with deduplication. Academy Owners may publish only within their own academy. Individual-player or batch-specific targeting is out of scope until separately approved. Editing a published announcement should not resend it automatically; explicit republish semantics should be decided before implementation.

## 5. Authorization and RLS proposal (not applied)

1. Enable RLS on both tables.
2. Notifications SELECT: allow only the authenticated recipient, using the verified mapping between `auth.uid()` and `public.users.id`.
3. Notifications UPDATE: permit recipient updates only to `read_at` on their own rows. Prefer a narrowly scoped RPC for mark-read/mark-all-read if column-level grants cannot reliably restrict updates.
4. Notifications INSERT: no direct client insert grant. Creation must use a trusted database function or backend path that validates event type, source operation, recipient eligibility, and academy scope.
5. Notifications DELETE: no client delete grant. Retention cleanup uses a restricted maintenance path.
6. Announcements SELECT: only intended audiences in the matching academy, plus explicitly approved platform oversight access.
7. Announcements INSERT/UPDATE: only Academy Owner identity authorized for the matching academy; publication status transitions must be validated, not trusted from arbitrary client fields.
8. Do not grant Super Admin broad access to every user's inbox by default. Platform-level visibility must be a separate explicit requirement.
9. Realtime subscription filtering is not an authorization boundary; RLS and grants must enforce isolation.
10. SECURITY DEFINER functions, if used, must set a safe search_path, qualify object names, validate caller identity and role, and expose only the minimum required operation.

### Identity mapping blocker

The current `public.users` table has `id`, `full_name`, `email`, `role`, `academy_id`, and `created_at`. The precise relationship between `public.users.id` and `auth.uid()` must be verified for Super Admin, Academy Owner, Coach, and Parent before these policies are finalized. Parent and Coach relationship joins must also be traced.

## 6. Event creation strategy

Prefer a transactional database operation or a trusted server-side event handler at the authoritative success boundary. Do not create notifications solely from frontend click handlers. A notification insert failure should not leave a payment, inquiry, or UPI workflow partially completed. Decide whether notification creation is part of the business transaction or handled through a transactional outbox after inspecting each function.

Known candidate database functions found during inspection include:
- Parent UPI: `submit_parent_upi_payment`, `review_parent_upi_payment`, `record_accepted_parent_upi_submission`
- Payment collection: `collect_payment`
- Inquiries: `create_inquiry`, `update_inquiry`, `record_inquiry_conversion`
- Payment corrections: `request_payment_correction`, `approve_payment_correction`, `reject_payment_correction` (deferred from initial scope)

Their complete definitions, transaction behavior, recipient resolution and failure behavior must be reviewed before selecting a trigger/RPC/outbox approach. Do not blindly add triggers to SECURITY DEFINER functions.

## 7. Realtime and retention

- Verify whether the `notifications` table can be safely added to the `supabase_realtime` publication using the project's supported migration workflow.
- Subscribe only to the signed-in user's notifications; still rely on RLS for security.
- On reconnect, refresh the unread count and recent items from the database to recover missed events.
- Retain rows for 12 months from `created_at`; define the exact cutoff and timezone semantics in the migration/runbook.
- Use a controlled scheduled cleanup mechanism only after confirming the project's available scheduler. Do not assume Realtime implies scheduling support.
- Cleanup must touch notification rows only, never the referenced payment, inquiry, attendance, player, or announcement source records.

## 8. Required validation before approval

### Database and security
- Verify `auth.uid() = public.users.id` mapping for all four roles.
- Inspect actual RLS policies and grants on relevant tables/functions.
- Confirm Parent-to-player and Coach-to-batch assignment joins.
- Confirm migration naming and current migration baseline.
- Confirm Realtime publication configuration and cleanup scheduler availability.
- Test forged recipient IDs, forged academy IDs, unauthorized announcement publication, unauthorized read-state changes, and cross-academy reads.

### Event correctness
- A failed business operation creates no notification.
- UPI submission, acceptance, rejection and actual payment recording are distinct events.
- Notification creation is idempotent under retry.
- Recipient resolution uses trusted data and supports multiple eligible owners when required.
- A parent sees only linked-child events and intended academy announcements.
- A coach sees only relevant assigned-batch events.
- Opening a target route still enforces authorization.

### UI and regression
- Bell, unread count, inbox filters, mark-one-read, mark-all-read, pagination, empty/error states.
- Realtime event and reconnect behavior.
- All four roles independently.
- Existing payment, UPI, inquiry, schedule, attendance and parent portal workflows remain unaffected.
- CI production build passes.

## 9. Implementation gates

**Gate A — Design review:** approve event matrix, schema, RLS, announcement targeting, event creation strategy, Realtime and retention.

**Gate B — Migration review:** review exact SQL migration before applying it to Supabase.

**Gate C — Core engine:** implement service/UI after database policies pass isolation tests.

**Gate D — Event integration:** add one event family at a time and test it against existing workflows.

No application code or database schema changes are authorized by this proposal.
