# Kheltriva — Attendance History AM7.1–AM7.2 UX checkpoint

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**State:** AM7 History UI **implemented in source and focused CI validated**; live Owner/Coach/Admin/Parent browser, device and negative-RLS acceptance **pending**. AM7.3 server-side pagination **not started**.

## Owner decision / scope

The product owner accepted the AM6 visual direction ("we are good with AM6 changes") and requested proceeding with AM7. Implement responsive/compact Attendance History without changing stored attendance, RBAC, history mutation rules, the five-record page size or existing database access semantics.

## AM7.1 — Compact filter and records workspace

- Keep the Mark/History selection cards from AM5.
- Remove repeated tall `Attendance history` headings and `Records` eyebrow; preserve a screen-reader H1 for filter structure.
- For **Super Admin**, keep the Academy selector. For **Academy Owner/Coach**, replace the disabled academy selector with selected academy name as read-only context. Do not widen access or change the underlying filter state.
- Compact Center, Batch, Player, Status, From date and To date, and keep Reset filters. Reset availability excludes the mandatory academy scope for non-admin users.
- Display a concise `Records · count` header, date interval when selected, and existing Coach seven-calendar-date read-only explanation. Keep count and pagination tied to the filtered result set.

## AM7.2 — Mobile records that retain all details

- Desktop retains the native History table. On tablet/mobile (≤900px), CSS presents each native table row as a compact responsive record card with labelled fields, no horizontal page scrolling.
- **Do not hide columns**: Date, Player, Center, Batch, Session, Status, Marked By and Actions remain represented for each visible record. This explicitly fixes the older CSS strategy that hid Status and other details at narrower widths.
- Retain accessible native table markup, captions, cell labels and existing button names. Existing Edit, Save, Cancel, Delete and Coach Read-only controls are unchanged.
- Reuse `formatAttendanceSessionLabel` from AM6 for readable weekday + 12-hour scheduled time when the linked `batch_schedules` row exists. Keep `Legacy / batch attendance` for records without it.

## Data, security and behavior invariants

- `PAGE_SIZE = 5` remains **client-side**. Existing Supabase query and nested joins are unchanged. No additional dataset read is required by the new presentation.
- The same backend academy/center/batch/date filters and client Player/Status filters remain. Reset does not remove an Owner/Coach academy scope.
- Coach per-record editing remains restricted by `canEditAttendanceRecord(user, record)` to authorized recent UTC dates; older records display Read-only. Owner and Super Admin retain their existing authorized edit and soft-delete controls.
- Existing `updateAttendanceStatus` and `softDeleteAttendance` services, role routing/guards and live RLS remain authoritative.
- **No database migration, SQL execution, mutation of attendance data, new RLS grant, RPC or schema changes.**

## Changed files / commits

- `frontend/src/pages/AttendanceHistory.js`
- `frontend/src/pages/AttendanceHistory.css`
- `frontend/src/pages/AttendanceHistory.test.js` (four new focused AM7 tests)
- `.github/workflows/attendance-am1-validation.yml` (AM1–AM7 workflow name)
- Source commit [`226cd332`](https://github.com/saurabh-shelke1993/acadpro-app/commit/226cd3322e6f4878afc9f0452647d73f62a8fdac)
- Test correction [`c5e9f9e6`](https://github.com/saurabh-shelke1993/acadpro-app/commit/c5e9f9e63e618e334ee14bc6e07372780bdd5ed4)

## Validation evidence

GitHub Actions [AM1–AM7 run 42148002910](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42148002910), exact source SHA `c5e9f9e`:

| Validation | Executed result |
|---|---|
| Focused Jest Attendance/History/Sidebar suites | **10 / 10 PASS** |
| Focused Jest tests | **86 / 86 PASS** |
| React production build | **PASS — compiled successfully** |
| Full application Jest Phase 7.5 | **FAIL — 4 suites, 16 of 292 tests** (Coach Profile and Player Performance; track separately) |
| Live browser manual acceptance | **PENDING** |
| Multi-role negative RLS and tenant scope | **PENDING** |
| Production / deployment sign-off | **PENDING** |

## Owner acceptance checklist — not yet executed

| Case | Role/viewport | Expected result |
|---|---|---|
| AM7-01 | Academy Owner desktop | One compact filter area; academy text, no disabled academy dropdown, Center/Batch/Player/Status/From/To present |
| AM7-02 | Super Admin desktop | Academy picker still visible; selectable academies remain correctly scoped |
| AM7-03 | Coach | History displays authorized records and clear seven-UTC-date edit rule; old records are Read-only |
| AM7-04 | Phone 320/375/430px | Cards fit screen, all eight record fields readable, P/A status and actions accessible without horizontal scrolling |
| AM7-05 | Tablet 768px / desktop 1440px | Responsive layout and record list remain compact, accessible and legible |
| AM7-06 | All authorized roles | Center→Batch→Player, Status, From/To and Reset work without cross-scope stale selections |
| AM7-07 | All authorized roles | Pagination remains five records, Next/Previous and counts correct after filters |
| AM7-08 | Owner/Super Admin | Edit/Save/Cancel and confirmed soft-delete function against **controlled test records**, not real attendance |
| AM7-09 | Coach | Recent authorized edit works; older, foreign-session and cross-academy attempts rejected by RLS |
| AM7-10 | Parent / direct navigation | Attendance management is not accessible |
| AM7-11 | Role/deep-link QA | Mark↔History cards, old URLs and dashboard links still route safely; no unsaved-draft guarantee |
| AM7-12 | Live deployment | Verify actual deployed SHA, browser console, loading/empty/error states, no database writes during read-only inspection |

## Explicitly separate follow-up — AM7.3 History scale

The existing History query still retrieves all currently matching rows and slices them locally into groups of five. At higher attendance volumes, backend query limits and client memory may cause truncated or slow results. **Do not treat the visible five-record pagination as true server-side pagination.**

Before changing the data-access contract, review actual row volumes and result limits, server-side center/batch/player/status/date filters, associated player/batch/center/schedule joins, consistent row counts, role/RLS scope and pagination ordering. An AM7.3 query rewrite requires its own plan, tests and owner approval.

**Release decision:** AM7.1–AM7.2 source and focused CI complete; **not manually accepted or production release-ready**.
