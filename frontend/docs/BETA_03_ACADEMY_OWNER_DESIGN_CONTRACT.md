# BETA-03 — Approved Academy Owner Dashboard Design Contract

**Product:** Kheltriva (football academy SaaS)  
**Decision:** APPROVED by Product Owner on **21 November 2026 (IST)**  
**Design:** UI-C2.10 **Pitchside Emerald**  
**Approved development baseline:** `payment-module-finalization` @ `62e54bef15aafffe0810b9c64e8ce1ed81d5b250`  
**Beta integration branch:** `beta-launch-integration`  
**Design reference branch/commit:** `ui-c2-5-owner-dashboard-validation` @ `3756914ca6624bb07839b6aca81ecb1dcb9da065`  
**Implementation status:** Design standard approved; dashboard integration **NOT IMPLEMENTED on the beta baseline**. Integrate only during BETA-06 after BETA-05.  
**Production:** NO-GO, no release date, no deployment authorization.

## Decision boundary

The Product Owner expressly approved the Pitchside Emerald design contract, including the four implementation corrections in Section 4, as the **final Academy Owner dashboard design standard for BETA-03**. This is an approval of visual layout, presentation semantics and implementation requirements, **not** approval to merge the entire UI branch, replace `/dashboard`, change shared/global branding, alter Supabase, or deploy to production. The original `/dashboard`, Super Admin, Coach and Parent experiences remain unchanged at this checkpoint.

## 1. Visual tokens — Academy Owner dashboard scope only

| Token | Hex | Intended role |
| --- | --- | --- |
| Deep forest | `#0C2629` | Premium dashboard header |
| Emerald primary | `#087C6E` | Navigation/actions/attendance highlights |
| Emerald hover | `#06685D` | Hover states |
| Lime highlight | `#C5EC85` | Restrained accents on dark surfaces |
| Dashboard canvas | `#F2F8F5` | Main background |
| Card surface | `#FFFFFF` | Operational cards |
| Soft emerald | `#E7F7F2` | Soft selection/inset states |
| Border | `#CFE6DC` | Panel divisions |
| Primary text | `#153F3A` | Main readable text |
| Muted text | `#536F69` | Supporting text |

Chart categories: `#087C6E`, `#A6C96A`, `#CE9B55`, `#4F8C86`, `#947BA6`. These colors represent categories, **not** academy performance rankings. Preserve amber outstanding and unmarked-status cues. Implement with scoped styles, retaining academy-specific logos and the existing shared sidebar/global tokens. No new font dependency: Inter when available, Segoe UI/system fallback.

## 2. Approved hierarchy and responsive behavior

- **Header:** Compact forest header identifying academy, with linked total Players, Centers and Batches. Centered main content, maximum width around 1550px.
- **Desktop top:** Approximately **70% Players Overview / 30% Today's Sessions**, with a practical ~300px minimum for the sessions column. No fixed-height cards.
- **Middle:** Full-width **Weekly Attendance** by batch using horizontal segmented rows, grouped by center.
- **Desktop bottom:** Approximately **70% Financial Snapshot / 30% Enquiries**.
- **Mobile/tablet:** Stack both paired sections, with **Today's Sessions before Players Overview** visually; keep keyboard/screen-reader reading order coherent. No page-level horizontal overflow.
- **Source-preview breakpoints for BETA-06 review:** paired sections stack at ≤1190px; header totals stack at ≤800px; overview internals/attendance rows simplify at ≤650px; chart/icon treatment becomes compact at ≤380px; CSS page padding reduces at ≤700px. These are preview references; actual device behavior is an implementation acceptance check.
- **Typography/panels:** Body ~14px/1.48; title 25–31px, section headings ~18–19px; panel padding ~16–17px, section spacing ~14px, panel radius ~14px. Use tabular numerals for counts/money and ensure readable caption contrast.
- Verify desktop/tablet/mobile widths **1440, 1024, 768, 390, 360, 320px**, 200% zoom, focus visibility, reduced motion, semantic headings, chart equivalents, and ~44px primary touch targets.

## 3. Data and interaction contract — preserve existing source of truth

**Players:** Main Players count is unique active academy players, not the sum of center memberships. The donut shows player-center memberships (which may exceed distinct players). Center selection uses stable IDs and presents associated batch/age-group counts. Include zero-player centers and zero-player batches. Navigate through authorized academy/center scoped routes; query-string IDs are filters, **not authorization**.

**Today's Sessions:** Display all scheduled sessions grouped by center, ordered by start time within groups. Show batch, start/end time and direct attendance navigation; differentiate no scheduled sessions from unavailable data. A recorded badge means at least one mark exists **for that batch/date** and does not imply full roster or per-schedule completion.

**Weekly Attendance:** Show segmented horizontal rows and textual present/recorded fractions. Percentage is `round(100 * present / (present + absent))` from actual marked statuses over the **rolling seven-day window**, excluding soft-deleted records. Whole-academy rate is weighted by all marks, not the arithmetic mean of batch percentages. Distinguish **No marks** (unknown) from recorded **0%**. Filtering the visible center/batch rows must not recalculate the academy-wide summary. Show batches-with-marks count independently.

**Financial Snapshot:** Keep the existing `dashboardService.js` calculations and tenant scope. Four prominent tiles: Collected this month; Current outstanding; Billed this month; Expenses this month. Keep pending/partial/paid counts and the collection-rate label. Billed this month uses current-month due dates, collected uses current-month recorded payment dates; outstanding covers returned dues across periods with capped paid amounts. Collection rate = monthly collections / monthly dues billed, rounded; may exceed 100% and must **not be capped**. Where the denominator is zero, render **N/A** (presentation only) without changing service calculations. Do not misrepresent missing finance data as ₹0.

**Enquiries:** Existing `inquiries` source, counts received in the current month, grouped by center, descending count with name tie-break, top four and View all; use the label **Received this month**, not “New” as though it were a status. Preserve link filtering and Academy Owner scope.

**Loading/empty/error:** Distinguish genuine zero from missing/unavailable data, and provide coherent loading/error announcements. Current data retrieval is page-level; component empty states are not evidence of independent panel fetching. Retry controls or independent fetches are potential BETA-06 scoped improvements and require tests.

## 4. Four required corrections — mandatory BETA-06 acceptance gates

1. **Attendance navigation:** UI-C2.10's `academyOwnerC25Adapter.attendancePath` omits `view=mark`. Preserve the established canonical `/attendance?view=mark&centerId=…&batchId=…` behavior and verify actual navigation; do not assume alternative URLs are equivalent.
2. **Stable center grouping:** Preview weekly attendance groups by `centerName` and may collapse different centers sharing a name. Group by verified stable `centerId`; add/pass that ID in a minimally scoped data contract if missing. Maintain readable center names as labels. Validate duplicate-name fixture and tenant-scope behavior.
3. **Accurate attendance labels:** `attendanceRecorded` is currently a **batch-and-date mark-exists** indicator, not per-schedule or full-roster completion. State “Marks recorded for this batch today” or an equally accurate concise label; avoid “session complete” or equivalent unsupported claims.
4. **Date-boundary consistency:** The current service combines UTC ISO dates with browser-local weekdays/month boundaries. Investigate and test midnight, month boundaries and IST expectations before considering date corrections; do not silently redefine financial or attendance totals during design integration.

These corrections are required for **implementation acceptance**, not evidence that they have already been fixed. Existing role, RLS and multi-tenant safeguards remain authoritative.

## 5. Work split and release gates

| Milestone | Scope | State |
| --- | --- | --- |
| **BETA-03** | Review and Product Owner approval of this visual/semantic/accessibility contract | **Approved (2026-11-21)** |
| **BETA-04** | Freeze beta feature inclusions, exclusions and pilot acceptance criteria | In progress; scope not yet approved |
| **BETA-05** | Integration workspace and tracker foundation | Planned |
| **BETA-06** | Implement selected Academy Owner design safely, verify parity and four corrections | Planned, **not yet merged** |
| **BETA-11/12** | Wider responsive/regression/security acceptance | Planned |
| **BETA-17** | End-to-end release acceptance; separate production GO authorization | Planned, **NO-GO currently** |

For BETA-06, review `AcademyOwnerDashboard.js`, the C25 adapter/C27 composition/C30 CSS and existing route wiring; implement selectively in isolated beta components/CSS and tests. Preserve `dashboardService.js`, permissions, Auth/RLS, data scope, layout/global sidebar, payment RPCs and database objects unless a separately reviewed and authorized change is needed. Keep `/dashboard` unchanged during any preview development. Test real Academy Owner tenants, zero-data, active links, responsive widths, role denial and financial/attendance metric parity before proposing promotion.

**Explicitly tracked issues, not BETA-03 fixes:** possible pagination/completeness in large academy queries, Enquiries Analytics using Asia/Kolkata month boundaries versus browser-local dashboard periods, attendance grouping and date effects, and ROLE_MATRIX.md's outdated “unused inquiries” description. Do not silently repair these in a visual scope.

## References and verification provenance

- UI preview contract: `frontend/docs/UI_C2_DESIGN_PAUSE_HANDOFF.md` and `frontend/docs/UI_C2_10_PITCHSIDE_EMERALD.md` at UI branch SHA `3756914ca6624bb07839b6aca81ecb1dcb9da065`.
- UI source: `AcademyOwnerDashboardC27.js`, `AcademyOwnerDashboardC30.css`, `academyOwnerC25Adapter.js` on that UI branch.
- Approved beta baseline current view: `frontend/src/components/Dashboard/AcademyOwnerDashboard.js`, `frontend/src/services/dashboardService.js`, `frontend/src/routes/AppRoutes.js`, and `frontend/docs/ROLE_MATRIX.md` on the integration branch.
- Codex BETA-03.1 source inspection reported six focused Jest suites / **65 tests PASS**, React production build PASS and clean Git status at `136ca880`. This validates the integration tracker/baseline tests, **not** the future design integration or actual authenticated Owner browser tests.
- Historical UI preview report recorded **56 focused tests PASS** and React build PASS on the older UI branch, with known unresolved full-suite regressions. These are historical preview results only.

No production release date approved. No database, dashboard UI, global design token, auth/RBAC, branch merge or Vercel production change was authorized by the BETA-03 decision.
