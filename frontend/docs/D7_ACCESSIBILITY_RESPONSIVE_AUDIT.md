# D7.1 — Accessibility & Responsive Audit

## Scope

Static audit of the AcadPro frontend at D6.9 baseline commit:

`569f24c867a7c85f817b9412e5a29cb9d73891d3`

D7.1 is an audit/baseline phase. No business logic, authentication, RBAC, Supabase queries, RLS, payment ledger, attendance rules, or performance calculations are changed by this phase.

## Current strengths

- Shared design tokens exist in `src/styles/design-system.css`.
- Global `:focus-visible` styling exists.
- Reduced-motion support exists through `prefers-reduced-motion: reduce`.
- Shared button, badge, card, and table primitives exist.
- Main application navigation has a semantic `nav` with `aria-label="Primary navigation"`.
- Mobile navigation controls have accessible labels and `aria-expanded`.
- Parent Portal has dedicated responsive and state-feedback styling.
- Major D5/D6 modules have responsive CSS and focus styling.
- Tables use horizontal overflow wrappers where appropriate.

## Findings

### D7-P1 — Login component requires functional/accessibility review

`src/pages/Login.js` contains the authentication handlers but currently does not render a JSX form from the component.

The route in `AppRoutes.js` imports this component at `/login`.

**Impact:** High. The login experience should be explicitly regression-tested before D7 is considered complete.

**D7 action:** Restore/validate the actual login UI only after inspecting the intended current login UX. Do not change authentication behavior.

### D7-P2 — ProtectedRoute loading state uses inline presentation

`src/components/ProtectedRoute.js` renders its loading state with an inline padding style.

**Impact:** Low. Presentation is inconsistent with the D1 design system.

**D7 action:** Move this into a semantic loading-state class and add appropriate status semantics during the navigation accessibility pass.

### D7-P3 — Mobile sidebar focus management needs keyboard audit

The mobile sidebar has:
- open/close state
- overlay
- close button
- accessible menu button

However, there is no explicit focus trap, Escape-to-close handling, or focus restoration to the trigger after closing.

**Impact:** Medium for keyboard and assistive-technology users.

**D7 action:** Address during D7.2 navigation accessibility. Preserve existing responsive behavior.

### D7-P4 — Legacy responsive CSS remains in index.css

`src/index.css` contains an older responsive system using classes such as:
- `.dashboard-container`
- `.sidebar`
- `.main-content`
- `.stats-grid`
- `.quick-actions`
- `.form-grid-3`
- `.form-grid-4`
- `.hamburger`

The current D2 shell uses `.app-shell`, `.app-sidebar`, `.app-main`, and related classes.

**Impact:** Medium technical debt. Duplicate responsive systems increase maintenance risk.

**D7 action:** Identify remaining consumers before removing or consolidating the legacy rules. Do not delete them solely from the audit.

### D7-P5 — Touch target consistency requires module-level audit

Shared buttons have a minimum height, but page-specific icon/action controls need a targeted audit for mobile touch usability.

**Impact:** Medium.

**D7 action:** Review table actions, compact controls, navigation controls, and icon-only controls during D7.4/D7.7.

### D7-P6 — Form semantics require module-level audit

The design system provides accessible focus styling, but form label association, required-state communication, validation messaging, and keyboard order need verification across the major CRUD/payment forms.

**Impact:** Medium.

**D7 action:** Review Players, Attendance, Coaches, Coach Batch Mapping, Subscription Plans, Player Subscriptions, Payment Dues, Payment Collections, and Performance Assessments during D7.3.

## D7 implementation sequence

1. D7.1 — Audit baseline — this document
2. D7.2 — Navigation/sidebar accessibility
3. D7.3 — Forms and validation semantics
4. D7.4 — Tables and action controls
5. D7.5 — Keyboard navigation and focus behavior
6. D7.6 — Responsive consistency and legacy CSS cleanup
7. D7.7 — Typography, contrast, and touch targets
8. D7.8 — Cross-role accessibility regression
9. D7.9 — Final D7 QA and Git closure

## Validation policy

Each implementation phase should preserve:
- existing RBAC and role scope
- Supabase RLS boundaries
- existing business logic
- payment ledger immutability
- attendance rules
- multi-tenant data scope

Required validation remains:

```bash
npm test -- --watchAll=false
npm run build
npm start
```

Then perform browser/keyboard/mobile validation for the affected area.

## D7.1 exit criteria

D7.1 is complete when:
- the audit findings are recorded;
- no production behavior is changed solely to mark the audit complete;
- the next implementation target is unambiguous.

Next implementation target: **D7.2 — Navigation/sidebar accessibility.**


## D7.3 — Forms & Input Accessibility

Implemented the first form-semantics pass across the highest-impact management forms:
- Added explicit label/control associations with stable `id` + `htmlFor` pairs for Players, Attendance, Subscription Plans, and Player Subscriptions.
- Added an accessible name to attendance presence checkboxes.
- Preserved existing validation, submit handlers, data fetching, RBAC, and Supabase/RLS behavior.
- Payment Dues, Payment Collections, Coaches, and Coach Batch Mapping already use wrapping labels for their primary controls; no unnecessary behavior changes were introduced.
- Coach Performance Assessments already contains explicit `htmlFor`/control IDs for its form fields.

D7.3 validation should cover keyboard-only navigation, visible focus, label-to-control focus behavior, form submission/validation, and responsive form layout.


## D7.4 — Tables & Action Controls

Implemented table accessibility improvements across Players, Attendance History, Coaches, Coach Batch Mapping, Academy, Centers, Batches, Payment Dues, and Payment Collections:
- Added screen-reader-only table captions describing table purpose.
- Added `scope="col"` to table header cells for clearer column relationships.
- Added contextual accessible names to key Edit/Delete/Deactivate/attendance action controls where the visible action text or icon alone did not identify the affected record.
- Preserved existing action handlers, role checks, confirmation flows, financial workflows, and data access behavior.
- Added a shared `.sr-only` utility to the design system.

D7.4 validation should cover keyboard access to every action, visible focus, table navigation/readability, action context, and role-specific action visibility.


## D7.5 — Keyboard Navigation & Focus Management

Implemented application-level keyboard and focus behavior:
- Added a keyboard-accessible **Skip to main content** link as the first focus target in the authenticated application shell.
- Added a stable `main-content` landmark target with `tabIndex="-1"` so keyboard users can move directly to page content.
- Added route-change focus management so navigation moves focus to the main content area after a page transition, while preserving the mobile sidebar's existing focus behavior.
- Preserved the D7.2 mobile navigation focus trap, Escape-to-close behavior, and focus restoration to the menu trigger.
- Added semantic `role="status"` and `aria-live="polite"` to the ProtectedRoute loading state and moved its presentation into the shared shell stylesheet.
- No business logic, authentication behavior, RBAC, Supabase queries/RLS, payment ledger, attendance, or performance logic was changed.

D7.5 validation should cover:
- Skip-link activation with keyboard only.
- Tab/Shift+Tab movement through the application shell.
- Route navigation moving focus to the main content area.
- Mobile sidebar focus trap, Escape close, and focus restoration.
- No unexpected focus loss when navigating between modules.
- Protected-route loading state announced as status without disrupting navigation.
- Existing module action controls and form keyboard behavior remain unchanged.


## D7.6 — Responsive Consistency & Legacy CSS Cleanup

Implemented responsive consistency improvements:
- Reduced desktop-only sidebar vertical density while keeping the application navigation keyboard-accessible and preserving the existing mobile/tablet layouts.
- Kept the sidebar as a viewport-height navigation region with overflow protection for shorter desktop viewports; the desktop density pass reduces unnecessary spacing so common laptop/desktop heights can display more navigation without scrolling.
- Removed the unused legacy responsive rules from `src/index.css` (`dashboard-container`, `sidebar`, `main-content`, `stats-grid`, `quick-actions`, `form-grid-3`, `form-grid-4`, and `hamburger`).
- Confirmed the active routed application uses the D2 `app-shell` navigation rather than the legacy dashboard shell.
- Preserved D7.2/D7.5 mobile navigation, focus management, route focus, RBAC, RLS, and module behavior.

D7.6 validation should cover desktop widths/heights, tablet widths, mobile widths, sidebar navigation reachability, no unintended horizontal overflow, and regression of the existing dashboard and module layouts.


## D7.7 — Typography, Contrast & Touch Targets

Implemented the shared visual accessibility pass:
- Strengthened the shared `:focus-visible` treatment to use the primary color directly for a clearer keyboard focus indicator.
- Improved placeholder text contrast from the lighter neutral token to the stronger `slate-500` token.
- Normalized shared controls to a 40px minimum height and normalized application navigation/menu/logout controls to at least 40px.
- Normalized high-use Players, Attendance History, and Payment Dues action controls to 40px minimum height for more consistent touch and pointer interaction.
- Preserved existing semantic status colors, responsive layouts, reduced-motion behavior, and module-specific interaction styling.
- No business logic, RBAC, RLS, authentication, payment ledger, attendance, or performance logic was changed.

D7.7 validation should cover focus visibility, placeholder readability, navigation/control target sizing, status-badge readability, desktop/mobile interaction, and reduced-motion behavior.
