# Analytics V2 — Phase E1 Academy Owner UI Integration

## Scope

This checkpoint integrates the authenticated Analytics V2 preview into the Academy Owner Analytics experience on the feature branch. It does not deploy the Edge Function, publish snapshots, modify database schema, or change production data.

## Implemented

- Added frontend/src/services/analyticsV2Service.js, which invokes generate-analytics-snapshot using the signed-in user's existing Supabase session through supabase.functions.invoke.
- Added frontend/src/pages/AcademyOwnerAnalyticsV2.js and its responsive stylesheet.
- Academy Owners now see a month selector and monthly KPI view for:
  - supported present/absent marks and recorded-mark rate;
  - unsupported attendance status and missing schedule reference diagnostics;
  - recorded collections, signed adjustments, recorded expenses and net recorded cash movement;
  - current ledger outstanding and explicitly unavailable historical outstanding;
  - quality labels and metric caveats.
- The UI explicitly states that recorded-mark rate is not expected-session attendance coverage, and that current outstanding is not historical month-end outstanding.
- Analytics.js routes Academy Owners to the V2 preview page. Existing Super Admin Analytics remains on its existing service and page flow; other roles retain their prior route behavior.
- Added a free GitHub Actions frontend production-build job to the existing validation workflow.

## Validation

Latest code validation: workflow run #31, https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/40988228730.

- Deno helper, ownership and authorization test job: **passed**.
- Edge Function type-check: **passed**.
- Disposable PostgreSQL 17 scope-isolation fixture: **passed**.
- React production build (npm ci + npm run build): **passed**.
- Workflow conclusion: **success**.

The earlier UI commit also passed the React production build in workflow run #27. Run #31 validates the subsequent bearer-token parsing hardening as well.

## Not yet verified

- The Edge Function has not been deployed; the live Supabase project currently has no deployed Analytics preview function.
- No live signed-in Academy Owner request has been made against a deployed function.
- No browser visual QA or mobile device QA has been performed.
- No end-to-end tenant isolation test has been run against a deployed Supabase Edge Function.
- The page is expected to return an invocation error until the function is deployed. Do not merge/release the frontend independently of the matching function deployment.

## Next controlled step

Perform a code review of the new page/service and verify the existing app's mobile layout conventions. Then obtain explicit approval before deploying the preview function. After deployment, test with an Academy Owner account and verify that missing JWT, non-owner role, missing academy profile and cross-academy scope are rejected, while the matching Academy Owner can view their own academy metrics. Keep the existing Super Admin Analytics regression checks in the release checklist.
