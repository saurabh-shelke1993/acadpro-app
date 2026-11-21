# BETA-06 calendar policy proposal and regression checkpoint

Date: 21 November 2026. Status: fixed Asia/Kolkata policy approved for the initial India beta; isolated utility implementation only, no production consumer behavior change.
Branch: `beta-06-owner-preview`; reviewed HEAD: `040e15a6788425947ed1a0361d889385f26bda12`.
Scope: preserve BETA-06.3A tests and define a reviewable calendar contract. The PO has authorized BETA-06.3B2A pure utilities and tests only. Application integration, migrations, deployment, and release remain outside this checkpoint. BETA-06 remains incomplete; production remains NO-GO.

## BETA-06.3B2A approval and implementation boundary

PO decision: fixed `Asia/Kolkata` for the initial India beta; preserve UTC database timezone and timestamp storage, keep date-only calendar values unchanged, and perform no automatic historical rewriting. Academy-configurable timezones are deferred. Coach authorization requires separate review.

`utils/academyCalendar.js` adds explicit-instant local date/ISO weekday functions, strict date-only validation, separate month date/UTC instant bounds, and inclusive date ranges. It reuses the existing pure `addSubscriptionCalendarDays` validator/arithmetic without modifying subscription code. Intl uses explicit Asia/Kolkata, Gregorian calendar and Latin digits; timestamp boundaries resolve zone midnight without the machine timezone or a hardcoded offset. Instant inputs are valid Date objects, integer epoch milliseconds, or full ISO timestamps with seconds and an explicit Z/HH:MM offset (optional 1-3 fractional digits). Invalid/ambiguous inputs throw RangeError; validation returns boolean. Date-only values use supported years 0001-9999; an exclusive next-month boundary beyond 9999 throws. No implicit current clock or runtime consumer is introduced.

Only this document and the new utility/test files change. Dashboard/date calculations, attendance permissions, existing characterization tests, Auth/RBAC and database state remain untouched. Later integration must retain the separate date-only versus timestamp contracts and undergo the applicable security review. Prior sections below retain the checkpoint's historical findings and pending integration decisions; fixed-zone approval and the no-rewrite decision supersede those specific previously open questions.

## Evidence and preservation

The following files are preserved without further edits in BETA-06.3B1:

| File | Review finding | Recorded validation |
| --- | --- | --- |
| `frontend/src/pages/AttendanceHistory.test.js` | Helper waits for the final academy scope, absence of loading, and the expected row. A deferred scoped response verifies readiness cannot resolve prematurely. Existing Coach/Owner/Admin, pagination, filter, and error assertions remain. No raised timeouts, skipped tests, or weakened assertions. | 12/12 PASS, exit 0; `logs/beta-06-3a-history-remediation-results.json` |
| `frontend/src/services/dashboardService.owner.calendar.test.js` | Eight explicit instant fixtures, one process-timezone assertion, and one financial/attendance/grouping parity case. Each case resets fixtures and fake time; real timers are restored afterward. External reads are mocked. | UTC 10/10 and Asia/Kolkata 10/10 PASS, exit 0; `logs/beta-06-3a-calendar-remediation-{utc,kolkata}.json` |

The files predate their passing result artifacts and have not changed since those runs. No tests or build were repeated for this documentation-only checkpoint. Previous build: exit 0, `logs/beta-06-3a-build-exit.txt` and `logs/beta-06-3a-build.log`.

History synchronization source SHA-256: `c2984bbf0ac9df3717d3c5f3d18c8931eb84a03ee224feb2a30dfec63f8f7724`.
Calendar source SHA-256: `9e6638493bcd189b16fa0f4abcde64f7656d50db7d2ad3d945dc9ea304ef5672`.

Limitations: calendar assertions characterize current behavior, including defects; PASS does not approve that behavior. Query mocks return fixture rows without executing predicates, so expense checks prove generated bounds, not live row inclusion. Analytics trends are mocked. The calendar suite intentionally requires explicit `TZ=UTC` or `TZ=Asia/Kolkata` in separate Node processes; it is not a timezone-neutral default-suite test. Document these invocations in future CI integration rather than silently falling back to the host zone.

The earlier broad UTC run remains 197 PASS / 5 FAIL, exit 1. An isolated History run reproduced the initial-response/final-scope race (10/11, exit 1); after correction all 12 passed. Three original missing-row/heading failures are consistent with that race. The original History filter/reset timeout remains unproven. BetaTracker passed unchanged in isolation (8/8, exit 0); its prior timeout cause remains unresolved. Concurrent timezone execution is a possible scheduling contributor, not an established cause. Original logs are retained; these results do not constitute a full regression pass.

## Verified database contract

Supabase project `ulyealhkmlorsbdiknrh` was inspected using SELECT-only catalog queries on 21 November 2026. No row data or database state was changed. The inspected session timezone is UTC, consistent with the supplied database evidence; this is not proof that every possible client session uses the same setting.

| Column | Live SQL type | Meaning under proposed policy |
| --- | --- | --- |
| `attendance.attendance_date` | `date` | Academy-local occurrence date, without time/offset |
| `expenses.expense_date` | `date` | Academy-local business date |
| `payment_dues.due_date` | `date` | Academy-local scheduled billing date |
| `payments.payment_date` | `timestamptz` | Absolute instant; stored/transported as UTC for application consistency |
| `inquiries.created_at` | `timestamptz` | Absolute creation instant; grouped by academy-local month |

PostgreSQL timestamps with time zone represent instants; display timezone is separate. No column type conversion or global database/session timezone change is proposed. Existing date-only records must not be shifted by 5 hours 30 minutes. Timestamp records must not be rewritten to represent local wall time.

## Exact current behavior

| Concern | Current source expression/behavior | Consequence |
| --- | --- | --- |
| Dashboard attendance day | `dashboardService.js:26`: `new Date().toISOString().split("T")[0]` | UTC day; during 00:00-05:29:59 IST this is the previous local date. Owner marking defaults/max/save guards also use UTC. |
| Last seven attendance dates | `dashboardService.js:37`: local `setDate`, then UTC ISO slicing | Date range is built using mixed local arithmetic and UTC output; tests use zones without DST and do not characterize DST zones. |
| Today's scheduled sessions | `dashboardService.js:890`: local `getDay()`, Sunday mapped to 7 | May choose the IST weekday while checking recorded marks for yesterday's UTC date. Device timezone can change results. |
| Coach marking | `CoachAttendance.js:24`: local date default; future-date checks and edit eligibility use `utcAttendanceToday()` | Local default can exceed the UTC maximum in early IST hours. |
| Coach existing-record editing | `attendanceEditWindow.js`: inclusive UTC today minus six dates through today | Matches current UTC RLS; seven calendar dates, not 168 elapsed hours. Older unrecorded inserts have separate rules. |
| Monthly dues | `dashboardService.js:950-956`: local month bounds and date-only input parsed at local midnight | Follows device month; no intrinsic UTC shift for a `due_date`, but changes month at different instants on different devices. |
| Monthly collections | `dashboardService.js:976-986`: payment instants compared with local month-start instants | Correct only when the device timezone equals the intended business timezone. Preserve all existing financial formulas. |
| Monthly expenses | `dashboardService.js:739-740`: local first-of-month converted with `toISOString().slice(0,10)` | Kolkata shifts both date-only bounds back one day: includes prior-month last date and excludes current-month last date. |
| Monthly enquiries | `dashboardService.js:743-744`: local month-start timestamps converted to ISO | Correct instant window for the device's month/zone, but device-dependent. |
| Financial presentation | Preview adapter forwards service financial values; attendance summary uses present/marked weighted counts | No calendar policy belongs in the presentation adapter. Preserve amounts, uncapped collection rate, zero/unavailable distinction, and stable center IDs. |

Examples: at `2024-02-29T18:30:00Z` it is 1 March 00:00 IST. Dashboard attendance day is 29 February, local sessions use Friday (ISO weekday 5), and local billing month is March. March expense bounds become `>= 2024-02-29` and `< 2024-03-31`, instead of `>= 2024-03-01` and `< 2024-04-01`. At `2024-12-31T18:30:00Z`, IST has entered 1 January 2025 while UTC remains in December 2024. February's Kolkata expense bounds are `>= 2024-01-31` and `< 2024-02-29`, excluding leap day.

## Proposed contract, subject to approval

1. Use explicit `Asia/Kolkata` as the initial academy business timezone, independent of browser, process, and database session timezone. Decide whether this is a fixed India-only product policy or a future per-academy setting before implementation; do not invent a new schema field now.
2. Derive one business calendar date from a captured instant and use it consistently for attendance day, ISO weekday (Monday 1 through Sunday 7), schedule occurrences, date defaults, and month selection. Re-evaluate at midnight and before mutations; an open page must not retain yesterday's permission decision.
3. Validate date-only values as real `YYYY-MM-DD` calendar dates. Compare date-only columns to date-only bounds. A month is `[YYYY-MM-01, next-month-01)`; never convert local midnight to UTC and slice it for these columns. Calendar arithmetic must handle leap years and rollover without elapsed-hour assumptions.
4. For timestamp columns, calculate the two academy-local month-start instants, convert them to UTC, and query/aggregate with `>= start` and `< nextStart`. March 2024 in Kolkata is `[2024-02-29T18:30:00Z, 2024-03-31T18:30:00Z)`. Display instants explicitly in the business timezone; do not use UTC substrings as local history dates.
5. Keep UTC timestamp storage/transport and existing SQL types. Do not reinterpret historical date-only values automatically. Establish historical provenance before any backfill is considered.
6. Move attendance authorization dates to IST only through an explicitly approved, coordinated frontend/security change. Until that occurs, retain the UTC UI and RLS edit contract; do not partially switch Owner/Coach marking to IST while Coach RLS rejects that date.
7. If approved, Coach updates use inclusive business today minus six dates through today. Coach access/insert future-date checks use the same business today. Preserve tenant, assigned-session, active schedule, ISO weekday, immutable-field, and non-deleted predicates. Preserve the separate historical unrecorded-insert policy; do not introduce a seven-date insertion cutoff accidentally.
8. Preserve all role boundaries: Owner operates within their academy; Coach within authorized assignments; Super Admin retains History/update/delete capabilities but is not granted attendance INSERT by this proposal. Parents and unrelated academies gain no new rights. Database enforcement remains authoritative.
9. Preserve billing formulas: capped paid amounts per due, outstanding across returned periods, unique players versus memberships, and uncapped monthly collection rate. Calendar inclusion changes may alter monthly totals; that requires product acceptance, not a formula rewrite.

## Affected frontend and regression matrix

Paths below are relative to `frontend/src`. These are identified calendar consumers and review dependencies, not an instruction to edit every file. Perform a fresh dependency scan at implementation time.

| Files | Required review/correction | Authorization or validation dependency |
| --- | --- | --- |
| `services/dashboardService.js` | UTC day/local weekday mixture; date ranges; due, collection, expense and enquiry windows; shared generic/Coach/Super Admin helpers | Avoid changing non-Owner dashboards unintentionally; scope comparisons and role tests |
| `services/analyticsService.js`, `services/coachAnalyticsService.js` | Trend date buckets, month boundaries, local today used in assignment/month statistics | Keep trends and summary totals on the same calendar |
| `pages/Attendance.js`, `pages/CoachAttendance.js` | Defaults, future maximum, save-time checks, schedule/date agreement | Coordinated Coach RLS approval required |
| `utils/attendanceEditWindow.js`, `pages/AttendanceHistory.js` | Shared edit eligibility, revalidation, date display; preserve server pagination | Owner/Coach/Admin boundary tests; History synchronization fix remains |
| `services/scheduleViewService.js` | UTC default today, date-derived weekday, local current time, upcoming occurrence dates | Schedule assignment scope and selected date must agree |
| `services/batchScheduleService.js`, `services/coachScheduleAssignmentService.js`, `services/playerScheduleService.js` | ISO weekday/assignment/enrollment date contract review; retain date-only occurrence arithmetic where already correct | No assignment or enrollment permission expansion |
| `pages/Expenses.js`, `services/expensesService.js` | Local defaults/month totals versus dashboard; existing from/to filters already accept date-only values | Preserve selected date strings and tenant filters |
| `pages/PaymentDues.js` | Due-date comparisons/display and ageing reference date | No due amount/status formula changes |
| `pages/PaymentCollections.js` | UTC substring history filtering versus local display; explicit timestamp date windows | Preserve write/RPC and finance authorization semantics |
| `pages/Enquiries.js`, `services/enquiriesService.js` | Timestamp created-date display currently slices the date prefix; DOB/trial/joining defaults and validation need explicit calendar review | Separate date-only fields from created timestamps; preserve conversion rules |
| `components/Dashboard/AcademyOwnerDashboard.js`, `components/Dashboard/AcademyOwnerDashboardPreview.js`, `components/Dashboard/academyOwnerPreviewAdapter.js`, `pages/Dashboard.js` | Parity consumers; pass through corrected service values without duplicate date logic | Preview remains default-off and Owner-only |
| Existing `*.test.js` for the files above, plus `services/dashboardService.owner.calendar.test.js`, `pages/AttendanceHistory.test.js`, `pages/AttendanceWorkspace.test.js`, `routes/AcademyOwnerPreview.access.test.js`, `utils/attendanceEditWindow.test.js` | Preserve characterization evidence; add separate approved-policy assertions; timezone and role tests | UI mocks alone do not prove live RLS parity |

## Live RLS/function dependency matrix

Names and policy bindings below were confirmed by read-only `pg_proc`/`pg_policies` inspection. Live definitions must be captured and compared again before an eventual migration; repository history does not fully represent all live helpers.

| Live object | Current contract | Future action/approval |
| --- | --- | --- |
| `private.can_coach_access_attendance(uuid, uuid, uuid, date)` | Coach role, same academy, date `<= CURRENT_DATE`; active assigned schedule/end-date checks and ISO weekday; legacy batch fallback | Security approval to change business-today expression; affects both SELECT and INSERT visibility |
| `private.can_coach_update_attendance_schedule(...)` | Row identity/immutable fields, non-deleted record, inclusive `CURRENT_DATE - 6`..`CURRENT_DATE`; delegates to access helper | Coordinated security change to both date checks; preserve USING/WITH CHECK semantics |
| `private.can_coach_update_attendance(...)` | Older helper also uses UTC seven-date window and batch scope | Audit callers/dependencies; not directly referenced by current attendance policies. Do not leave inconsistent callable behavior if still used |
| `private.validate_attendance_batch_schedule()` | Trigger checks academy/batch/center/player identity, active inserts, and `EXTRACT(ISODOW FROM NEW.attendance_date)` | Preserve checks; date-only ISO weekday should remain independent of timezone |
| `private.can_manage_attendance(uuid, uuid)` | Role/academy/batch scope; no calendar expression | Dependency review only; no calendar edit indicated |
| `attendance_select`, `attendance_insert` | Both call access helper for Coach; INSERT Owner branch is same-academy and has no equivalent future-date condition | Access-helper change changes Coach visibility and insertion acceptance. PO/security must decide whether Owner server-side future-date parity is desired; do not silently add it |
| `attendance_update` | Both USING and WITH CHECK invoke schedule update helper for Coach; Owner/Admin branches remain separate | Preserve both enforcement sides and row immutability |
| `attendance_delete` | Owner within academy or Super Admin; no Coach allowance | No calendar change; preserve denial for Coach |

Role/tenant dependencies (`private.current_user_role`, `private.current_academy_id`, `private.is_academy_owner`, `private.is_super_admin`, `private.is_coach_assigned_to_batch`, and the parent-player SELECT branch) are preservation requirements, not proposed calendar rewrites. Review function privileges, security-definer configuration, search paths and dependent callers when preparing any approved change.

Required approvals: PO calendar semantics and historical reporting expectations; architecture review of shared helpers and rollout sequencing; database/security review of access/update helpers and policy dependencies; approved migration and rollback plan for any future function replacement. A fixed-zone frontend-only financial correction need not change SQL column types, but its totals still need acceptance. A future per-academy timezone column would need separate schema authorization. Global database timezone changes and historical data rewrites are excluded.

## Characterization and future acceptance fixtures

| Fixture instant/date | Current characterization / future acceptance requirement |
| --- | --- |
| `2024-02-28T18:29:59Z` / `18:30:00Z` | IST switches 28 to leap day 29; UTC remains 28. Verify date, weekday, marks and default/max agreement |
| `2024-02-29T18:30:00Z` | IST 1 March, UTC leap day; current session weekday 5 versus UTC date weekday 4. Proposed date/weekday/mark association must agree |
| `2024-03-01T00:00:00Z` | Both calendars 1 March; UTC midnight must not advance IST a second time |
| `2024-12-31T18:29:59Z` / `18:30:00Z` | IST crosses to 1 January 2025 while UTC remains 31 December; verify month and year together |
| `2025-01-01T00:00:00Z` | Both calendars 1 January; include year rollover billing bounds |
| `2024-03-02T18:30:00Z` | IST Sunday must map to 7; UTC Saturday remains 6 |
| February/March expense dates | Proposed February includes 29 February, excludes 31 January and 1 March; proposed March includes 31 March, excludes 29 February and 1 April. Test real predicate filtering in later validation |
| Timestamp boundaries | Include exact local month-start UTC instant; exclude exact next-month-start; test one instant before each bound for payments and enquiries |
| At `2024-02-29T18:30:00Z` Coach edit cutoffs | Current UTC window 23-29 February; proposed IST window 24 February-1 March. Verify both endpoints, one date outside each side, and same frontend/server decision |
| Assigned Coach, unassigned Coach, Owner, Super Admin, Parent, other academy | Positive and negative SELECT/INSERT/UPDATE/DELETE cases as appropriate; preserve role-specific rights, same date/weekday, seven-date edits, historical unrecorded inserts, and schedule immutability |
| Page held open across IST midnight | Refresh date-derived summaries and revalidate before saving; no stale enabled action that the authoritative policy denies |

The existing calendar suite covers the eight listed instants, process offset, generated expense bounds, local monthly dues/collections and service-to-adapter parity. It does not yet execute these proposed authorization, enquiry timestamp-edge, live expense filtering or page-midnight cases. Existing financial and role tests are supporting evidence, not substitutes for future server-policy tests.

## Risks, decisions and checkpoint recommendation

Resolved PO decisions: fixed Asia/Kolkata for the initial India beta; configurable zones deferred; UTC database/time storage retained; no automatic historical rewriting. Remaining decisions: approve integration scope across dashboards; approve IST Coach access/edit windows versus retaining UTC as a documented exception; define Owner server-side future-date policy; accept changed monthly inclusion totals; decide how to explain historical UTC-dated attendance.

Risks: frontend/server date disagreement can hide or reject valid Coach actions; access-helper changes affect reads as well as writes; a global timezone switch would alter unrelated CURRENT_DATE consumers; shared dashboard helper changes can affect other roles; date-only historical provenance is ambiguous; independent client clocks can disagree at midnight. No browser test or mocked-I/O pass removes these risks.

BETA-06.3B1 three-file checkpoint was preserved in commit `a2061ea1b6d70cf3b915fea6bdf9bd3045e63821`. BETA-06.3B2A is limited to the isolated utility, its tests, and this approval/boundary update; no commit or push is authorized here. Runtime calendar integration and Coach authorization remain separate steps requiring their applicable reviews.
