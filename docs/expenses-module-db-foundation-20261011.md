# Expenses Module — Database Foundation (2026-10-11)

## Scope

The Expenses module database foundation is deployed to the live AcadPro Supabase project:

- Project ref: `ulyealhkmlorsbdiknrh`
- Repository branch: `payment-module-finalization`
- Migration versions: `20261011135131` and `20261011135208`

This is a database-only milestone. The React UI, service layer, route/navigation, and browser regression tests are not implemented by these migrations.

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

## Next implementation steps

1. Add an Expenses service layer using the existing Supabase client and role/data-scope conventions.
2. Build the Expenses page: list, date filters, category filters, add/edit/delete transaction, and clear empty/loading/error states.
3. Build the recurring reminders section with monthly/quarterly cadence and next-due visibility.
4. Add route/sidebar visibility for Academy Owner and read-only Super Admin.
5. Test Super Admin, Academy Owner, Coach, and Parent behavior in the browser, including cross-academy isolation.
6. Run the frontend build and regression tests; review the final Git diff and live migration ledger.

## Operational note

The Supabase CLI was unavailable in the execution environment, so the migrations were applied through the connected Supabase migration operation and the exact applied SQL was then committed with matching version prefixes. Do not replay these migrations against the current live project; verify the migration ledger before applying anywhere else.
