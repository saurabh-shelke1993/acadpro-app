# Kheltriva DevBot V1 — Safe validation runner

**Status: AG1 implemented in the isolated review branch; GitHub CI/Owner review pending.** This is a deterministic execution bot, not a paid autonomous AI programming agent.

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

## Acceptance criteria

AG1: GitHub self-test workflow passes from this branch, source diff is scoped to this bot/docs, and the Owner can read the result from phone. Direct phone manual trigger and autonomous AI coding remain future phases.
