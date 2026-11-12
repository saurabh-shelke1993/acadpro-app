# AG3.4D3.1 — Real signed-JWT collect_payment execution regression

**State:** original-source signed-JWT exploit **REPRODUCED in disposable CI**, and an isolated role-guard fix **PASSED the same JWT denial test**. [Native CI 43158144697](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43158144697) executed 7 offline guards, C2/D1 preflight, unauthorized payment probe, rollback and concurrency. **The hosted RPC is still vulnerable/unmodified.** Only one of fourteen public authenticated `SECURITY DEFINER` RPCs is in this test scope. Not a production release approval.

## Source and test contract

Read-only inspected deployed `public.collect_payment(uuid,numeric,text,text)` (source MD5 `fcc5610c509392caf81ffa99b82051a9`) and `private.next_payment_number(text,date)` (`b5b81f242c8378bf91cbbfcf458ce5cb`). The SQL fixture installs these original `pg_get_functiondef` bodies unchanged in a fresh, *unlinked*, local Supabase PostgreSQL 17/GoTrue/PostgREST stack, following the passing AG3.4C2 and AG3.4D1 source-aligned read-policy fixtures. The fixture checks Postgres-normalized source MD5s before testing. It creates only invented identities and three invented payment dues, plus one additional synthetic due for concurrency.

Role cases exercised via **actual GoTrue-issued JWT HTTP calls**: same-Academy Owner accepts payment, Owner B cannot collect Academy A due, Coach/Parent/unmapped rejected, SA may collect both academies' dues, anonymous/bad tokens rejected. Financial invariants: zero/negative amount and bad mode rejected; overpayment rejected, partial/full transitions, second payment on already paid due denied, corresponding ledger row and receipt number generated.

A new native negative case first probes the **exact original deployed function** with an authenticated but unmapped GoTrue identity. Since `NULL NOT IN (...)` is SQL UNKNOWN, the role gate and `v_role = 'academy_owner'` tenant check can both be bypassed; the fixture requires an unauthorized invented due/payment mutation to be observed, then installs a **scratch-only** `v_role IS NULL OR ...` candidate and requires the same JWT to be rejected. This is **AG34-HIGH-002**: proposed hosted fix is NOT deployed. The original source is preserved separately from the candidate.\n\nA scratch-only trigger raises a controlled exception **after number allocation** on a specified test remark, verifying that payment state, inserts and payment-number counters roll back atomically. Two concurrent signed Owner calls targeting the same new 100-unit due at 70 each must yield exactly one committed payment, leaving 30 remaining. Expected rejection messages are checked (mere 400 status isn't accepted as role proof), and synthetic financial state is queried after each negative case.

## Strict boundaries

- D3.1 replicates **one** deployed RPC source and its deployed numbering helper, but not the entire hosted schema, payment triggers, notification side effects, every table constraint or the complete payment lifecycle.
- Failures from the original source under the minimal scratch schema should be diagnosed and corrected in the **fixture only**; never rewrite function logic to force tests green. If live source drift is discovered, stop and review separately.
- No call against hosted RPCs or customer financial rows; no hosted SQL DDL/DML, `main` or Vercel changes, service-role tokens, original migration replay or B4 activation.
- **Still blocked:** production AG34-HIGH-002 remediation and the other privileged RPCs sharing NULL-unsafe guards; remaining 13 public callable RPCs, 16 Storage policy object tests, production HIGH-001 legacy Coach mapping migration, full 82-version source provenance, clean Jest, Windows state and four-role browser QA.

## CI evidence

Workflow: `.github/workflows/devbot-ag3-4d3-collect-payment-rpc.yml`. [Native source-replay run 43158144697](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43158144697) reports original-source HIGH-002 reproduced and scratch-candidate denial plus rollback, full/partial and concurrency PASS. It invokes seven offline safety checks, starts native Supabase CLI 3.0.0 only under `RUNNER_TEMP`, rebuilds C2 and D1, executes this new signed-JWT RPC test and destroys the scratch stack. A green isolated PR check is necessary before owner-authorized merge to `payment-module-finalization`.

**Live AG3.4E release gate must remain `NO_GO`.** D3.1 does not satisfy the `all_14_authenticated_rpc_negative_jwt_mutation_invariant_tests` requirement.

## Other live RPCs needing the next D3.2 regression

Read-only review of the deployed bodies finds the same NULL-unsafe `v_role NOT IN ('super_admin','academy_owner')` guard in **`approve_payment_correction`**, **`request_payment_correction`** and **`reject_payment_correction`**, each with academy-only checks guarded by `v_role = 'academy_owner'`. `review_parent_upi_payment` uses `v_role <> 'academy_owner'` followed by `academy_id <> private.current_academy_id()`, both nullable; it needs a negative real-JWT test. `record_accepted_parent_upi_submission` has a similar initial role comparator, but also a later NULL-safe `academy_id IS DISTINCT FROM current_academy_id()` check; do not claim the same data-plane exploit without testing. `submit_parent_upi_payment` has a nullable role comparator but subsequently requires a linked `public.parents` identity. Prioritize all these paths for D3.2 tests, then create a reviewed coordinated security migration, with explicit live-DDL approval and backup readiness.
