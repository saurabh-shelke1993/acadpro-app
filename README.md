# Kheltriva

Football academy management platform for academies, coaches and parents.

## Product branding

The product name is **Kheltriva**. The approved visual direction is a professional navy, blue and lime palette.

| Token | Value | Usage |
|---|---|---|
| Brand sidebar | `#0B1F3A` | Primary application sidebar |
| Brand navy | `#16324F` | Headings and brand surfaces |
| Primary blue | `#2563EB` | Primary actions and links |
| Sport lime | `#C4F047` | Restrained brand accent |
| Page background | `#F7F9FC` | Main application workspace |
| Surface | `#FFFFFF` | Cards and content surfaces |

Shared design tokens are maintained in `frontend/src/styles/design-system.css`. Use these tokens for brand colours rather than introducing new hard-coded shades. Preserve semantic status colours (success, warning, error) and service-specific colours such as WhatsApp green when they communicate a distinct meaning.

Platform branding and academy identity are separate: the Kheltriva mark identifies the platform; academy names and logos continue to identify the relevant academy.

## Branding roadmap and release status

Current branch for this work: `payment-module-finalization`.

- [x] Approved Kheltriva name and visual direction.
- [x] Kheltriva logo references added to the application shell and login experience.
- [x] Shared design tokens updated to the approved palette.
- [x] Academy Owner dashboard welcome header added and CSS visibility rule corrected.
- [x] Favicon and browser/PWA theme colours updated.
- [x] Targeted colour-token cleanup in login, Academy Owner dashboard and parent UPI payment styles.
- [x] Code review of shared navigation and role-specific dashboard/portal components.
- [ ] Full visual verification across Super Admin, Academy Owner, Coach and Parent sessions.
- [ ] Production build and automated test run after the latest branding commits.
- [ ] Final Git diff review and release sign-off.

**Important:** A GitHub commit confirms that code was committed; it does not establish that the latest build or all role-based regression tests passed. Record test results only after running them against the current branch.

## Development

The React application is in `frontend/`.

From the frontend directory:

```bash
npm ci
npm start
```

To run the production build and automated tests:

```bash
npm test -- --watchAll=false
npm run build
```

Run these commands against the intended branch and review the terminal output. Do not discard uncommitted work to resolve a pull or merge conflict.

## Change safety

Branding changes should remain visual or metadata-only unless a separate feature change is explicitly approved. Do not change authentication, role-based access control, Supabase row-level security (RLS), attendance, fee collection, payment verification or academy data-scope behaviour as part of the branding roadmap.
