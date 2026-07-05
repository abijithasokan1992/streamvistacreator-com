# Production Readiness Checklist

Deployment: https://streamvista-creator.lovable.app · Custom: https://streamvistacreator.com

Static verification against the current repo. Live-only rows list the exact click path a reviewer needs on the deployed URL. Nothing here changes runtime behavior — the checklist is the artifact.

| Area | Status | Guarantee (code) | How to re-verify on deployment |
| --- | --- | --- | --- |
| **Studio onboarding — completes once** | Pass (static) | `isStudioOnboarded()` in `src/components/studio/StudioProfileOnboardingGate.tsx` checks all 7 activation fields + GSTIN when GST-registered. `justCompleted` flag hides the wizard immediately on save. | Sign in as a fresh studio → complete wizard → hard refresh `/dashboard/studio` → dashboard renders, no wizard. |
| **Studio onboarding — multi-workspace safe** | Pass (static) | Wizard now reads `useWorkspaces().activeId` (same source the gate uses). Wizard shows a "switch workspace" fallback if the user isn't owner/admin of the active one. Covered by `src/test/smoke/studio-onboarding.test.tsx`. | Log in as a user who owns two workspaces → complete onboarding in workspace A → switch to workspace B → refresh; each keeps its own state. |
| **Active Production persistence** | Pass (static) | `sv:active-workspace-id` in `localStorage` (`useWorkspaces`) + `sv:active-project-id` used by `StudioDash`. | Pick a Production → close tab → reopen → same Production is active. |
| **Studio Ingest — server preflight** | Pass (static) | `supabase/functions/ingest-preflight/index.ts` returns structured reason codes; `StudioIngest.startIngest` invokes it before any `ingest_jobs` insert. RLS remains the ultimate boundary. | Sign in as a workspace viewer → try Start Ingest → toast reads "Only workspace owners or admins can start an ingest." No RLS error in devtools. |
| **Studio Ingest — layout mode** | Pass (static) | 3-way required choice (Preserve / Metadata / Custom); Camera Card intake is locked to Preserve. `buildSubpath()` in `StudioIngest.tsx`. | Choose Camera Card → confirm the two other options are disabled with a tooltip. |
| **Storage allocation** | Pass (static) | `useStorageQuota` reads `workspace_storage_entitlements` + `workspace_storage_usage`. `checkOrPaywall()` opens `BuyVaultDialog`. | Fill quota to 100% in the UI → try to upload → paywall appears. |
| **Razorpay activation** | Needs Live Check | Client uses `create-storage-topup` / `create-vault-purchase` / `verify-storage-topup` — all present under `supabase/functions/`. Test-mode banner shown when `razorpay_config.mode = 'test'`. | Deployed → open Storage → "Buy 1TB" → complete Razorpay live test payment → confirm quota rises + invoice row appears in Billing. |
| **OCI upload — multipart** | Pass (static) | `src/lib/ociMultipartUpload.ts` used by both Studio Ingest and Creator `AssetUploader`. Idle sessions reclaimed by `oci-multipart-reclaim`. | Upload a > 128 MB file → progress bar advances → completes → object visible in Production Media. |
| **OCI upload — small object** | Pass (static) | Sub-threshold files POST to `functions/v1/oci-upload` with the same subpath. | Upload a 50 KB PNG → item marked completed in the same job. |
| **Proxy generation** | Needs Live Check | Existing pipeline unchanged — proxies are created by the OCI backend hook, surfaced via `title_screening_assets`. | Upload a `.mov` → wait for proxy job → open Production Media → 720p proxy plays inline. |
| **Production Media view** | Pass (static) | `StudioDash` lists `ingest_job_items` grouped by production. Detected type + confidence rendered by `DetectedItemsPanel`. | Open a completed job → expand → confidence + codec badges visible. |
| **Activity synchronization** | Pass (static) | `useIngestQueue` re-fetches on `startIngest` / completion; storage quota + queue refresh after upload finishes. Dialog auto-closes via `onCompleted`. | Start an ingest → dialog closes on completion → Recent Activity shows the new job without manual refresh. |

## Server-side reason codes (structured logs)

All emitted by `supabase/functions/ingest-preflight` as `event: "ingest_preflight_denied"`:

- `AUTH_REQUIRED`
- `INVALID_INPUT`
- `WORKSPACE_ACCESS_DENIED`
- `INSUFFICIENT_ROLE`
- `PREMIUM_REQUIRED`
- `STORAGE_REQUIRED`
- `INVALID_PRODUCTION`
- `PREFLIGHT_FAILED` (unexpected — inspect the paired `ingest_preflight_error` line)

Client-side surfaces emit the same taxonomy for cross-layer grep:

- `DUPLICATE_MEDIA` — sync pre-check found overlapping filenames+sizes in a prior card ingest. User is prompted before anything is created; nothing is overwritten.
- `UPLOAD_RESUME_REQUIRED` — a prior job for the same card is `paused`; UI offers to resume rather than fork.
- `OCI_CONNECTION_FAILED` — `mapUploadError()` maps low-level connectivity exceptions (ECONNREFUSED / ENOTFOUND / ETIMEDOUT / TLS) to a single production-safe string; the raw error is never surfaced.

## Error surface guarantees (Launch Hardening)

- Every ingest failure routes through `mapUploadError()` or an explicitly vetted safe pattern (`SAFE_PATTERN` in `StudioIngest.tsx`). No `toast.error(err.message)` in the catch-all.
- The edge function's error map (`FRIENDLY`) is the only source of UI copy for preflight denials. RPC / DB error messages, environment variables, OCI headers, and stack traces are never returned to the client.
- Structured telemetry (`event: "ingest_preflight_denied" | "ingest_job_failed" | "ingest_precheck_error"`) carries the reason code + workspace/user UUIDs only. No auth tokens, no OCI URLs, no request bodies.

## Regression tests

- `src/test/smoke/studio-onboarding.test.tsx` — completeness rules + wizard/gate workspace alignment; guards the multi-workspace loop fix.
- `src/test/smoke/ingest-preflight.test.ts` — preflight call precedes any `ingest_jobs` insert; all reason codes present.
- `src/test/smoke/ingest-preflight-telemetry.test.ts` — structured logs, HTTP status codes, and forbidden-log patterns for the edge function.
- `src/test/smoke/ingest-hardening.test.ts` — friendly-errors-only, `DUPLICATE_MEDIA` / `UPLOAD_RESUME_REQUIRED` telemetry, duplicate detection, resume prompt, activity sync, entitlement gates.
- `src/test/smoke/oci-connection-failure.test.ts` — `OCI_CONNECTION_FAILED` mapping, no sensitive fragments, retry pathway preserved.

## CI

`.github/workflows/regression.yml` runs the four smoke suites above on every push / PR to `main` and `staging`. Each step reports **PASS**, **FAIL**, or **Skipped** in the job summary; the workflow fails hard on any FAIL and prints a warning on any unexpected Skipped step.

## Production verification matrix

| Surface | Static guarantee | Live-deployment check |
| --- | --- | --- |
| Studio onboarding | `isStudioOnboarded()` + `useWorkspaces().activeId` alignment (tested) | New studio → complete wizard → refresh → dashboard opens without wizard |
| Active Production | `sv:active-workspace-id` + `sv:active-project-id` persisted (tested) | Pick Production → reopen tab → same Production selected |
| Storage | `useStorageQuota` reads entitlements + usage; `checkOrPaywall()` opens `BuyVaultDialog` | Fill quota → upload → paywall appears |
| Billing | `manual_invoices` + `billing_orders` unchanged; existing views intact | Buyer completes payment → invoice row appears |
| Razorpay | `create-storage-topup` / `verify-storage-topup` present; test-mode banner respected | Live test payment → quota rises + invoice appears |
| OCI upload | `uploadFileMultipart` + `oci-upload` edge fn; `ResumableUploadInterrupted` preserved for resume | > 128 MB upload finishes; pause + re-pick source resumes |
| OCI failure | `OCI_CONNECTION_FAILED` mapped to safe copy (tested); retry preserved | Simulate offline → toast is friendly, upload resumes on reconnect |
| Upload authorization | Preflight + RLS double-gate on workspace admin + premium entitlement | Viewer role → Start Ingest → friendly denial, no RLS leak |
| Duplicate detection | Pre-check reads `ingest_job_items` for the same card; prompts before creating (tested) | Re-offload a card → warning fires; nothing overwritten |
| Upload resume | Paused jobs surfaced via `UPLOAD_RESUME_REQUIRED` prompt (tested) | Pause mid-upload → re-pick source → confirm dialog offers resume |
| Proxy generation | Unchanged pipeline; surfaced in `DetectedItemsPanel` and `IngestTimeline` | Upload `.mov` → proxy job completes → 720p preview plays |
| Activity sync | `queue.refresh()` + `quota.refresh()` fire post-upload; timeline reads existing tables (tested) | Ingest completes → Activity + storage bar update without manual refresh |
| Production Media | `StudioDash` lists items grouped by production | Open completed job → confidence + codec badges visible |
| Editorial | `IngestTimeline` marks Editorial Ready when job is `completed` and no failures | Job completes clean → Editorial Ready step turns green |
| Archive | `archive_jobs` row created when `destination_type = archive_vault`; timeline reads status | Archive intake → timeline Archive Status transitions to completed |

## Explicitly out of scope for this pass

- No RLS or schema changes to `ingest_jobs`, `entity_profiles`, or entitlements.
- No changes to Razorpay / OCI / proxy code paths.
- No new upload pipeline — preflight sits in front of the existing one.

