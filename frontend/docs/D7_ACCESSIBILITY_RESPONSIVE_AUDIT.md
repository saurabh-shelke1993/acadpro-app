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
