# UI-C2.8 — Premium Football Dashboard Readability & Palette Experiment

**Project:** Kheltriva — football-only academy management SaaS
**Branch:** `ui-c2-5-owner-dashboard-validation`
**Preview route:** `/ui-c2-7-preview` (Academy Owner only)
**Code commit:** `041150905bfb3bced544e0d498bfbf2d9e5458b2`
**Status:** Preview implementation / focused tests and real build passed; browser/role acceptance and production approval pending.

## Scope and preserved contracts

UI-C2.8 refines the **existing C2.7** design; no redesign of the 70/30 desktop layout or the mobile ordering.

- Typography: apply a scoped system/Inter-if-installed font stack, more readable section titles, labels, session details, card figures, and captions. No remote font fetches or dependencies.
- Weekly attendance: compact segmented strip (ten cells) per batch, with an explicit present/recorded count and percentage. Absence of marks is represented as "No marks"/"Not recorded" rather than 0%; no change to `recordedMarkSummary`.
- Football-specific workflow: show the number of today's scheduled sessions lacking attendance marks, and a direct link to the existing attendance workspace. Status means **at least one mark exists**, not that every player was marked.
- Color palette: a **dashboard-only**, non-persistent picker with three named themes. Changing the picker changes CSS variables inside the preview component; it does not modify global CSS, the sidebar, any other role, or the saved academy branding.
- Existing source, role scope and navigation unchanged: `getAcademyOwnerDashboardData`, C25 adapter, `ProtectedRoute`, center/batch attendance deep links, financial amounts, enquiry links and `/dashboard`.
- Neither Supabase nor Vercel production app settings were modified. No migrations, RLS changes, package installations or build-tool migration.

## Trial palette specifications

| Palette | Dark / identity | Primary action | Accent | Comment |
|---|---|---|---|---|
| Classic Blue | `#0B1F3A` | `#1D4ED8` | `#C4F047` | Strongest continuity with existing Kheltriva branding |
| Pitchside Emerald | `#0C2629` | `#087C6E` | `#C5EC85` | Football-specific, distinctive green/teal identity |
| Floodlight Indigo | `#171E39` | `#4338CA` | `#E2ED89` | Premium sports-tech style with restrained lime |

Selected primary/action text colors against each palette's corresponding soft background have sample contrast ratios: Classic **6.06:1**, Pitchside **4.61:1**, Floodlight **6.93:1**. This is a limited spot check, **not** a whole-interface WCAG audit.

The persistent sidebar, academy-specific logo and chart center-category colors are intentionally unchanged while trying palette choices.

## Automated verification — exact code commit

**Actions run:** https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41798844256

- `npm ci`: **PASS**
- Focused C27, C25 and ProtectedRoute checks: **3 suites / 41 tests PASS**
- Actual Create React App production build: **PASS** (`Compiled successfully`)
- Complete existing Jest suite: **FAIL** — 4 failed / 25 passed suites, 16 failed / 193 passed tests (209 total). The same four non-preview suites were already failing before this phase: CoachPerformanceAssessments, CoachProfile, PlayerPerformanceReport, PerformanceWorkspaceTabs. These remain unresolved and should be addressed in a separate workstream.
- Vercel preview deployment for code commit: **SUCCESS** — https://vercel.com/saurabh-shelke-s-projects/acadpro-app/83dMThkx2BeKM7Ydf5Kf8xRorrPM

**Manual acceptance still required:** Academy Owner desktop/mobile visual QA; palette comparisons; actual attendance counts and navigation; keyboard/focus/contrast; direct Super Admin, Coach and Parent route-denial checks; second Owner cross-academy isolation. Do not treat automated tests as authenticated browser acceptance.

## Acceptance guidance

1. On a **Preview** deployment, authenticate as Academy Owner and visit `/ui-c2-7-preview`.
2. Toggle Classic Blue / Pitchside Emerald / Floodlight Indigo; compare same screen with same data. Verify that the sidebar and other pages remain unchanged.
3. Check 1440px, 1024px, 768px, 390px, 360px, and 320px widths. Confirm no horizontal overflow and readable labels.
4. Compare present/recorded mark counts, rates, "no marks" rows, and today's session labels with `/dashboard`.
5. Test Player, Attendance, Financial and Enquiry links, role-protected route boundaries, keyboard navigation and focus visibility.
6. Record feedback and approve one palette before any shared/global design-system work.

**Release decision:** No merge, global theme rollout, or production activation is authorized in UI-C2.8.
