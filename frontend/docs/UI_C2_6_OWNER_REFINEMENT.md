# UI-C2.6 — Academy Owner Preview Refinements (A–D)

**Branch:** `ui-c2-5-owner-dashboard-validation`  
**Basis:** UI-C2.5 owner-only, read-only preview; `/dashboard` remains unchanged.  
**Scope:** A/B compact header, player distribution and all today's sessions; C unified attendance and compact finance/admissions; D focused QA and owner acceptance gate.

## Changes implemented in the preview

- **A — Header and visual hierarchy:** Remove full-width dark preview banner in favor of a small preview label and return-to-dashboard link. Tighten heading, typography, card padding and hierarchy while retaining approved navy/blue/lime tokens.
- **B — Player and session workspaces:** Keep existing unique player count and center memberships distinct; preserve selectable centers and empty batches. Render **all** scheduled sessions in the accessible DOM, grouped by center, without hiding sessions behind Show all. Display `attendanceRecorded` as **Marks recorded / No marks yet**, explicitly clarifying that this means at least one mark, not full session completion. Retain `centerId`/`batchId` navigation.
- **C — Attendance/finance:** Replace equal-height, sparse center cards with one grouped compact attendance panel. Preserve weighted `sum(presentRecords) / sum(totalRecords)` and separate recorded-mark percentage from batches with marks. Preserve monthly amounts and due status counts. Display collection rate as **N/A** when billed-this-month denominator is zero; no source metric/RPC changes. Clarify that current outstanding can include previous months. Retain center-scoped Enquiries navigation.
- **D — Verification:** Extend Jest tests for all sessions visible, attendance mark status, rate semantics, 0-billing N/A, preview isolation, existing scope and zero-player batches. Use branch CI for `npm ci`, focused tests and real CRA build; existing unrelated full-suite failures tracked separately.

## Release / user acceptance checklist

- [ ] GitHub Actions focused C2.6 regression passes on exact commit.
- [ ] CRA production build passes on exact commit.
- [ ] Full suite inspected and any pre-existing failures documented, not hidden.
- [ ] Owner confirms desktop 1440px, 1024px, 768px, mobile 390px / 360px / 320px, no horizontal overflow and tap targets.
- [ ] Owner checks actual academy data against `/dashboard`, all sessions with mark states, zero-player batches, filtered center links, weighted attendance and finances.
- [ ] Negative role checks: Super Admin, Coach and Parent denied direct access to `/ui-c2-5-preview`; secondary Owner tenant isolation.
- [ ] Browser console, refresh and navigation inspected.

**No merge, production rollout, database migration, RLS/RPC or other-role route changes are authorized by this phase.** User visual approval is still pending.
