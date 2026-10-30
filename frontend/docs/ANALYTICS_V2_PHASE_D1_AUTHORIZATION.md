# Analytics V2 — Phase D1 Authorization Review

## Scope

This checkpoint covers the authenticated-user boundary for the preview-only Analytics Edge Function. It does not deploy the function, publish snapshots, change database schema, or modify production data.

## Live authorization model reviewed

The live `public.users` table contains `id`, `role` and `academy_id`. Existing private authorization helpers derive the current role and academy from the row whose `id = auth.uid()`; they do not need client-provided role or academy claims.

The inspected source-table RLS policies include Academy Owner scope checks for attendance, players, payment dues, payments and expenses. Relevant tables have RLS enabled. Coach access is separately constrained through coach-to-batch assignment policies. Parent access is limited to linked-child records. Super Admin has broader read access on selected reporting sources.

**Important:** the preview calculator uses a service-role client for source reads. That client bypasses RLS. Therefore the endpoint must enforce caller identity, role, tenant and requested scope before any calculation; RLS alone cannot protect these service-role reads.

## Implemented endpoint boundary

1. `verify_jwt = true` is explicitly configured for `generate-analytics-snapshot`. The Supabase gateway rejects requests without a valid user JWT.
2. The handler calls Supabase Auth `getUser(accessToken)` to independently resolve the authenticated identity.
3. A server-side service-role lookup fetches only that user's `public.users` profile (`id, role, academy_id`).
4. The pure `authorizeAnalyticsProfile` guard requires:
   - profile ID equals the Auth-verified user ID;
   - role is exactly `academy_owner`;
   - academy_id is present;
   - requested scope academy_id exactly equals the profile academy_id.
5. Existing database-backed scope ownership validation then checks academy, center and batch relationships.
6. Source queries retain academy-first predicates; finance records are obtained only through the player IDs selected within that academy scope, and expenses are filtered by academy_id.
7. Browser CORS preflight is handled. The browser must invoke with its user session token; the service-role key remains server-side only.

The V2 preview endpoint intentionally denies Super Admin, Coach and Parent roles for this initial Academy Owner integration. Existing Analytics page routes and other modules are unchanged.

## Automated tests

- Existing Analytics helper suite: 21 tests.
- New authorization suite: 8 tests covering Academy Owner role/scope checks and bearer-token parsing.
- GitHub Actions also runs the disposable PostgreSQL 17 scope-isolation fixture. This fixture validates the ownership SQL contract, not production RLS or full Supabase compatibility.

## Remaining verification limits

- No Edge Function is deployed in the live Supabase project.
- No live user JWT invocation has been performed against a deployed function.
- No production schema or data has been modified.
- The service-role data path remains security-sensitive: every new query must preserve the authenticated academy scope and must not accept tenant identity from request claims.
- Phase E must call the endpoint using `supabase.functions.invoke` under the signed-in Academy Owner session. Never pass a service-role key from React.

## Next step

After CI passes on this checkpoint, begin Phase E Academy Owner Analytics UI integration in the existing Analytics page. Keep the V2 preview integration behind a clear loading/error state and do not replace the existing Super Admin Analytics behavior. Deployment remains a separate approval gate.
