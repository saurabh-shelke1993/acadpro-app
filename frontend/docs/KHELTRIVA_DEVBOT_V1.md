# Kheltriva DevBot V1 — Safe validation runner

**Status: AG1 approved and merged through [PR #3](https://github.com/saurabh-shelke1993/acadpro-app/pull/3) into payment-module-finalization, with post-merge CI PASS. AG2 real native Auth CI now PASS in a separate review branch (not merged).** This is a deterministic execution bot, not a paid autonomous AI programming agent.

## Available test suites

| Suite | Runs | Coverage limit |
| --- | --- | --- |
| quick | Runner's 7 pure self-tests | Does not test the app |
| auth-static | Runner self-tests + eight existing B2.9 Auth/RLS source-guard test files | No real GoTrue/JWT/RLS |
| frontend | Runner self-tests + npm ci, Jest, React build | Fake Supabase credentials only |
| all | All the above | Does not mean production sign-off |

Runs on a GitHub standard Ubuntu runner and publishes PASS/FAIL checks and duration to the **Actions job Summary** (no uploaded artifacts). User-supplied shell commands are not accepted: commands are hard-coded and test subprocesses get only a limited environment with non-production placeholders.

## Mobile workflow

The Owner can assign/approve a check from ChatGPT on the phone; code changes to the DevBot's own files trigger the scoped GitHub Actions push check on the `devbot-v1` branch. Read the green/red job and Summary in GitHub Mobile or browser without a laptop.

**Manual Run workflow limitation:** GitHub only exposes manual dispatch after the workflow is present on default branch `main`. We are **not** modifying `main` automatically because Vercel deploys from `main`. A future, explicitly approved minimal promotion enables direct manual launch from a phone.

## Cost and security safeguards

- Standard `ubuntu-latest` runner on the existing public repository; no large runner, paid AI API or Codespaces.
- Workflow token has only `contents: read`, and checkout does not persist credentials.
- No GitHub Actions artifacts, no hosted Supabase URLs/secrets, no deploy, no production write.
- No historical migration replay; no fake Auth substitute claimed as real JWT validation.
- All merges, role/RLS changes and deployments require explicit Owner approval.
- **Existing C3.4B2 laptop outcome remains pending separate read-only DB verification**; this DevBot must not touch or reset that disposable instance.
- Next AG2: real, disposable Supabase GoTrue/Auth and JWT testing on GitHub Actions, separately reviewed.

## AG1 CI evidence — 11 November 2026

- [Quick check 43003179195](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43003179195) **PASS** (cloud-hosted).
- [Full run 43003373047](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43003373047): runner self-tests, all eight B2.9 Auth/static safety groups, locked frontend installation and React production build passed. **Jest failed 16 tests / passed 474 tests** (4 failed suites / 43 passed suites).
- [Existing parent-branch frontend CI 42988928180](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42988928180) showed **the same 16 failures in four suites before DevBot existed**: PerformanceWorkspaceTabs, CoachProfile, PlayerPerformanceReport, CoachPerformanceAssessments.
- Push event uses the focused **auth-static** gate so the new bot's implementation is reviewed independently. The optional frontend and all suites still report existing Jest failures instead of suppressing them. Fixing those tests is a separate workstream.

## AG1 decision

**Implemented / CI tested:** Ready for owner review on feature PR #3. **Pending:** Owner approval and merge into `payment-module-finalization`; direct manual GitHub Actions button requires a separately approved default-branch workflow. 

## Acceptance criteria

AG1: GitHub self-test workflow passes from this branch, source diff is scoped to this bot/docs, and the Owner can read the result from phone. Direct phone manual trigger and autonomous AI coding remain future phases.

## AG2: real GoTrue integration (separate CI workflow)

[AG2 native Auth run 43022481533](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43022481533) **PASS** in an unlinked scratch Supabase stack on GitHub Actions. Test validates 3 real sessions and two synthetic academy_owner mappings. The AG1 allowlisted static Auth suite remains separate; AG2 uses its own real Supabase stack. Owner review/merge of AG2 pending. Positive/negative cross-academy PostgREST RLS is reserved for AG3. See [AG2 scope](KHELTRIVA_DEVBOT_AG2.md).
