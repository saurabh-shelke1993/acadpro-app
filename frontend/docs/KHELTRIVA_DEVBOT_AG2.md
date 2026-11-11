# Kheltriva DevBot AG2 — Real local Supabase Auth in GitHub Actions

**11 November 2026 — implemented on isolated AG2 feature branch, real CI pending.**

## Goal

Remove manual PowerShell dependence for the real Supabase Auth portion of B2.9 C3.4. Use the standard GitHub Ubuntu runner, disposable local Supabase CLI 3.0.0 stack, and pre-existing pinned synthetic fixtures. No hosted Supabase link, no production credentials, no historical migration replay.

## What AG2 validates

- Supabase CLI creates a fresh, UNLINKED temporary project with no migrations and confirmations disabled.
- The exact five-table synthetic C3.3A schema and unchanged pinned eleven-function C3.3B helper snapshot install and pass the existing SQL guards.
- Actual local GoTrue rejects a malformed JWT.
- Real GoTrue signups and GET /auth/v1/user bearer session checks authenticate one unmapped smoke identity, synthetic Academy Owner A and Academy Owner B. Passwords, keys and tokens never appear in CI summaries or logs.
- Approved transactional mappings bind GoTrue-generated UUIDs to two different synthetic academy_owner rows. A fresh database connection validates 3 Auth users, 2 app owners, 2 batches, 11 helpers, unchanged RLS configuration and no direct table client grants.
- GitHub Actions Summary shows safe PASS/FAIL checkpoints; cleanup always stops the disposable local stack.

## Not included

**AG3 pending:** Positive and negative cross-academy JWT/REST RLS access tests. Current AG2 validates real GoTrue sessions and source-verified application role mappings only; it cannot claim tenant isolation. Existing Windows C3.4B2 database state remains unverified and untouched. No actual Kheltriva customer data, payment collections, Storage, historical replay, B4 deployment or Vercel action.

## Cost, security and phone

One standard ubuntu-latest job, 20-minute ceiling, no paid AI/API calls, no uploaded artifacts, no hosted Supabase secrets, read-only GitHub token, checkout without stored credentials, no merge to main. The Owner can read the Actions Summary on a phone. Manual Run workflow through GitHub UI still requires the workflow on the default branch; it will not be merged there automatically.

## Development status

IMPLEMENTED: isolated branch code + static safety checks + native stack workflow.
CI-TESTED: pending first real GitHub Actions run.
OWNER SIGN-OFF / MERGE to payment-module-finalization: pending.
AG3 JWT tenant RLS: pending.
PRODUCTION / B4: unchanged and blocked.
