# AG3.4C2 — Real GoTrue JWT replay of source-matched Parent/Coach/SA SELECT policies

**Implementation:** isolated CI only. **Validation:** [GitHub Actions 43053148909](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43053148909) **PASS**, 9/9 pure tests and real signed-JWT Native GoTrue/PostgREST checks (11 November 2026). **Owner authorization:** standing approval for development-branch PR merges subject to successful checks.

## Exact deployed-source scope

Read-only live `pg_policies` from active `acadpro-db` captured **six SELECT predicates**: `batches_select`, `batches_parent_select`, `parents_select`, `parents_parent_select`, `players_select` and `players_parent_select`. Scratch SQL **replaces** AG3.3 synthetic SELECT policies to avoid accidental OR bypass. Postflight asserts all six Postgres-normalized policy MD5 values and exactly two/ two/ five policy counts for parents, players and batches respectively.

Read-only `private.current_parent_id()` definition was copied from the same hosted catalog (source hash `5cd00d89a1a947ad5b9ee315bba211e2`). Scratch-only `parents.is_active` models the real function's **active Parent** check; a Parent A2 deactivation followed by a fresh real-JWT query produced zero accessible Parent, Child and Batch records. Re-activation restored them. No hosted record was changed.

## Validated signed JWT contract

- Parent A1, A2 in the same academy and Parent B in a second academy see exclusively their own linked parent, child and batch under the six *deployed-source* policies.
- Direct ID tampering to other academy or other Parent in the same academy returns no rows.
- Inactive Parent A2 loses access while Super Admin retains platform read; no other Parent gains access.
- Owner A/B academy scope, Coach A/B assigned active batches, Coach A inactive batch denial, Coach linked players/parents and Super Admin cross-tenant read are rechecked.
- Unmapped GoTrue/Auth user and malformed bearer denied; forged `x-user-id` or `x-academy-id` cannot broaden scope.
- After all tests the original three Parents were reactivated and the fixture counts matched.
- Fresh native instance discarded with `supabase stop --no-backup`.

## Limits / next steps

This reconstructs **six actual deployed SELECT predicates and one active-Parent helper**, using **seven minimal synthetic app tables, pinned original eleven helper functions and real local GoTrue sessions**. It is **not** a full 82-migration replay, not all parent/coach/SA RLS mutations, not finance/RPC/Storage permissions, and not a hosted end-to-end or manual browser test.

**AG3.4B HIGH risk remains:** `coach_batches` authenticated same-academy mutation was reproduced under exact live predicates in disposable CI; role-gated candidate is still test-only and **not deployed**. C2 success does not make the application safe to launch.

**AG3.4D:** finance/RPC/Storage authorization remains to be tested. **AG3.4E:** consolidated risk and release gating remains pending. B4 billing NO-GO and migration reconciliation outstanding.
