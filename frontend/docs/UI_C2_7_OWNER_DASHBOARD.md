# UI-C2.7 — Premium Football Dashboard Redesign (A–D)

**Project:** Kheltriva, football-only academy management SaaS  
**Branch:** `ui-c2-5-owner-dashboard-validation`  
**Route:** `/ui-c2-7-preview` (Academy Owner only)  
**Status:** Implemented in source; runtime build/CI and Product Owner browser acceptance are separately gated.  
**Direction:** Premium football identity, exceptionally simple everyday workflows.

## Scope and implementation

### UI-C2.7A — Typography, spacing, design tokens

- Consolidated owner preview visual language with approved deep navy, royal blue, restrained lime and off-white backgrounds.
- Compact heading and 3 quick stats (Players, Centers, Batches) integrated into the header.
- Shared section headers, internal cards, focus states, responsive spacing and motion reduction; no external font or UI package, no Create React App migration.
- All new CSS scoped under `.c27-dashboard`; global/sidebar styling is explicitly unchanged.

### UI-C2.7B — Players and training

- Interactive center legend, player-center **membership** donut (distinct from unique-player total) and selected center's batch breakdown with zero-player batches preserved.
- All scheduled sessions visible, grouped by center, with a full-row attendance deep link.
- `attendanceRecorded` is reflected as `Recorded` versus `No marks`; status means at least one mark exists, **not** that every player is marked.
- 70/30 desktop overview/sessions layout, with sessions first on narrow/mobile viewports.

### UI-C2.7C — Attendance, finance, enquiries

- Replaces sparse long bars with a single compact, center-grouped attendance matrix and a functional center filter.
- Maintains weighted recorded-mark rate: `sum(presentRecords) / sum(totalRecords)`; academy total does not change when the filter changes.
- Shows batches with marks separately from recorded-mark attendance percentage and uses explicit no-data states.
- Prioritizes collections and outstanding visually, while preserving billed, expenses and pending/partial/paid status counts.
- Uses `N/A` collection rate when monthly billed dues are zero; current outstanding may include previous periods.
- Enquiries preserve center-filtered links and source-derived counts.

### UI-C2.7D — Integration test and acceptance

- Separate `/ui-c2-7-preview` route wrapped with `ProtectedRoute allowedRoles={["academy_owner"]}`.
- Keeps existing `/dashboard` and `/ui-c2-5-preview` unchanged for side-by-side comparison.
- Reuses `getAcademyOwnerDashboardData` and `academyOwnerC25Adapter`; no new Supabase client calls, RPC, migrations or RLS changes.
- Added dedicated `AcademyOwnerDashboardC27.test.js` covering role-relevant rendering, totals, center selection, empty batches, session status and deep links, attendance calculations/filtering, financial special states, enquiries and error states.
- Validation CI executes C27, C25, ProtectedRoute tests, full Jest suite and real CRA build. Existing unrelated full-suite failures must be reported, not hidden.

## Review checklist (Product Owner)

- [ ] In a **Preview** deployment, log in as Academy Owner. Compare `/dashboard`, `/ui-c2-5-preview` and `/ui-c2-7-preview` for the same academy.
- [ ] Confirm tall and narrow desktop layouts at 1440, 1280, 1024px; tablet at 768px; mobile 390, 360 and 320px. Check no unexpected horizontal scroll and easy-to-tap session actions.
- [ ] Confirm center selection, membership count vs unique players, zero-player batches and scoped links to Players.
- [ ] Confirm all sessions and correct center/batch attendance link query parameters, including upcoming/recorded statuses.
- [ ] Confirm weighted attendance vs batch coverage, center filter and no-mark states.
- [ ] Confirm billed, collected, expenses, outstanding (including past periods), due status counts and N/A collection-rate behavior.
- [ ] Verify enquiries center filtering, browser keyboard focus, console errors and loading/empty states.
- [ ] Attempt direct route access with Super Admin, Coach, Parent and a second academy account to verify role and tenant isolation.

**Release gate:** Do not merge into `payment-module-finalization` or `main` until product-owner visual acceptance and authenticated role regression have passed. Existing base full-suite failures remain a separate release blocker.
