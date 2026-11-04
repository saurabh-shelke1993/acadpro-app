# Kheltriva — Academy Owner Dashboard Design Pause & Restart Handoff

**Recorded:** 4 November 2026 (Asia/Kolkata)  
**Status:** **DESIGN WORK PAUSED BY PRODUCT OWNER**; implementation retained as a non-production Preview, not approved for merging or application-wide rollout.  
**Reason:** Architectural development in `payment-module-finalization` takes priority. Do not restart the dashboard redesign until the Product Owner explicitly requests it.  
**Repository:** https://github.com/saurabh-shelke1993/acadpro-app  
**UI validation branch:** `ui-c2-5-owner-dashboard-validation`  
**Branch HEAD before this documentation checkpoint:** `44ce68ef30e95bc6b8d6780a5247f35ec94cece2` (documentation-only commit)  
**Latest tested code-bearing commit:** `b7a761e320f18a37e6f10b337ebd1257b5740b7a`  
**Payment work branch at checkpoint:** `payment-module-finalization` @ `d8063c08dbb3681e2e6c172d80d5a368b1fb7b20` (read only; verify its latest HEAD when resuming).  
**Primary restart Preview path:** `/ui-c2-10-pitchside` on the branch's Vercel Preview deployment.  
**GitHub Vercel deployment for HEAD at checkpoint:** https://vercel.com/saurabh-shelke-s-projects/acadpro-app/2tP2DipNZPQjME3LQ2x7PE3Vv13f (successful Preview, not production).

> **Branch caveat:** This handoff's SHA is a snapshot. Its own documentation commit advances the UI branch afterward. Always refetch the latest branch head and verify its relationship to the payment branch.

## 1. Product goal and decisions

Kheltriva is a **football-only** SaaS for football academies. The goal is a **premium football identity with exceptionally simple day-to-day workflows** for Academy Owners, Coaches and Parents. Sportzy/SpynPro comparisons motivated the visual direction, but our designs are not a verified one-to-one competitor dashboard copy.

**Product Owner decisions at pause:**

- Preserve the established **70% Players Overview / 30% Today's Sessions** and **70% Finances / 30% Enquiries** desktop sections, with mobile training-session priority.
- Prioritize compact information hierarchy, readable typography, attendance clarity, genuine football operational utility, and simple navigation.
- **Pitchside Emerald is the preferred / selected Academy Owner visual direction**; this does **not** authorize replacement of the production dashboard, global tokens, shared sidebar, or other role screens.
- **Pause UI work** while payment-module architectural development proceeds.

## 2. Progress chronology and deployment routes

| Phase | Work | Status |
|---|---|---|
| UI-C2.2–C2.4 | Design comparison and progressively refined prototypes | Earlier design exploration; not merged into production. Refer to prior review packages/chat for offline screenshots and artifacts. |
| UI-C2.5 | Isolated React/CRA-compatible Academy Owner data adapter and protected Preview | Implemented and verified in branch; browser acceptance incomplete. `/ui-c2-5-preview` |
| UI-C2.6 A–D | Compact header, all training sessions, grouped attendance, clearer finances | Implemented and automated checks previously passed; `/ui-c2-5-preview` evolved without changing `/dashboard` |
| UI-C2.7 A–D | Premium football-focused layout, centered workspace, selectable centers, attendance filter and finance hierarchy | Implemented and tested; `/ui-c2-7-preview` |
| UI-C2.8 | Readability, segmented attendance with present/recorded counts, three palette options: Classic Blue, Pitchside Emerald, Floodlight Indigo | Implemented and tested; `/ui-c2-7-preview` |
| UI-C2.9 | Five materially different dashboard themes: Stadium Scarlet, Heritage Maroon, Terracotta & Sand, Amethyst & Blush, Onyx & Gold | Implemented and tested; `/ui-c2-9-palettes` |
| **UI-C2.10** | **Selected Pitchside Emerald**: fixed theme, forest-green header, emerald metrics/legends and lime accent | **Implemented; focused-test/build verified; authenticated product acceptance pending**; `/ui-c2-10-pitchside` |
| Future UI adoption | Shared sidebar, Coach, Parent, Super Admin and remaining module styling | **Not started / not authorized** |

The existing `/dashboard` remains the current working route and was not replaced by any of these previews.

## 3. Pitchside Emerald design specification

| Token / role | Hex | Notes |
|---|---|---|
| Deep forest | `#0C2629` | Dark premium header |
| Emerald primary | `#087C6E` | Navigation actions, highlights, attendance visualizations |
| Lime accent | `#C5EC85` | Restrained football highlight, not general body text |
| Dashboard canvas | `#F2F8F5` | Light, low-noise background |
| Surface | `#FFFFFF` | Content cards |
| Soft emerald | `#E7F7F2` | Selected state / inset panel |
| Main text | `#153F3A` | Content |
| Muted text | `#536F69` | Supporting content |

Center-chart colors in the selected route: `#087C6E`, `#A6C96A`, `#CE9B55`, `#4F8C86`, `#947BA6`. They are *display colors*; no center data or academy-specific branding is changed. Do not treat the above as global CSS tokens until shared design-system changes are independently approved.

## 4. Architecture and affected files

**No migrations, DB schema/RPC changes, payment rule changes, RLS changes, dependency installations, CRA→Vite migration or global CSS changes were introduced for the dashboard previews.**

Core code:

- `frontend/src/components/Dashboard/AcademyOwnerDashboardC25.js` / `.css` / `.test.js`
- `frontend/src/components/Dashboard/academyOwnerC25Adapter.js`
- `frontend/src/components/Dashboard/AcademyOwnerDashboardC27.js` / `.css` / `.test.js`
- `frontend/src/components/Dashboard/AcademyOwnerDashboardC29.css` / `.test.js`
- `frontend/src/components/Dashboard/AcademyOwnerDashboardC30.css` / `.test.js`
- `frontend/src/pages/Dashboard.js` — conditional rendering for previews
- `frontend/src/routes/AppRoutes.js` — Academy Owner-only guarded routes
- `.github/workflows/ui-c2-5-owner-dashboard-validation.yml` — focused regression and production build
- `frontend/docs/UI_C2_5_OWNER_PREVIEW_VALIDATION.md` through `UI_C2_10_PITCHSIDE_EMERALD.md` — detailed history

All preview routes use the existing `ProtectedRoute allowedRoles={["academy_owner"]}`. The preview reads `getAcademyOwnerDashboardData()` through the existing dashboard route/service and C25 adapter. Frontend role guards are **not** a substitute for Supabase RLS; retest cross-academy isolation after changes to service/RLS/data scope.

## 5. Non-negotiable data and UX semantics

- **Unique players vs center memberships:** player total is not necessarily the same as the donut's center-membership count. Zero-player batches remain visible.
- **Training attendance status:** "Recorded" means one or more attendance marks exist; it does not imply every player is marked. Sessions show center, batch, time and direct attendance link.
- **Weekly attendance percentage:** calculated from *recorded present / (recorded present + absent) marks*, weighted across batches. The number of batches with marks is a different metric. **No marks is not 0% attendance.**
- **Financial dashboard:** retain recorded collections, monthly scheduled dues, expenses, outstanding and pending/partial/paid counts as supplied by the established service. Outstanding can include earlier periods. When month billing denominator is zero, collection rate is **N/A**, without changing backend calculations.
- **Tenant-scoped navigation:** preserve academy/center/batch parameters for player, attendance and enquiry links.

## 6. Test evidence and open blockers

**Exact code run:** https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41803968992 (code `b7a761e`)

- `npm ci`: **Passed**
- Focused C30/C29/C27/C25 + ProtectedRoute: **56/56 tests passed**, 5 suites
- Real Create React App production build: **Passed** (`Compiled successfully`)
- Vercel Preview: **Deployed successfully**
- Entire frontend Jest suite: **Failed, 4 of 31 suites; 16 of 224 tests failed** (208 passed), in previously failing and untouched: CoachPerformanceAssessments, CoachProfile, PlayerPerformanceReport, PerformanceWorkspaceTabs. This remains an open project regression concern, not a declared release pass.
- The current documentation-only HEAD also showed focused-test/build success and the same overall workflow failure.
- **Not tested/accepted in this pause checkpoint:** authenticated Owner mobile/desktop product acceptance across responsive widths, keyboard/focus/contrast across actual devices, denied access using Coach/Parent/Super Admin accounts, secondary Owner tenant isolation, and final metric parity after payment branch changes.

**Crucial distinction:** *source implemented* ≠ *automated checks passed* ≠ *manual acceptance* ≠ *production release*.

## 7. Resume protocol — do not start without Product Owner request

1. Finish/stabilize priority work in `payment-module-finalization`. Check that branch's latest project docs, code, database schema/migrations and recent CI status first.
2. **Before any merge:** inspect `git status`, latest HEADs and `git diff`, and compare the UI branch with the evolving payment branch. This UI branch may become stale as payment work advances. Do not reset/rebase/merge without discussing an integration approach and obtaining approval.
3. Inspect current dashboard service and data contract including payment dues/collections fields, tenant filters and RLS behavior; reconcile differences to the selected Pitchside preview without redefining financial metrics by accident.
4. Run `npm ci`, focused C30/C29/C27/C25/ProtectedRoute regression and full CRA build; run the full Jest suite and document any failures.
5. Conduct Academy Owner manual review at 1440, 1024, 768, 390, 360, 320 pixels; test real academy/center/zero-batch data and session links.
6. Conduct negative role checks (Super Admin/Coach/Parent) and cross-academy Owner isolation, including route refresh and browser console.
7. If accepted, **propose** a controlled, module-by-module expansion of Pitchside Emerald into shared design tokens/navigation and other roles. Respect academy-specific logos and existing semantic status colors. No blanket CSS replacement.
8. Treat shadcn/ui adoption as a **separate compatibility phase** (CRA/Tailwind/package check and controlled component trial). Context7 is available in ChatGPT for up-to-date docs, not for writing/installing code by itself.

## 8. Current priority and safe restart request

**Active priority:** architecture and completion work on `payment-module-finalization`; all UI-C2.x changes are **on hold**.

Suggested restart request:

> Resume Kheltriva Academy Owner dashboard UI from `frontend/docs/UI_C2_DESIGN_PAUSE_HANDOFF.md` on `ui-c2-5-owner-dashboard-validation`. First inspect latest code/docs and compare with `payment-module-finalization`; preserve RBAC/RLS, payment calculations and existing routes. Revalidate Pitchside Emerald preview before proposing any merge or shared-theme rollout.

**Release state:** No UI design branch merge to `payment-module-finalization` or `main`, no production dashboard replacement, no global palette rollout.
