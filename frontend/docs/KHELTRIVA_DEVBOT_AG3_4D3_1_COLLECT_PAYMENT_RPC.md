# AG3.4D3.1 — Real signed-JWT collect_payment execution regression

**State:** implementation staged for CI on isolated development branch; **NOT yet validated** until native Actions succeeds. Only one of fourteen public authenticated `SECURITY DEFINER` RPCs is in this test scope. Not a production release approval.

## Source and test contract

Read-only inspected deployed `public.collect_payment(uuid,numeric,text,text)` (source MD5 `fcc5610c509392caf81ffa99b82051a9`) and `private.next_payment_number(text,date)` (`b5b81f242c8378bf91cbbfcf458ce5cb`). The SQL fixture installs these original `pg_get_functiondef` bodies unchanged in a fresh, *unlinked*, local Supabase PostgreSQL 17/GoTrue/PostgREST stack, following the passing AG3.4C2 and AG3.4D1 source-aligned read-policy fixtures. The fixture checks Postgres-normalized source MD5s before testing. It creates only invented identities and three invented payment dues, plus one additional synthetic due for concurrency.

Role cases exercised via **actual GoTrue-issued JWT HTTP calls**: same-Academy Owner accepts payment, Owner B cannot collect Academy A due, Coach/Parent/unmapped rejected, SA may collect both academies' dues, anonymous/bad tokens rejected. Financial invariants: zero/negative amount and bad mode rejected; overpayment rejected, partial/full transitions, second payment on already paid due denied, corresponding ledger row and receipt number generated.

A scratch-only trigger raises a controlled exception **after number allocation** on a specified test remark, verifying that payment state, inserts and payment-number counters roll back atomically. Two concurrent signed Owner calls targeting the same new 100-unit due at 70 each must yield exactly one committed payment, leaving 30 remaining. Expected rejection messages are checked (mere 400 status isn't accepted as role proof), and synthetic financial state is queried after each negative case.

## Strict boundaries

- D3.1 replicates **one** deployed RPC source and its deployed numbering helper, but not the entire hosted schema, payment triggers, notification side effects, every table constraint or the complete payment lifecycle.
- Failures from the original source under the minimal scratch schema should be diagnosed and corrected in the **fixture only**; never rewrite function logic to force tests green. If live source drift is discovered, stop and review separately.
- No call against hosted RPCs or customer financial rows; no hosted SQL DDL/DML, `main` or Vercel changes, service-role tokens, original migration replay or B4 activation.
- **Still blocked:** remaining 13 public callable RPCs, 16 Storage policy object tests, production HIGH-001 legacy Coach mapping migration, full 82-version source provenance, clean Jest, Windows state and four-role browser QA.

## CI evidence

Workflow: `.github/workflows/devbot-ag3-4d3-collect-payment-rpc.yml`. It invokes seven offline safety checks, starts native Supabase CLI 3.0.0 only under `RUNNER_TEMP`, rebuilds C2 and D1, executes this new signed-JWT RPC test and destroys the scratch stack. A green isolated PR check is necessary before owner-authorized merge to `payment-module-finalization`.

**Live AG3.4E release gate must remain `NO_GO`.** D3.1 does not satisfy the `all_14_authenticated_rpc_negative_jwt_mutation_invariant_tests` requirement.
