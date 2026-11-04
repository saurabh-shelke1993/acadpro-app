# Player Photos — PH4 lifecycle cleanup and PH5 regression checkpoint

**Date:** 2026-11-04  
**Branch:** `payment-module-finalization`  
**Status:** PH4 replacement cleanup **implemented**, PH5 tests/source checks **authored**; latest-HEAD Jest, browser upload, Vercel and live authorization acceptance **pending**.

## Verified production baseline (read-only investigation)

Active project: `acadpro-db` (ID `ulyealhkmlorsbdiknrh`). The active `player-photos` bucket is **private**, existing file-size limit **2 MiB**, allowed types JPG/PNG/WebP. Read-only inspection on 4 Nov 2026 showed **three objects**, of which **two are referenced** by `players.profile_image`; one older PNG was unreferenced. The newly uploaded test-player image was **27,982 bytes (27.3 KiB), image/webp** after an approximately 5 MB original. No files or database rows were deleted or modified as part of this inspection.

Storage RLS inspection confirmed:
- `player_photos_owner_delete`: DELETE is allowed only to an authenticated Academy Owner within the current academy, for a canonical academy/player/filename path whose player belongs to their academy.
- `player_photos_authorized_read`: SELECT is scoped by valid academy/player object path and matching player row.
- `players_select` and `players_update` protect row reads/updates by Super Admin, academy and assigned-batch rules as appropriate.
- No additional backend permission grant, RLS policy, SECURITY DEFINER RPC or service-role credential was introduced.

The historical unreferenced PNG **was intentionally not removed**. The automatic cleanup operates only on a previous path observed during a new, successful photo replacement.

## PH4 — implemented replacement lifecycle

`frontend/src/services/playerPhotoService.js`:
1. Optimizes the original locally via PH1–PH3; uploads only <=150 KiB WebP.
2. Reads the currently stored `players.profile_image` for the exact player and academy with RLS, rather than trusting stale React state.
3. Uploads the unique new `academy_id/player_id/filename.webp` path with upsert disabled.
4. Conditionally updates the player row using both player/academy IDs **and the previously read photo path** (or `IS NULL`), returning the updated row to verify exactly one successful change. This prevents a concurrent replacement from silently overriding another photo.
5. On an update error/zero-result, re-reads the player's current path. The new upload is only deleted when the database can confirm it is **not** the current player photo. If the read is unavailable, it fails closed (may leave an unreferenced object rather than deleting a potentially active image).
6. After confirmed database success, obtains the private signed preview URL; if preview creation fails, the photo remains saved and a warning is returned.
7. Only the canonical *previous* path matching this **same player and academy**, with an allowed image extension and no nesting/traversal, is eligible for deletion (`utils/playerPhotoCleanup.js`). Malformed, external, cross-player or cross-academy paths are ignored.
8. Checks `players` within the authorized academy for **any remaining reference** to the old path. If any reference exists, or if verification fails, it retains the old object.
9. Uses the official Supabase **Storage API** `remove([path])` and validates the response. If removal fails, the new photo remains the saved photo and a nonfatal warning is returned. No SQL deletes against `storage.objects`.

Both Player Profile and Edit Player still invoke the same shared service. A nonfatal cleanup/preview warning is displayed as a **status notice** (not an upload failure), and notices reset when changing the selected player.

**Not included:** bulk deletion of historical orphans; removal of another player's photo; a new Storage permission grant; changing the Storage bucket's live size limit. Since the application already uploads <=150 KiB WebP, further defense-in-depth could lower the bucket limit from 2 MiB to **256 KiB** after reviewing any other clients. The available Supabase connector has no Storage bucket-update action. **Do not update `storage.buckets` directly using SQL**, which Supabase recommends treating as read-only.

## PH5 — tests authored

- `frontend/src/utils/playerPhotoOptimization.test.js`: **7** source tests (PH1 baseline): original 10 MB validation, resize/aspect ratio, adaptive WebP, size cap, decoded dimensions and failure handling.
- `frontend/src/utils/playerPhotoCleanup.test.js`: **4** source tests: correct player/academy match, foreign path rejection, current/empty/external path protection, traversal/nesting/invalid extension rejection.
- `frontend/src/services/playerPhotoService.test.js`: **14** source tests: WebP-only private upload, CAS update, first-time upload, shared reference retention, foreign-path skip, cleanup failure warning, reference check failure, failed update rollback, concurrency conflict, ambiguous network response after commit, no-read authorization failure, compression/oversize failure, signed URL failure, legacy JPG signed URL.

These are **25 authored Jest cases** in the three directly relevant files, **not a passing test report**. Earlier project tests are retained. No live write/delete test was executed through the connector.

## PH5 manual acceptance matrix — pending

| ID | Role / scenario | Expected |
| --- | --- | --- |
| PH5-01 | Academy Owner first upload | Valid JPG/PNG/WebP <=10 MB compressed and stored as <=150 KiB WebP; private signed preview works |
| PH5-02 | Academy Owner replacement | New object stored; player.profile_image updated; previous owned file removed via Storage API |
| PH5-03 | Old image not yet safely unreferenced | Previous file retained; new image remains usable; informative nonfatal warning |
| PH5-04 | Owner selects 10MB+ / unsupported / corrupt photo | Clear validation failure; original never uploaded |
| PH5-05 | Simultaneous replacements | Compare-and-set prevents losing update; rejected new object safely removed only after reference recheck |
| PH5-06 | DB update denied | New object rolled back if proven unreferenced; original current path retained |
| PH5-07 | Storage DELETE denied/error | Updated image still shown; old file retained; warning shown |
| PH5-08 | Signed URL fails | Record still updated; warning says preview unavailable; reload after permission/URL restored |
| PH5-09 | Legacy JPG/PNG reference | Existing private image continues loading via signed URL |
| PH5-10 | Coach / Parent / Super Admin | Existing roles unchanged; only Academy Owner has upload controls; unauthorized delete not possible |
| PH5-11 | Other academy player path | Never deleted, even if supplied as an untrusted old path |
| PH5-12 | Player Profile and Edit Player | Both use the shared upload, update state and display nonfatal notice |
| PH5-13 | 375px / tablet / desktop | Photo controls and status messages remain readable; no layout regressions |
| PH5-14 | Storage post-test audit | Verify MIME, size, correct path, object reference and deletion count; no unrelated objects removed |
| PH5-15 | Hardening | Existing 2 MiB bucket limit is **not** mistaken for a <=150 KiB server-side guarantee |

Use authorized, synthetic **test players** for replacement and delete scenarios. Never delete the three existing business photo objects just to validate PH5.

## PH5 final implementation review — 4 November 2026

**Development/test preparation:** COMPLETE. **Automated release verification:** NOT CONFIRMED. **Manual Owner/Coach/Parent and replacement/deletion acceptance:** PENDING.

- Reviewed the current player photo upload service, cleanup helper and optimizer plus 25 focused authored tests covering compression, new upload, path authorization, concurrent updates, shared references, rollback, delete failure and signed preview.
- Reviewed the active Supabase player's row security and private player-photo Storage policies (read-only). No schema, bucket, policy or production photo changes were made.
- Vercel deployment/build for commit `90f1365361cecdcc169ff2b03d029ff56a030924` reported **success**. Do not extrapolate that result to subsequent commits without checking them.
- Added a targeted GitHub Actions workflow at `.github/workflows/player-photo-validation.yml` which runs locked npm install, three focused Jest test files and production build on photo-related changes. The workflow's test regex and YAML were subsequently repaired and fetched back for verification in commit `4999396f594ad163f8a324ee495b80c2cdc139fb` (one build step, complete test command). The connected GitHub API only lists PR-triggered workflow runs, so **the push-run test outcome could not be confirmed here**. See <https://github.com/saurabh-shelke1993/acadpro-app/actions/workflows/player-photo-validation.yml>.
- The development phase is ready to hand off, but the project must **not** call PH5 tested or release-accepted until the focused CI results and controlled role/browser replacement verification are recorded.

## Exact current-branch validation commands (pending execution)

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false
npm run build
npm start
```

Optional scoped suite:
```bash
CI=true npm test -- --watchAll=false --runInBand --testPathPattern='(playerPhotoOptimization|playerPhotoCleanup|playerPhotoService)\.test\.js
```

Record the actual Jest counts/results, build result, test environment, exact SHA, Vercel deployment status and Academy Owner/Coach/Parent browser evidence before marking PH5 **tested** or **release-accepted**. No production schema, Storage bucket config, or RLS policy change is required for the implemented replacement cleanup.

```

Record the actual Jest counts/results, build result, test environment, exact SHA, Vercel deployment status and Academy Owner/Coach/Parent browser evidence before marking PH5 **tested** or **release-accepted**. No production schema, Storage bucket config, or RLS policy change is required for the implemented replacement cleanup.
