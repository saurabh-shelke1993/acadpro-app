# AcadPro Design System — D1

## Purpose

D1 establishes the shared visual foundation for AcadPro before individual modules are redesigned.

The goal is to stop UI drift between modules and give future Dashboard, Analytics, Finance, Attendance, Player, Coach, and Parent Portal work a common visual language.

## Current foundation

### Brand

- Primary: AcadPro blue (--ap-primary-600)
- Navigation base: deep slate (--ap-slate-900)
- Page background: soft slate (--ap-page-bg)
- Surface: white (--ap-surface)

### Semantic colors

- Success: --ap-success-*
- Warning: --ap-warning-*
- Danger: --ap-danger-*
- Informational: --ap-info-*

### Typography

Use the shared --ap-font-sans stack.

Preferred hierarchy:

| Use | Token |
| --- | --- |
| Page title | --ap-font-size-3xl |
| Section title | --ap-font-size-xl |
| Body | --ap-font-size-md |
| Secondary text | --ap-font-size-sm |
| Caption / metadata | --ap-font-size-xs |

### Spacing

Use the --ap-space-* tokens instead of introducing arbitrary spacing values.

### Radius

- Small controls: --ap-radius-sm / --ap-radius-md
- Cards: --ap-radius-lg
- Larger feature surfaces: --ap-radius-xl
- Status pills: --ap-radius-full

### Elevation

Use:

- --ap-shadow-sm for standard cards
- --ap-shadow-md for elevated interactive surfaces
- --ap-shadow-lg sparingly for prominent overlays

## Shared primitives

The foundation currently provides:

- .ui-button
- .ui-button-primary
- .ui-button-secondary
- .ui-button-success
- .ui-button-danger
- .ui-badge and semantic badge variants
- .ui-card
- .ui-card-elevated
- .ui-section
- .ui-section-title
- .ui-table-wrapper
- .ui-table

These are intentionally low-level. Existing modules do not need to be migrated in D1.

## UX rules for future work

1. Do not introduce a new brand color without a design-system token.
2. Do not use arbitrary shadows for new cards.
3. Do not create one-off button styles when a shared button primitive fits.
4. Forms must have visible focus states.
5. Disabled controls must communicate their state.
6. Tables should use the shared wrapper on narrow screens.
7. Destructive actions should use the danger semantic color.
8. Status should use badges rather than relying only on color.
9. Prefer consistent spacing tokens over ad-hoc margins.
10. Respect prefers-reduced-motion.

## Migration strategy

D1 is intentionally non-breaking.

Existing modules still contain legacy inline styles and page-specific CSS. They will be migrated incrementally during:

- D2 Application Shell
- D3 Dashboard V2
- D4 Analytics
- D5 Module-by-module functional polish
- D6 Parent Portal polish

Do not rewrite every page just to consume the new tokens. Migrate each module when it is being redesigned and regression-tested.

## Next D1 work

Before D2, audit and standardize:

- Sidebar/navigation visual language
- Page header pattern
- Form/filter pattern
- Primary/secondary action hierarchy
- Card pattern
- Table pattern
- Modal pattern
- Empty/loading/error/success feedback

The design system should remain the single source of truth for these patterns.
