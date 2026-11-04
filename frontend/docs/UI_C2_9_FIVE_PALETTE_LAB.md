# UI-C2.9 — Five Distinct Premium Dashboard Palettes

**Project:** Kheltriva, football-only academy management SaaS
**Working branch:** `ui-c2-5-owner-dashboard-validation`
**New route:** `/ui-c2-9-palettes`
**Feature scope:** Academy Owner-only visual experimentation (no production merge)
**Status:** Implemented and build-verified; authenticated browser and Product Owner acceptance pending.

## Goal

Let the Product Owner try five dramatically different football-academy design systems on the **real Academy Owner dashboard data**. Unlike UI-C2.8, these are cohesive light/dark heading treatments, page background, typography/contrast, cards, donut and center legend colors, financial tiles, attendance pulse, and interactive states, not merely three primary-button colors.

## Five new palette identities

| Theme | Dark identity | Primary | Accent | Canvas | Design character |
|---|---|---|---|---|---|
| Stadium Scarlet | `#1F252C` | `#B32137` | `#F8A18C` | `#FAF5F5` | Bold, modern football-club energy |
| Heritage Maroon | `#361D2A` | `#7B2849` | `#EBC58E` | `#FCF7F7` | Prestigious club/traditional academy |
| Terracotta & Sand | `#3C2C26` | `#A4472B` | `#F3C796` | `#FCF7EF` | Warm, natural, distinctively non-tech |
| Amethyst & Blush | `#2B1D3E` | `#6F3D91` | `#E7B6D9` | `#FAF6FC` | Creative, contemporary sports-tech |
| Onyx & Gold | `#242321` | `#705007` | `#EAC15E` | `#FBF9F1` | Understated luxury / elite academy |

Approximate primary-text contrast against pure white is respectively **6.58:1, 9.37:1, 5.97:1, 7.63:1 and 7.40:1**. These are spot checks, not complete accessibility certification.

## Architecture and isolation

- Route `/ui-c2-9-palettes` is wrapped by existing `ProtectedRoute allowedRoles={["academy_owner"]}`; no change to RBAC implementation.
- Reuses `AcademyOwnerDashboardC27` with a `paletteLab` boolean prop, the same `getAcademyOwnerDashboardData` service and `academyOwnerC25Adapter`.
- Five palette cards update a component-local, non-persistent `palette` state; changes only `.c29-lab` and its descendants.
- The existing `/dashboard`, `/ui-c2-5-preview`, `/ui-c2-7-preview`, navigation shell, global design tokens, Supabase data, payment calculations and RLS are left untouched.
- The center donut and legend change together to theme-specific category hues; source player counts and center assignments do not change.
- 70/30 desktop dashboard layout, Today's Sessions-first mobile behavior, attendance rate data contract, existing links and empty/error states are preserved.

## Changed files

- `frontend/src/components/Dashboard/AcademyOwnerDashboardC27.js` — optional paletteLab behavior and five-theme selector
- `frontend/src/components/Dashboard/AcademyOwnerDashboardC29.css` — exclusively scoped palette themes and treatments
- `frontend/src/components/Dashboard/AcademyOwnerDashboardC29.test.js` — five theme/interaction + contract assertions
- `frontend/src/pages/Dashboard.js` and `frontend/src/routes/AppRoutes.js` — isolated protected preview route
- `.github/workflows/ui-c2-5-owner-dashboard-validation.yml` — include new test
- Project status, backlog and continuity handoff records

## Exact-head CI verification — 4 November 2026

- Code commit: `cd1837d286ccfee1196a331eb318c1e1efe327f9`
- GitHub Actions: https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/41801325127
- `npm ci`: **passed**
- Focused preview (C29, C27, C25) and ProtectedRoute tests: **4 suites / 48 tests passed**
- Actual Create React App production build: **passed** (compiled successfully)
- Full Jest suite: **failed**, 4 suites failed / 26 passed; 16 tests failed / 200 passed. Same four previously failing coach/performance suites: `CoachPerformanceAssessments`, `CoachProfile`, `PlayerPerformanceReport`, `PerformanceWorkspaceTabs`. No attempt to suppress these.
- Vercel Preview deployment: **success** — https://vercel.com/saurabh-shelke-s-projects/acadpro-app/DKzDN8mzESnHkctXahAAWGCsxpM6
- Authenticated Owner visual testing, responsive QA, Super Admin / Coach / Parent denial, tenant-scope and Product Owner palette choice: **pending**.

## Validation gates

- [x] Focused preview + ProtectedRoute tests passed (48/48) on exact code commit
- [x] Real CRA `npm run build` passed on exact code commit
- [ ] Pre-existing unrelated full Jest failures remain documented (not silently ignored)
- [x] Vercel Preview deployment succeeded; authenticated route rendering remains to be manually verified
- [ ] Product Owner tests five themes on desktop and at 768px, 390px, 360px and 320px
- [ ] Product Owner verifies actual academy counts, zero-player batches, sessions, links, attendance marks, finance and enquiries
- [ ] Direct role-denial testing for Super Admin, Coach and Parent, including cross-academy scope
- [ ] Check color contrast, readability, hover/focus, reduced motion and horizontal scrolling
- [ ] Product Owner selects/rejects a palette and approves any wider app application

**No theme is selected for Kheltriva globally. No merge to `payment-module-finalization` or `main`.**
