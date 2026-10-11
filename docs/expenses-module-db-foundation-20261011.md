# Expenses Module — Database Foundation (2026-10-11)

## Scope

The Expenses module database foundation is deployed to the live AcadPro Supabase project:

- Project ref: `ulyealhkmlorsbdiknrh`
- Repository branch: `payment-module-finalization`
- Migration versions: `20261011135131` and `20261011135208`

The database foundation is deployed. The React service layer, Expenses page, route, and Finance navigation are now implemented in the frontend. Browser regression testing remains pending.

## Data model

### `public.expenses`

Stores actual expenses manually recorded by the Academy Owner. Fields include academy, date, category, description, vendor, amount paid, payment method, reference number, optional reminder link, notes, creator, and timestamps.

### `public.expense_reminders`

Stores expected recurring costs with monthly or quarterly frequency, expected amount, next due date, active flag, category, description, notes, creator, and timestamps.

**A reminder never creates an expense transaction automatically and does not mark an expense as paid.** The owner records the actual expense separately.

## Authorization

- Academy Owner: CRUD only for records belonging to their current academy.
- Super Admin: read-only access across academies.
- Coach and Parent: no policies and no table grants.
- Anonymous: no table grants.
- `authenticated` receives only SELECT, INSERT, UPDATE, DELETE table privileges; broader default privileges such as TRUNCATE, REFERENCES, and TRIGGER were explicitly revoked.
- RLS is enabled on both tables, with four policies per table.
- Insert/update policies restrict a supplied `created_by` to NULL or the authenticated user's ID.
- A composite foreign key prevents linking an expense to a reminder from another academy. Deleting a reminder preserves the expense and nulls only `reminder_id`.
- A private trigger function updates `updated_at`; it uses an empty search path and has no direct execute grant to client roles.

## Applied migrations

| Version | Name | Purpose |
|---|---|---|
| `20261011135131` | `expenses_module_foundation` | Creates both tables, indexes, RLS policies, timestamp trigger |
| `20261011135208` | `tighten_expenses_table_grants` | Removes broad default privileges and grants only required client CRUD |

The corresponding SQL files are committed under `supabase/migrations/`. The earlier `supabase/expenses_module_migration_proposal.sql` is retained for history and marked as superseded; do not execute it directly.

## Verification completed

- Supabase migration ledger records both versions.
- Both tables exist with RLS enabled.
- Four policies exist on each table (SELECT, INSERT, UPDATE, DELETE).
- No `anon` table grants remain on either table.
- `authenticated` has only SELECT, INSERT, UPDATE, DELETE on these tables.
- The timestamp trigger function is not SECURITY DEFINER and has an empty search path.
- Supabase Security Advisor shows no new no-policy finding for either Expenses table. Existing unrelated findings remain outside this scope.

## Frontend implementation — 2026-10-11

- `frontend/src/services/expensesService.js`: role-aware read/write operations for expenses and reminders; Academy Owner academy scope is applied in service queries and writes.
- `frontend/src/pages/Expenses.js` and `Expenses.css`: expense register, INR summaries, date filters, actual-expense form, recurring-reminder form, edit/delete actions, empty/loading/error states, and responsive layout.
- `frontend/src/routes/AppRoutes.js`: `/expenses` route protected for `super_admin` and `academy_owner`.
- `frontend/src/components/Sidebar.js`: Expenses link in Finance navigation for Super Admin and Academy Owner.
- Super Admin sees academy labels and can filter academies; all mutation controls are hidden for this role.
- Academy Owner can manage only their academy. Coach and Parent do not see the navigation item and are blocked by the route. Database RLS remains the authoritative access control.
- Actual expense records and recurring reminders are separate. Reminders do not create transactions automatically.
- Frontend build/Jest validation and browser role regression are not yet confirmed.

## Next steps

1. Review the GitHub Actions frontend validation run for Jest and production build.
2. Browser-test Academy Owner create/edit/delete workflows and reminder handling.
3. Browser-test Super Admin cross-academy read-only view.
4. Verify Coach/Parent cannot access `/expenses` directly.
5. Fix any issues found, then review the final Git diff and role isolation.

## Operational note

The Supabase CLI was unavailable in the execution environment, so the migrations were applied through the connected Supabase migration operation and the exact applied SQL was then committed with matching version prefixes. Do not replay these migrations against the current live project; verify the migration ledger before applying anywhere else.
