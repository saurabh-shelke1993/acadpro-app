# Kheltriva — B2.9 Disposable Local Supabase Validation Preparation

**Plan only. No local Supabase execution or database changes in this checkpoint.**

## Environment separation

1. Use a temporary **unlinked** local workspace/copy, never the canonical checked-out migrations or active Supabase project. The protected B3.4 private archive stays in the ignored local directory on the owner's laptop and must never be committed, uploaded to GitHub Actions or copied into project docs.
2. Check that Docker Desktop (or another Docker-compatible runtime) is installed/running, and verify the installed Supabase CLI version and its actual available commands with `supabase --help`, `supabase start --help`, `supabase db --help` and `supabase db reset --help`. No remote project linking or production credentials are needed.
3. Verify scratch instance identifiers, ports and volume paths before starting. Avoid any command with `--linked`, `db push`, hosted connection strings or production project IDs. A local Supabase stack is development-only and should not be exposed to the network.
4. Keep current 11 helper definitions separate from authentic historical statements. Do not silently place the B2.9 SQL in the canonical migration chain or treat the current `parents.user_id` helper as available before its actual historical column-creation migration.

## Prerequisite checkpoints before attempting full source replay

- **Original source coverage:** Protected archive 82 versions / 168 elements passes B3.4 integrity and B3.5B scan. Recheck before using a working copy.
- **Explicit scratch-only SQL assembly proposal:** Map missing private schema/helper creation as a **nonhistorical bootstrap**, review first consumer `20260903173804` and parent-helper revision `20260908062059` -> `20260912142706`, and review six timestamp/source conflicts. No such executable assembly approved yet.
- **Quarantine:** Separate 14 record-specific/backfill SQL cases from indispensable DDL, functions, policies, triggers, grants and preflight assertions. No record-specific UUID corrections from the archived source should execute.
- **Synthetic fixtures:** Create separate invented academies, players, parents, coaches, batches, payments, dues and Storage objects. No production exports or live customer records.
- **Security and finance acceptance:** Require real local Supabase Auth-issued sessions, RLS cross-tenant positive/negative tests, Storage private/public read and write isolation, financial transaction atomicity, receipt uniqueness and rollback, helper-owner/grant parity. The 35 scenarios in B3.6 are still NOT RUN.

## Execution boundary

Full local Supabase validation is **prepared, not run**. It cannot be claimed complete without the protected archive, an approved scratch-only reconstruction, and a functioning Docker/Supabase CLI environment. Stop if the proposed test would touch the live `ulyealhkmlorsbdiknrh` project or require paid infrastructure. Owner acceptance of results is a later separate gate.

Reference: [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
