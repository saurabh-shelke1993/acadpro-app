# UI-C2.10 — Selected Pitchside Emerald Dashboard Candidate

**Project:** Kheltriva (football-only academy management)
**Branch:** `ui-c2-5-owner-dashboard-validation`
**Route:** `/ui-c2-10-pitchside`
**Role:** Academy Owner only, behind the existing `ProtectedRoute`

**PAUSE UPDATE — 4 November 2026:** Product Owner requested a stop to design work so payment architecture can be completed. The selected Pitchside Emerald dashboard remains on the isolated Preview branch, not accepted for global or production rollout. Automated focused tests (56/56) and CRA build passed at `b7a761e`; authenticated Owner/mobile, role/tenant and metric parity after payment changes remain pending. See `UI_C2_DESIGN_PAUSE_HANDOFF.md` for exact restart procedure.
**Status:** Code and scoped CSS authored; focused CI, actual React build, authenticated browser testing, role/tenant validation and final rollout approval are separate gates.

## Product decision

The Product Owner prefers **Pitchside Emerald** over the Classic Blue, Floodlight Indigo, and five C2.9 experimental palettes. This sets the *selected Academy Owner dashboard preview direction*, **not** the global Kheltriva design system.

| Token | Selected value | Purpose |
|---|---|---|
| Deep forest | `#0C2629` | Premium football identity / dashboard header |
| Emerald primary | `#087C6E` | Links, active controls, attendance and chart accents |
| Lime highlight | `#C5EC85` | Restrained football accent on dark surfaces |
| Light canvas | `#F2F8F5` | Dashboard background |
| Card surface | `#FFFFFF` | Readable operational panels |
| Soft emerald | `#E7F7F2` | Selected states and tertiary surfaces |
| Dark text | `#153F3A` | Content readability |
| Muted text | `#536F69` | Secondary information |

The chart uses distinguishable categories `#087C6E`, `#A6C96A`, `#CE9B55`, `#4F8C86`, `#947BA6` without changing actual center records.

## Implementation

1. Added a `pitchsideSelected` flag to `AcademyOwnerDashboardC27`. The selected route locks `data-palette="pitchside"`, removes the palette switcher/gallery, and retains links to the earlier preview and current dashboard.
2. Added `AcademyOwnerDashboardC30.css` with **scoped** forest-green header, lime detail, emerald center/category colors, cards, attendance pulses, financial emphasis, hover/focus, and responsive rules. No global selector changes.
3. Added `/ui-c2-10-pitchside`, protected by `allowedRoles={["academy_owner"]}`. Existing `/dashboard`, `/ui-c2-7-preview`, `/ui-c2-9-palettes` are unchanged.
4. Reused existing `getAcademyOwnerDashboardData` and `academyOwnerC25Adapter`. No database, RLS, RPC, authentication, payment-calculation, third-party package, or build-system changes.
5. Added dedicated regression tests for selected palette lock, academy counts, zero-player batches, center links, training sessions, weighted attendance, finances, N/A collection rate, and empty source data.

## Exact code-commit verification (4 November 2026)

**Code HEAD:** `b7a761e320f18a37e6f10b337ebd1257b5740b7a` (one test assertion corrected after initial commit `a9a2e35`).

**CI:** https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41803968992

- Dependencies: `npm ci` **passed**.
- Focused C30, C29, C27, C25 and ProtectedRoute tests: **5 suites / 56 tests passed**.
- Real Create React App production build: **passed**, `Compiled successfully.`
- Full existing Jest suite: **failed** (4 failed / 27 passed suites; 16 failed / 208 passed tests). All four failures are in previously failing coach/performance suites: `CoachPerformanceAssessments`, `CoachProfile`, `PlayerPerformanceReport`, `PerformanceWorkspaceTabs`. No tests were suppressed and these remain separate release blockers.
- Vercel Preview deployment: **successful**, https://vercel.com/saurabh-shelke-s-projects/acadpro-app/7tDC9AYeDKdKBPzfvvvX5nfa6HRT .
- Authenticated Owner desktop/mobile QA, access denial for other roles, tenant isolation and final approval: **pending**.

## Rollout conditions

- [x] Focused C30, C29, C27, C25, ProtectedRoute tests passed (56/56).
- [x] CRA production build passed and Vercel Preview deployment succeeded.
- [ ] Full-suite failures are enumerated and unresolved regressions tracked separately.
- [ ] Academy Owner authenticated desktop/tablet/mobile review at 1440px, 1024px, 768px, 390px, 360px and 320px.
- [ ] Verify all existing player, attendance, financial and enquiries links and metric parity with original dashboard.
- [ ] Verify Super Admin, Coach and Parent route denial; separately test tenant isolation.
- [ ] Review visual contrast and accessible focus / hover / touch interactions across real devices.
- [ ] Product Owner approves whether the selected palette should next extend to the shared sidebar, Parent Portal, Coach Dashboard, Super Admin and remaining modules.

**Do not merge to `main`, replace `/dashboard`, or change global branding until separately approved and tested.**

## shadcn/ui evaluation

The selected palette is implemented using **existing React + scoped CSS**, not the official shadcn CLI. shadcn/ui provides an official MCP server for coding clients including VS Code and Codex (https://ui.shadcn.com/docs/mcp), but no dedicated shadcn ChatGPT plugin was found in the available Plugin Directory search. Kheltriva currently uses Create React App; shadcn's newer CLI setup focuses on other framework templates and Tailwind integration. Any future shadcn adoption requires a separate compatibility/QA task, not a dependency added for a visual color change.
