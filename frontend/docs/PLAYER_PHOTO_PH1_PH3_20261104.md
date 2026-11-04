# Player photo optimization — PH1 and PH3

**Date:** 2026-11-04  
**Branch:** `payment-module-finalization`  
**State:** Code and test source **implemented**; automated tests, browser acceptance and deployed verification **pending**.

## Decision and scope

Owners may choose **JPG/PNG/WebP originals up to 10 MB**. Before uploading, the browser resizes and encodes the image as WebP at a **maximum 512px longest dimension**. The algorithm aims for **100 KiB** and refuses to upload a file larger than **150 KiB**. Some complex photos will be between 100–150 KiB; no universal 50 KiB guarantee is made.

PH1 (compression) is wired at the existing **shared player-photo service boundary**. This minimal integration is necessary to deliver PH3's 10 MB UI safely: both existing Player Profile and Edit Player upload handlers already call `uploadPlayerPhoto` and now automatically use optimized output. The separate broader PH2 rollout needs no additional handler rewrite for these two surfaces. **PH4 old-object cleanup and bucket restriction changes remain deferred.**

## Implementation

- `frontend/src/utils/playerPhotoOptimization.js` (new): validate input MIME, reject empty/over-10 MB files, decode locally, reject invalid/over-50-megapixel dimensions, preserve aspect ratio, resize progressively from max 512px down to 256px, try decreasing WebP quality, return first <=100 KiB result, otherwise retain a <=150 KiB candidate; throw a clear error if WebP encoding or compression fails. Does not upload the original on failure.
- Browser decoder prefers `createImageBitmap`, releasing its memory afterward; older browsers use an object-URL `Image` fallback and revoke the temporary URL. Canvas encoding strips most source metadata; uploads use an encoded WebP, not the original image.
- `frontend/src/services/playerPhotoService.js`: the existing authorization context, storage bucket `player-photos`, academy/player object path prefix, private signed-URL resolution, player row update and rollback of **newly uploaded** objects on DB errors remain unchanged. The service now calls optimization first, independently rejects non-WebP or >150 KiB output, uploads `.webp` with `contentType: image/webp`, and only then updates `players.profile_image`.
- `frontend/src/pages/Players.js`: both Player Profile and Edit Player photo controls advertise **original up to 10 MB** and **optimized WebP max 150 KB**. Busy copy now says **Optimizing & uploading…**.
- Old JPG/PNG/WebP paths in database remain usable through the existing private bucket signed URL flow. No background migration, replacement or deletion was performed.

## Security/storage notes

- The active `player-photos` bucket was verified separately as private with a **2 MiB per-object limit**, allowing JPG/PNG/WebP. It has **not been modified** by PH1/PH3. A 10 MB local file never crosses the Storage upload boundary; only the <=150 KiB optimized WebP is sent by the application.
- The browser limit is a client-side application contract. A stricter Storage bucket-level limit, alternate clients and previous photo cleanup require a separate review (PH4); **do not claim bucket-level enforcement of 150 KiB yet**.
- RBAC and tenant security remain as before: upload controls are Academy Owner only and the database write retains the existing `player.id` + `academy_id` scope. RLS/Storage policies are unmodified.
- If an authorized player replaces a photo, **the old object remains** under the current implementation. PH4 should verify object ownership, references, delete policy and safe rollback before removing old objects.
- The safety guard refuses originals with >50 million decoded pixels even when file byte size is <=10 MB. Any unsupported/corrupt image and browsers without WebP encoding get a readable error; no original is uploaded as fallback.

## Tests authored, not executed

- `frontend/src/utils/playerPhotoOptimization.test.js` (**7** Jest tests): accepted/rejected original size/MIME, 512px aspect-preserving resize, adaptive quality, <=150 KiB fallback, oversized/non-WebP rejection, decoded-pixel guard and early validation.
- `frontend/src/services/playerPhotoService.test.js` (**5** Jest tests): WebP-only private upload, academy/player row predicates, signed URL, no upload on compression failure, malformed large output, new-object cleanup on DB update error and old private JPG path read.
- **These are authored test cases, not passing test reports.** GitHub connector can update source but does not run this React checkout.

## Manual regression — pending user review

| ID | Scenario | Expected |
| --- | --- | --- |
| PH-01 | Owner, Player Profile JPG 3–10 MB | Local optimization then WebP upload succeeds; photo updates without original 3–10 MB being stored |
| PH-02 | Owner, Edit Player PNG 3–10 MB | Same optimized service path and result |
| PH-03 | WebP original <=10 MB | Re-encoded or resized to <=150 KiB; path ends .webp |
| PH-04 | Large landscape/portrait photo | Aspect ratio maintained; longest dimension <=512px |
| PH-05 | Typical portrait photo | Approximately 50–100 KiB if feasible, never >150 KiB |
| PH-06 | Invalid GIF/HEIC/corrupt file, >10 MB file | Error; no uploaded object, no player row modification |
| PH-07 | Uncompressible image / browser without WebP | Clear error; no original fallback |
| PH-08 | DB update rejected | New object cleaned up by existing rollback path |
| PH-09 | Old player image | Previously stored JPG/PNG files still load through private signed URLs |
| PH-10 | Coach/Parent | Existing no-photo-upload permissions preserved |
| PH-11 | Replacement | New compressed photo visible; old object remains pending PH4 review |
| PH-12 | After test uploads | Check exact object content type/size/path in Supabase Storage; confirm no unexpected originals |

Use authorized **test player records only**; avoid modifying existing real academy photos solely for regression checks.

## Exact-current-head local validation

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

Keep PH1/PH3 marked **implemented, not runtime verified** until Jest, build, real browser photo upload and private Storage object metadata are checked. Full storage lifecycle cleanup (PH4) remains planned.
