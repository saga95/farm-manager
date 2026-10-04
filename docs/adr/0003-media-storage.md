# ADR-0003: Private, tenant-scoped media storage

- **Status:** Accepted (2026-10-03)
- **Issue:** #20 · **SRS:** §15, §26.4, §41.12, AC-TN-004, PR-008

## Context

- Photos are farm records (PR-008). They must be **private**, separated per tenant, and served only to authorized members.
- List screens must use thumbnails, never full-size originals.
- A failed upload must never block or delete the structured record it belongs to (§41.12).
- Amplify Storage's access rules are **identity-** or **group-based** (`{entity_id}` = Cognito identity). They can't express "members of tenant T with `media.view`".

## Decision

1. **One private S3 bucket** (the Amplify `defineStorage` bucket), with **Block Public Access**, encryption at rest and **no public or guest paths**. The template's `uploads/*`, `assets/*` and `user/{entity_id}/*` rules are removed.
2. **The key layout:**
   ```text
   tenants/{tenantId}/farms/{farmId}/{category}/{entityType}/{entityId}/{mediaId}/original.{ext}
   tenants/{tenantId}/farms/{farmId}/{category}/{entityType}/{entityId}/{mediaId}/thumb.webp
   ```
   The categories come from §15: `TREE_PROFILE`, `HARVEST_PILE`, `DEHUSKED_SAMPLE`, `SALE_LOT`, `PAYMENT_EVIDENCE`, `POLYTUNNEL`, `CROP_PROGRESS`, `INVENTORY_ITEM`, `GENERAL`.
3. **Clients never get bucket credentials.** All access goes through authorized operations (ADR-0001):
   - **`initiateMediaUpload`** (entitlement `media.upload`):
     - checks that the target entity belongs to the caller's tenant;
     - creates a `Media` item with `status=PENDING` (ADR-0002);
     - returns a **presigned PUT URL** (5 min, exact key, `Content-Type` locked to `image/jpeg|png|webp|heic`, max 15 MB through a presigned POST policy).
   - **`completeMediaUpload`** does a `HeadObject` to verify the object, sets `status=UPLOADED` and links the media to the entity.
   - **`getMediaUrls`** (entitlement `farm.view`) returns **presigned GET URLs** (10 min) for thumbnails, or the original on request. Lists return thumbnails only.
4. **Thumbnails:**
   - An S3 `ObjectCreated` trigger on `…/original.*` runs a Lambda (arm64, `sharp`) that writes `thumb.webp` (max 480 px).
   - It also reads EXIF `DateTimeOriginal` into `capturedAt` when present; backfilled WhatsApp photos keep their original date (§15).
   - It sets `Media.thumbnailKey` and `status=READY`.
   - Originals have their EXIF GPS **removed from the thumbnail**. The original is kept untouched as evidence.
5. **Field resilience (§41.12):**
   - The structured record (e.g. TreeHarvest) is saved first and **never waits for media**.
   - The client keeps a durable upload queue (IndexedDB) of `{ mediaId (client ULID), entityId, blob }`. It retries `initiate → PUT → complete` with backoff.
   - `initiateMediaUpload` is idempotent on `mediaId` (ADR-0004), so retries never create duplicates.
   - Pending or failed uploads are shown on the record and can be retried by hand.
6. **Lifecycle rules:**
   - Incomplete multipart uploads and `PENDING` objects older than 7 days are cleaned up by a scheduled job.
   - Soft-deleted media is moved to `…/deleted/` and expired after 90 days.
   - Originals move to S3 Intelligent-Tiering after 30 days.

## Consequences

- ✅ Media follows exactly the same tenant and entitlement checks as data (AC-TN-004).
- ✅ Per-tenant export or move is `aws s3 sync s3://bucket/tenants/{tenantId}/`, which fits the dedicated-deployment note.
- ⚠️ Presigned URLs expire, so the client refreshes them via `listMedia` / `getMediaOriginalUrl` when an image fails to load.
- ⚠️ `sharp` needs a Linux arm64 build in the Lambda bundle. Pin the version and test bundling in CI (see the esbuild lesson, #118).
- Later: CloudFront with signed cookies, if image traffic justifies it.

## Amendment 1 (2026-10-04): thumbnails are made on the device

**Change to decision 4.** There is no `sharp` Lambda. The client makes the thumbnail:

- it draws the photo onto a canvas, at most 480 px on the long edge;
- it encodes the result as WebP, or as JPEG where the browser can't encode WebP (Safari);
- it uploads the thumbnail to `…/{mediaId}/thumb` next to the original, through a second presigned POST (any `image/*` type, max 512 KB).

`completeMediaUpload` checks that **both** objects exist (HeadObject) before it sets `status=READY`.

Why:

- `sharp` ships a native binary. It must be bundled for Linux arm64, and bundling has already broken an Amplify deploy (#118).
- Phones already decode the photo to show a preview, so making the thumbnail there costs nothing extra.
- Re-encoding through a canvas drops all EXIF data, so the thumbnail never carries GPS. The original is kept untouched as evidence.
- `capturedAt` is read on the device from EXIF `DateTimeOriginal` when present, with the file's last-modified time as the fallback. It is sent with `initiateMediaUpload`.

Other implementation notes:

- **IAM:** farm-api's IAM statement (`s3:PutObject`/`GetObject` on `tenants/*`, plus `ListBucket` limited to that prefix so a missing object returns 404) is attached in the function's own stack. That keeps the dependency one-way, data → storage.
- **Storage paths:** the template's `uploads/*`, `assets/*` and `user/{entity_id}/*` storage paths are removed.
- **Client views:** views never include storage keys, only presigned URLs.
- **Still to do:** the cleanup job for stale `PENDING` uploads and the lifecycle rules in decision 6.
