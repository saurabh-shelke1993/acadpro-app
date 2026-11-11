# B2.9-C3.4A — Real local Supabase Auth session smoke: planned

**11 November 2026 — SCRATCH-ONLY — NO HOSTED CHANGES**

## Confirmed owner checkpoint

The Owner independently verified **B2.9-C3.3B** after helper installation in the native local Supabase stack. The fresh connection returned exactly **11|2|0|t|f|t**: 11 persistent private helpers, 2 synthetic batches, zero Auth users, native auth.uid() retained, private schema USAGE denied to anon and allowed to authenticated. The 11 helper hashes/privileges passed in the prior atomic local session. C3.3B is **LOCAL PASS / CLOSED**, without historical provenance or production sign-off.

## C3.4A scope (NEXT; NOT RUN)

1. Work only from the unlinked Windows scratch folder kheltriva-b29-disposable, with the existing healthy local container. Do not start a second Supabase instance or reset the database.
2. Confirm the CLI 3.0.0 status API URL is exactly http://127.0.0.1:54321 and load only the local publishable API key **into PowerShell memory**; never print CLI status output, local keys, JWTs or passwords.
3. Verify the local scratch config has email confirmations disabled and the expected pre-state is 11 helpers / 2 batches / 0 app users / 0 Auth users.
4. Create **one** invented @example.test email/password account via local GoTrue POST /auth/v1/signup; validate the Auth-issued access_token via local GET /auth/v1/user using that same token.
5. Reinspect database to establish 1 local auth.users record, no public.users record, and 11 helpers / 2 batches unchanged. Print only safe PASS status and synthetic UUID.
6. Stop; do not grant application table privileges, create policies, modify the canonical schema or replay historical SQL in C3.4A.

**C3.4A status:** Owner preflight PASS (local API verified, publishable key available, confirmations disabled); safe one-user Auth test script committed and [CI run 42983842960](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42983842960) PASS: 32/32 Python tests, PowerShell parser syntax, prior isolated SQL checks. **Actual real local Auth signup is NOT RUN** until the Owner executes the script and supplies its sanitized output. The Owner-run PowerShell check must fail closed on any unexpected local URL, environment, response or database state. No CLI status output or private tokens should be pasted into chat.

**C3.4B/C pending:** Link genuine Auth UUIDs to synthetic application roles, then separately validate real RLS positive/negative cross-tenant access using actual JWTs and explicitly reviewed scratch-only policies.

**Not permitted:** Production SQL writes, hosted Auth changes, paid infrastructure, canonical migrations, 82-version historical replay, B4 billing. Storage/finance and the 35 B3.6 scenarios remain pending.

Official reference: https://supabase.com/docs/guides/auth/testing-auth-flows

## Single-account scripted smoke test

The committed scratch-only script is `supabase/tests/subscriptions/b2_9_c34a_local_gotrue_smoke.ps1`. It requires the exact isolated working directory and container, confirms a pristine database, reads the local publishable key from CLI output without printing it, creates one random `@example.test` identity through native local GoTrue signup, validates bearer credentials through GET `/auth/v1/user`, and verifies 11 helpers / two batches / zero app users / one local Auth user. It outputs only a non-sensitive JSON summary. On any failed signup or postcheck, **stop rather than repeat**, as an account might already have been created.

Do not print the CLI env output, signup response, Authorization headers or JWTs. Do not run via GitHub Actions, hosted Supabase, a linked database, or canonical migrations.
