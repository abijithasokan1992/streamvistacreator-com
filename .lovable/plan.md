# Simplified Ingest Workflow

Preserve the existing StreamVista layout, navigation, styling, and page structure. All changes are additive: a new automated ingest surface layered inside the existing Ingest page and Storage page, plus background workers.

## User-visible surface (no redesign)

Inside the current Ingest page (`src/components/studio/ingest/StudioIngest.tsx`) add one new panel — **"Auto Ingest"** — placed at the top of the existing tab, using the current Card/Button/Tabs primitives. The existing manual dialogs (`IngestMediaDialog`, `HardDiskIntakeDialog`, `CameraToCloudIngest`) stay untouched as advanced fallbacks.

The Auto Ingest panel shows exactly three states:

1. **Waiting for device** — instructions plus a "Connect device" button that opens the browser File System Access picker (or falls back to file input).
2. **Device detected** — device label, detected clip count, total size, camera type guess, a production dropdown pre-filled with the current active production, and a single **Start Import** button.
3. **Importing** — a compact progress row: filename, % complete, upload speed, ETA, plus a "Details" link that opens the existing IngestTimeline.

Everything else the user asked for (checksums, dedupe, resume, proxy, thumbnails, metadata, retries) runs in the background and only surfaces as a toast if manual action is required.

The Storage page (`src/pages/dashboards/StudioAdvancedSettings.tsx` / existing storage widgets) gets one additional read-only strip — **"Live ingest"** — showing: storage used, object count, active uploads, queue depth, current speed, last upload, proxy queue, OCI health dot. No new page, no layout change.

## Detection flow

Browser supports two device paths:

- **File System Access API** (Chrome/Edge on desktop): `showDirectoryPicker()` returns a directory handle. We walk it, group by top-level folder (matches ARRI/RED/BMD card layouts), sniff for signature paths (`XDROOT/`, `PRIVATE/AVCHD/`, `CLIP/`, `DCIM/`, `RDC/`, `A001_...`) to label the camera family, and list media files by extension.
- **Fallback** (`<input type="file" webkitdirectory multiple />`): same walker, no persistent handle — user re-picks on retry.

Supported extensions map to the requested formats: `.ari .arx` (ARRIRAW), `.r3d` (RED), `.braw` (Blackmagic), `.crm` (Canon RAW Light), `.dng` (CinemaDNG sequence), `.mov .mp4 .mxf` (ProRes/DNxHR/H.264/H.265 wrappers). Resolution and codec are read from the file container later, server-side.

## Background pipeline

The existing `ingest_jobs` / `ingest_job_items` / `ingest_telemetry` tables already model this. We add:

- `client_checksum` (bytea) and `dedupe_key` on `ingest_job_items` so duplicates against past imports are skipped without re-upload.
- `proxy_status`, `thumbnail_status`, `technical_metadata` (jsonb) on `ingest_job_items` — populated after upload finishes.
- `resume_token` on `upload_sessions` for OCI multipart resume (column already partially exists — verify and reuse).

Client work per file (Web Worker):

1. Stream the file, compute SHA-256 in chunks (checksum + dedupe key).
2. Ask edge function `ingest-start` for an OCI multipart URL set; if the checksum already exists under this workspace, mark item `duplicate` and skip.
3. Upload parts to OCI directly via presigned URLs (existing `src/lib/ociMultipartUpload.ts`), reporting progress back to `ingest_telemetry` every N MB.
4. On network error, exponential backoff up to 5 tries; store `resume_token` so a page reload picks up where it left off.
5. On completion, call `ingest-complete` which enqueues proxy + thumbnail + metadata extraction (server-side via existing job runner).

The original bytes are only ever read, never written — we never touch the source directory handle in write mode.

## Camera-to-Cloud (scaffold only)

Add a stub edge function `c2c-session` that mints a short-lived ingest token bound to a production + workspace. The existing `CameraToCloudIngest.tsx` component gets a "Connect" button wired to this endpoint but the actual wireless transport is not built in this pass — everything after token mint reuses the same background pipeline.

## Files touched

- New: `src/components/studio/ingest/AutoIngestPanel.tsx` (the 3-state UI).
- New: `src/lib/ingest/deviceScanner.ts` (directory walker + camera sniff).
- New: `src/lib/ingest/checksumWorker.ts` (Web Worker for SHA-256).
- New: `src/lib/ingest/autoIngestPipeline.ts` (orchestrates upload + retries).
- New: `src/components/studio/ingest/LiveIngestStrip.tsx` (read-only storage widget).
- Edit: `src/components/studio/ingest/StudioIngest.tsx` — mount `AutoIngestPanel` at top of existing tab; no other change.
- Edit: existing Storage page — mount `LiveIngestStrip` inside the current card grid.
- New edge functions: `ingest-start`, `ingest-complete`, `ingest-proxy` (proxy generation kicker), `c2c-session`.
- Migration: additive columns on `ingest_job_items` and `upload_sessions` — no destructive schema change.

## Out of scope for this pass

- Actual server-side proxy transcoding (needs a media worker — we stub the job row and mark `pending`).
- NAS discovery (listed as future in the request).
- Wireless C2C transport (scaffold only).
- Any change to global navigation, dashboard layout, colors, or typography.

## Confirm before I start

1. Auto-select the "current active production" from the last-viewed production in `productions` — OK, or require explicit selection every time?
2. OCI multipart uploads already work in the codebase — I'll reuse `ociMultipartUpload.ts` as-is. Confirm this is still the intended path (vs. edge-function proxied uploads).
3. Proxy generation: leave the server side as a stub (row marked `pending`) for now, or is a media worker already running that I should hook into?
