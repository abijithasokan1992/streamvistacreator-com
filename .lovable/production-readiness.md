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

## Regression tests

- `src/test/smoke/studio-onboarding.test.tsx` — completeness rules + wizard/gate workspace alignment.
- `src/test/smoke/ingest-preflight.test.ts` — preflight call precedes any `ingest_jobs` insert; all reason codes present.

## Explicitly out of scope for this pass

- No RLS or schema changes to `ingest_jobs`, `entity_profiles`, or entitlements.
- No changes to Razorpay / OCI / proxy code paths.
- No new upload pipeline — preflight sits in front of the existing one.
