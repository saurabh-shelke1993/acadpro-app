# Batch Schedule Database Change Record

## Scope

This document records the Batch Schedule Management database work completed for
AcadPro against Supabase project `ulyealhkmlorsbdiknrh`.

The live database changes were applied and verified on 10 October 2026.

This repository did not previously contain a `supabase/migrations` directory.
The changes below were therefore applied through the Supabase database migration
interface/tooling and are recorded here for source-control traceability.

**Important:** This document is an audit record of the already-applied live
changes. It is not a rerunnable migration script. Do not execute it as SQL.

## S1 status

| Phase | Status |
|---|---|
| S1-A — Design Freeze | Complete |
| S1-B — DB Foundation | Complete |
| S1-C-1 — Batch Schedule Validation | Complete |
| S1-C-2 — Player Schedule Enrollment Validation | Complete |
| S1-C-3 — Coach Schedule Assignment Validation | Complete |
| S1-C-4 — Attendance Schedule Validation | Complete |
| S1-C-5 — Concurrency / Overlap Protections | Complete |
| S1-D — RLS / Authorization | Applied and verified |
| S1-E — Attendance Uniqueness Transition | Complete |

## Tables added

### public.batch_schedules

One row represents one recurring training session.

Key fields:

- `academy_id`
- `batch_id`
- `center_id`
- `day_of_week` — ISO weekday, Monday=1 through Sunday=7
- `start_time`
- `end_time`
- `session_label`
- `is_active`
- audit fields and timestamps

Active duplicate sessions are prevented by:

`(batch_id, center_id, day_of_week, start_time, end_time)`

The uniqueness is intentionally partial and applies only to active rows.

### public.player_batch_schedules

Maps a player to a specific recurring schedule session.

Important fields:

- `player_id`
- `batch_schedule_id`
- `enrolled_from`
- `enrolled_until`
- `is_active`

A player may enroll in multiple distinct sessions belonging to the same
logical batch.

### public.coach_batch_schedule_assignments

Maps a coach to a specific recurring schedule session.

Important fields:

- `coach_id`
- `batch_schedule_id`
- `assigned_from`
- `assigned_until`
- `is_active`

Multiple coaches may be assigned to one session.

## Attendance changes

Added:

- `attendance.batch_schedule_id`

with a foreign key to `batch_schedules` using RESTRICT deletion.

Existing attendance was **not backfilled**.

Current live state after verification:

- Total attendance rows: 118
- Schedule-aware attendance rows: 0

Legacy attendance remains valid without a schedule reference.

## Validation

### Batch schedule validation

Enforces:

- batch and center belong to the declared academy
- active schedules require active batches and centers
- valid weekday
- valid start/end time

### Player enrollment validation

Enforces:

- player and schedule belong to the same academy
- player's current batch matches schedule batch
- player is active
- schedule is active
- valid enrollment date range
- duplicate active enrollment prevention
- no overlapping active recurring sessions for the same player

Per-player transaction advisory locking is used for concurrency protection.

### Coach assignment validation

Enforces:

- coach and schedule belong to the same academy
- coach is active
- schedule is active
- valid assignment date range
- duplicate active assignment prevention
- no overlapping active recurring sessions for the same coach

Per-coach transaction advisory locking is used for concurrency protection.

### Schedule modification protection

Schedule changes are checked against existing player enrollments and coach
assignments.

The database rejects a schedule change that would introduce an overlapping
active session for an already-enrolled player or assigned coach.

Changes to a schedule's academy or logical batch are blocked while dependent
enrollment or assignment records exist.

### Attendance validation

When `batch_schedule_id` is supplied, attendance is validated against:

- schedule academy
- schedule batch
- schedule center
- schedule weekday
- player's current batch
- player's active enrollment for the attendance date
- schedule active status for new attendance

Legacy attendance with a NULL schedule ID remains supported.

## RLS

RLS is enabled on:

- `batch_schedules`
- `player_batch_schedules`
- `coach_batch_schedule_assignments`

Access model:

- Super Admin — global management
- Academy Owner — academy-scoped management
- Coach — read access to assigned sessions and enrolled players
- Parent — read access to schedules relevant to linked children

Attendance policies were also made schedule-aware.

Super Admin can manage existing attendance records but is intentionally
excluded from authenticated attendance insertion.

## Attendance uniqueness transition

The two redundant legacy uniqueness constraints were removed:

- `unique_attendance`
- `unique_player_attendance`

They were replaced by:

### Legacy attendance

`uq_attendance_legacy_player_batch_date`

Unique on:

`(player_id, batch_id, attendance_date)`

when `batch_schedule_id IS NULL`.

### Schedule-aware attendance

`uq_attendance_player_schedule_date`

Unique on:

`(player_id, batch_schedule_id, attendance_date)`

when `batch_schedule_id IS NOT NULL`.

This allows a player to have attendance for multiple distinct sessions on the
same date while preventing duplicate attendance for the same session.

No existing attendance data was changed.

## Verification performed

Transactional database tests verified:

- valid schedule creation
- academy mismatch rejection
- invalid time rejection
- invalid weekday rejection
- duplicate schedule rejection
- valid player enrollment
- same-batch multiple-session enrollment
- overlapping player session rejection
- duplicate player enrollment rejection
- valid coach assignment
- back-to-back coach sessions
- overlapping coach session rejection
- duplicate coach assignment rejection
- schedule-change overlap rejection
- schedule-aware attendance creation
- wrong weekday attendance rejection
- duplicate schedule-aware attendance rejection
- Academy Owner RLS workflow
- Super Admin attendance-insert denial
- RLS enabled on all three new tables

All test records were rolled back.

Final live counts:

- `batch_schedules`: 0
- `player_batch_schedules`: 0
- `coach_batch_schedule_assignments`: 0
- schedule-aware attendance: 0
- total attendance: 118

## Repository / migration note

The branch `payment-module-finalization` currently contains the existing Coach
Profile commit only. The branch is one commit ahead of its previous parent and
has no database migration files yet.

The next repository-level database task is to establish a proper
`supabase/migrations` structure and convert this live change record into
ordered, deployable migrations after reconciling it with the actual Supabase
migration history.

Do not run a newly created migration against the current live database until
its migration-history reconciliation has been completed.
