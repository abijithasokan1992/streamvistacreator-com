# Media Ingest Engine — Design Plan

A safety-first, resumable, checksum-verified ingest pipeline for DIT / studio / broadcast workflows. Preserves the existing `ingest_jobs` + `ingest_job_items` schema, OCI upload pipeline, and Supabase RLS. No new backend surface unless listed below.

## 1. Safety contract (non-negotiable)

- **Read-only source access.** Source `FileSystemDirectoryHandle` is opened with `mode: "read"`. `<input webkitdirectory>` fallback is inherently read-only. No `createWritable`, no `remove()`, no `move()` calls anywhere in the ingest path — enforced by a lint rule (`no-restricted-syntax`) on `src/lib/ingest/**`.
- **No source mutation.** We never rename, delete, or touch source mtime. Copy = read stream → OCI write. Verification reads the source a second time; it never writes back.
- **No unsafe permissions.** No `navigator.usb`, no `navigator.hid`, no elevated prompts, no native helpers. Everything runs inside the standard File System Access sandbox the user explicitly granted per-session.
- **Graceful device removal.** All reads are wrapped; `NotFoundError` / `NotReadableError` / `AbortError` transition the job item to `paused_device_lost` (new state), not `failed`, so resume works when the device is re-mounted.

## 2. Device coverage matrix

| Source | Path |
|---|---|
| SD / CFexpress / USB / SSD / HDD / RAID (mounted as a folder) | `showDirectoryPicker({ mode: "read" })` on Chromium; `<input webkitdirectory>` fallback on Firefox/Safari |
| NAS (SMB/AFP mounts) | Same — appears as a mounted folder to the OS |
| Phones / tablets over USB (MTP → mounted) | Same folder picker |
| Phones / tablets in-browser | Existing `SmartDropUploader` (already file-picker based) |
| Camera direct (CCU / C2C) | Existing `CameraToCloudIngest` component — untouched |

No native drivers, no OS bypass. If a device is not mounted by the OS, we surface a clear "Mount the device in Finder / Explorer / Files, then click Rescan" message.

## 3. Architecture

```text
 ┌─ Device picker ─────────┐    ┌─ Planner ──────────────┐    ┌─ Transfer worker pool ─┐
 │ scanDirectoryHandle()   │───▶│ classify + dedupe +    │───▶│ chunked read → OCI     │
 │ scanFileList()          │    │ format validation +    │    │ multipart upload +     │
 │ (existing)              │    │ manifest build         │    │ per-chunk SHA-256      │
 └─────────────────────────┘    └─────────┬──────────────┘    └───────────┬────────────┘
                                          │                               │
                                          ▼                               ▼
                                ┌────────────────────┐          ┌────────────────────┐
                                │ ingest_jobs (row)  │          │ ingest_job_items   │
                                │ + manifest JSONB   │◀────────▶│ status machine +   │
                                │ + resume_token     │          │ verify_state       │
                                └────────────────────┘          └────────────────────┘
```

New client modules (all under `src/lib/ingest/`, none touch existing files except to import):

- `deviceManifest.ts` — turns a `ScanResult` into a stable manifest keyed by `(relativePath, size, mtime)`; dedupes against prior `ingest_job_items` for the same workspace using the client-side SHA (small files) or `(size + head-1MB-hash)` fingerprint (large files).
- `formatPolicy.ts` — thin wrapper over existing `mediaIntelligence.classifyFile` + `supabase/functions/_shared/uploadValidation.ts` rules exposed to the client via a small mirrored constant. Rejects forbidden extensions before we open a job.
- `transferWorker.ts` — Web Worker that streams 8 MiB chunks, computes SHA-256 incrementally (`crypto.subtle` incremental via `@noble/hashes` sha256, already tree-shakeable), pushes each chunk through the existing `ociMultipartUpload` driver, and reports progress.
- `verifier.ts` — after all chunks land, re-reads the source file a second time to produce an independent whole-file SHA-256, compares to (a) the incremental hash from transfer, and (b) the server-side checksum the OCI pipeline already computes. Three-way match = `verified`. Two-of-three mismatch = `corrupt`, item quarantined, source untouched.
- `resumeController.ts` — persists a `resume_token` (job_id + per-item byte offsets + chunk ETags) in `ingest_jobs.metadata.resume` after every successful chunk. On reopen, we walk the manifest, skip items already `verified`, and continue in-flight items from their last acked chunk.
- `ingestEngine.ts` — orchestrator that stitches the above and exposes `startIngest()`, `pauseIngest()`, `resumeIngest()`, `cancelIngest()` to the UI.

## 4. Status machine (per item)

`queued → hashing → uploading → server_checksum → verifying → verified`
Side branches: `duplicate_skipped`, `format_rejected`, `paused_device_lost`, `paused_user`, `corrupt`, `failed`.

All states already fit `ingest_job_items.status` (text). New values are additive — no migration required beyond documenting them. The three "transient" states that drive polling (`hashing`, `uploading`, `verifying`) plug into the existing `IngestQCPanel` polling loop.

## 5. Duplicate detection

Two-tier:
1. **Local, pre-transfer:** manifest fingerprint = `size + first-1MB-SHA + last-1MB-SHA`. Matches within the current pick are collapsed; matches against prior `ingest_job_items` (queried by `workspace_id` + fingerprint stored in `metadata.fingerprint`) mark the item `duplicate_skipped` before any upload.
2. **Server, post-transfer:** existing OCI pipeline's full checksum stays authoritative. A late duplicate is retagged `duplicate_skipped` and the OCI object is garbage-collected by the existing lifecycle rule.

## 6. Corruption protection

- Chunk-level SHA-256 sent with each multipart part; OCI rejects mismatched parts (existing behavior).
- Whole-file SHA-256 computed twice on the client (streaming during upload + independent re-read in `verifier.ts`).
- Server-side checksum from the existing pipeline is the third witness.
- Any 2-of-3 disagreement → item `corrupt`, transfer halted for that item only, source never touched, UI surfaces which witness disagreed.

## 7. Resume

- `ingest_jobs.metadata.resume = { version: 1, items: { [item_id]: { uploadId, parts: [{n, etag, sha}], offset } } }`
- Written after each acknowledged chunk (throttled to 1/s).
- On page reload / device replug, `resumeController.rehydrate(jobId)` loads the token, verifies each item's source still matches its manifest fingerprint (size + mtime + head hash), and resumes. If the source changed, the item goes to `source_changed` and waits for user decision — we never silently re-upload.

## 8. UI

New route: `/studio/ingest/engine` (studio-scoped). Three panels:

- **Source panel** — picker button, mounted-device summary (label, family from existing `deviceScanner`, total bytes, format list), Rescan, Eject-safe indicator.
- **Plan panel** — manifest table: filename, size, detected type, fingerprint status (new / duplicate / rejected), destination bucket/prefix. Bulk actions: exclude, mark as proxy, override category (only where confidence < 0.6).
- **Transfer panel** — per-item progress bars, throughput, ETA, verify state (3-way witnesses shown as tiny badges), pause/resume/cancel, detailed log drawer with copy-to-clipboard and CSV export.

All panels use existing Studio Professional dark tokens (`zinc-950` surface) — no hardcoded colors.

## 9. Backend touchpoints (minimal)

- **No schema migration.** All new fields live inside existing JSONB (`ingest_jobs.metadata`, `ingest_job_items.metadata`).
- **No new edge function.** Uses existing `oci-multipart` init/complete + existing `run-qc-scan` post-ingest.
- **RLS unchanged.** All writes go through the client under the user's JWT; existing policies on `ingest_jobs` / `ingest_job_items` scope by `owner_user_id` / `workspace_id`.

## 10. Observability

- Every state transition writes an `ingest_telemetry` row (table already exists) with `event`, `item_id`, `bytes`, `duration_ms`, `witness_a/b/c` hashes truncated to 12 chars.
- Client console logs are structured JSON behind a `DEBUG_INGEST` flag; never on by default.

## 11. Out of scope (called out explicitly)

- No LTO / tape offload — different pipeline.
- No on-device transcoding — proxies remain server-side.
- No auto-eject — OS-owned.
- No background-tab transfers on Safari (browser limitation) — we surface a "keep this tab open" banner.

## 12. Rollout

1. Land `src/lib/ingest/{deviceManifest,formatPolicy,transferWorker,verifier,resumeController,ingestEngine}.ts` with unit tests (fingerprint, resume-token round-trip, 3-way verify).
2. Land `/studio/ingest/engine` route + three panels.
3. Feature-flag behind `entity_profile.studio_ext.features.ingest_engine_v2` so existing `CameraToCloudIngest` stays default until QA passes.
4. Enable for internal studios, then GA.

No files are changed in this plan step. On approval I implement modules 1–2 first, wired to a feature flag, without touching the existing ingest components.
