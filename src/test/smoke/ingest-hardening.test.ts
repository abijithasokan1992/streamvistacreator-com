/**
 * Regression — ingest UX safety net.
 *
 * Static guards that keep the Studio Ingest error / telemetry surface safe:
 *   1. Terminal errors are never surfaced via `toast.error(err.message)`;
 *      every catch runs through `mapUploadError` or a vetted safe pattern.
 *   2. Sync pre-check emits structured `ingest_preflight_denied` telemetry
 *      with `DUPLICATE_MEDIA` and `UPLOAD_RESUME_REQUIRED` reason codes.
 *   3. Activity queue refreshes after completion (existing behaviour) so no
 *      manual refresh is required — `queue.refresh()` fires post-upload.
 *   4. Duplicate detection reads `ingest_job_items` for the same card before
 *      creating a new job; nothing is overwritten.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../components/studio/ingest/StudioIngest.tsx"),
  "utf8",
);

describe("Studio Ingest — friendly errors only", () => {
  it("does not leak raw exception messages via toast.error(err.message)", () => {
    // The catch-all was previously `toast.error((e as Error).message)` — the
    // sanitized version must run through mapUploadError or a SAFE_PATTERN.
    expect(src).not.toMatch(/toast\.error\(\s*\(e as Error\)\.message\s*\??\?\s*"Ingest failed"/);
    expect(src).toMatch(/mapUploadError/);
  });

  it("never surfaces raw stack traces to the UI", () => {
    expect(src).not.toMatch(/toast\.error\([^)]*\.stack/);
    expect(src).not.toMatch(/toast\.[a-z]+\([^)]*Deno\.env/);
  });
});

describe("Studio Ingest — structured telemetry", () => {
  it("emits DUPLICATE_MEDIA when a prior card ingest overlaps", () => {
    expect(src).toMatch(/reason:\s*"DUPLICATE_MEDIA"/);
    expect(src).toMatch(/event:\s*"ingest_preflight_denied"/);
  });

  it("emits UPLOAD_RESUME_REQUIRED when a paused job for the same card exists", () => {
    expect(src).toMatch(/reason:\s*"UPLOAD_RESUME_REQUIRED"/);
  });

  it("emits ingest_job_failed with a bounded code (no PII, no full stack)", () => {
    expect(src).toMatch(/event:\s*"ingest_job_failed"/);
    expect(src).toMatch(/code:\s*rawMsg\.slice\(0,\s*\d+\)/);
  });
});

describe("Studio Ingest — duplicate detection & resume", () => {
  it("queries prior ingest_job_items to detect duplicates before insert", () => {
    // Read the ingest_job_items table with file_name+size_bytes+metadata to
    // reuse existing checksum info — no new schema, no new logic.
    expect(src).toMatch(/from\("ingest_job_items"\)[\s\S]*file_name,size_bytes,metadata/);
    // Duplicate list is derived from a name+size Map lookup.
    expect(src).toMatch(/priorSet\.has\(/);
  });

  it("looks up paused jobs so upload resume path is offered, never silent", () => {
    expect(src).toMatch(/status === "paused"/);
    expect(src).toMatch(/Continue this new ingest anyway/);
  });

  it("refreshes the ingest queue after completion so Activity stays in sync", () => {
    // Queue refresh + storage refresh must both fire post-upload.
    expect(src).toMatch(/queue\.refresh\(\)/);
    expect(src).toMatch(/quota\.refresh\(\)/);
  });
});

describe("Studio Ingest — entitlement gates", () => {
  it("checks premium storage entitlement client-side before insert", () => {
    expect(src).toMatch(/has_premium_storage_entitlement/);
    expect(src).toMatch(/isPremiumEligible/);
  });

  it("requires workspace admin/owner to start an ingest", () => {
    expect(src).toMatch(/isWorkspaceAdmin/);
    expect(src).toMatch(/Only workspace owners or admins/);
  });

  it("routes storage/premium denials through the paywall, not a hard error", () => {
    expect(src).toMatch(/quota\.checkOrPaywall\(\)/);
  });
});
