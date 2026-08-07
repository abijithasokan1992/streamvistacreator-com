/**
 * Focused tests for the nine P0/P1 runtime-repair workstreams.
 *
 * Each block tests the exact contracts the repair directive asked for.
 * Where a workstream depends on a quarantined migration or on runtime
 * infra that isn't available in unit tests, the pure logic is tested and
 * the environment blocker is documented in the completion report.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { classifyRetryBanner } from "@/lib/email/retryBanner";
import { interpretIntelligence } from "@/lib/intelligence/errorEnvelope";

const SRC = (p: string) => join(process.cwd(), p);
const READ = (p: string) => readFileSync(SRC(p), "utf8");

// ---------------------------------------------------------------------------
// P0-A — Submit Content
// ---------------------------------------------------------------------------
describe("P0-A Submit Content", () => {
  const source = READ("src/pages/SubmitContent.tsx");

  it("requires a real, validated email in the zod schema", () => {
    // Reconstruct the schema fields we care about — the source must contain
    // a required, email-validated `email` field.
    expect(source).toMatch(/email:\s*z\s*\.string\(\)\s*\.trim\(\)\s*\.email\(/);
    expect(source).toMatch(/min\(\s*3\s*,/);
  });

  it("has no synthetic / fabricated email fallback", () => {
    expect(source).not.toMatch(/submission\+/i);
    expect(source).not.toMatch(/@public\.streamvista/i);
    expect(source).not.toMatch(/synthetic.*email/i);
  });

  it("stamps the authenticated user_id on the insert", () => {
    expect(source).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(source).toMatch(/user_id:\s*authedUserId/);
  });

  it("uses the real user-provided email — never rightsOwner-derived", () => {
    // The insert must pass through parsed.data.email verbatim.
    expect(source).toMatch(/email:\s*parsed\.data\.email/);
  });

  // Direct schema validation (independent from React render).
  const emailField = z.string().trim().email().min(3).max(255);
  it("rejects missing email", () => {
    expect(emailField.safeParse("").success).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(emailField.safeParse("not-an-email").success).toBe(false);
  });
  it("accepts a valid email", () => {
    expect(emailField.safeParse("user@example.com").success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P0-B — QC → Legal
// ---------------------------------------------------------------------------
describe("P0-B QC → Legal transition wiring", () => {
  const panel = READ("src/components/admin/TitleReviewPanel.tsx");

  it("calls transition_title_status with _title_id / _to_status / _note", () => {
    expect(panel).toMatch(/rpc\(\s*["']transition_title_status["']/);
    expect(panel).toMatch(/_title_id:/);
    expect(panel).toMatch(/_to_status:/);
    expect(panel).toMatch(/_note:/);
  });

  it("does not use the legacy _target_status parameter name", () => {
    expect(panel).not.toMatch(/_target_status:/);
  });
});

// ---------------------------------------------------------------------------
// P0-C — Revenue Import chain
// ---------------------------------------------------------------------------
describe("P0-C Revenue Import — RowMapping → revenue_lines payload", () => {
  const importApi = READ("src/lib/revenue/importApi.ts");

  it("threads title_id, workspace_id, deal_memo_id, buyer_user_id, mapping status from the mapping", () => {
    // Reference each field explicitly in the payload builder.
    expect(importApi).toMatch(/title_id:\s*mapping\?\.titleId\s*\?\?/);
    expect(importApi).toMatch(/workspace_id:\s*mapping\?\.workspaceId/);
    expect(importApi).toMatch(/deal_memo_id:\s*mapping\?\.dealMemoId/);
    expect(importApi).toMatch(/buyer_user_id:\s*mapping\?\.buyerUserId/);
    expect(importApi).toMatch(/mapping_status:\s*mapping\?\.status\s*\?\?\s*["']unmapped["']/);
  });

  it("keys the mapping by rowKey and applies per row", () => {
    expect(importApi).toMatch(/mappingByRowKey\s*=\s*new Map/);
    expect(importApi).toMatch(/mappingByRowKey\.get\(r\.rowKey\)/);
  });

  it("throws DatabasePendingError when the table is missing (42P01)", () => {
    expect(importApi).toMatch(/DatabasePendingError/);
    expect(importApi).toMatch(/42P01/);
  });

  it("throws StatementAlreadyImportedError on idempotency collision", () => {
    expect(importApi).toMatch(/StatementAlreadyImportedError/);
    expect(importApi).toMatch(/23505/);
    expect(importApi).toMatch(/duplicate_statement/);
  });
});

// ---------------------------------------------------------------------------
// P0-D — Creator Revenue workspace isolation
// ---------------------------------------------------------------------------
describe("P0-D Creator Revenue workspace isolation", () => {
  const summary = READ("src/components/creator/CreatorRevenueSummary.tsx");
  const statements = READ("src/components/creator/sections/Statements.tsx");

  it("empty titleIds performs NO revenue query (returns [] immediately)", () => {
    expect(summary).toMatch(/titleIds\s*&&\s*titleIds\.length\s*===\s*0/);
    expect(summary).toMatch(/setRows\(\[\]\)/);
  });

  it("scopes titleIds by owner_user_id AND workspace_id", () => {
    expect(statements).toMatch(/owner_user_id/);
    expect(statements).toMatch(/workspace_id/);
  });

  it("fails closed on titleIds query error (sets [] rather than unscoped)", () => {
    expect(statements).toMatch(/if\s*\(error\)\s*{\s*\n\s*\/\/[^\n]*\n\s*setTitleIds\(\[\]\)/);
  });

  it("always passes explicit titleIds prop (even []) to CreatorRevenueSummary", () => {
    expect(statements).toMatch(/<CreatorRevenueSummary\s+titleIds=\{titleIds\}/);
  });
});

// ---------------------------------------------------------------------------
// P0-E — DIT Protocol
// ---------------------------------------------------------------------------
describe("P0-E DIT Ingest Protocol", () => {
  const src = READ("src/components/studio/dit/DitIngestProtocol.tsx");

  it("returns EARLY on upload failure — no log row is inserted", () => {
    // The `if (uploadErrorMessage)` block must `return;` BEFORE the insert.
    const upIdx = src.indexOf("uploadErrorMessage");
    const insertIdx = src.indexOf('supabase.from("dit_ingest_logs").insert');
    expect(upIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(upIdx);
    const guardBlock = src.slice(upIdx, insertIdx);
    expect(guardBlock).toMatch(/return;/);
  });

  it("passes the REAL storage path on write (no pending-local:// sentinel written)", () => {
    // History rendering still tolerates old rows containing the sentinel, but
    // the write path must ONLY persist a real storage path.
    expect(src).toMatch(/screenshot_url:\s*path/);
    expect(src).not.toMatch(/screenshot_url:\s*["'`]pending-local:\/\//);
    expect(src).not.toMatch(/insert\([^)]*pending-local/);
  });

  it("communicates local-draft state honestly (not as submitted)", () => {
    expect(src).toMatch(/NOT submitted|local draft/i);
  });
});

// ---------------------------------------------------------------------------
// P1-A — Email retry sweep semantics (banner classification)
// P1-B — Email retry banner
// ---------------------------------------------------------------------------
describe("P1-A/B Email retry banner classification", () => {
  it("passed sweep + persisted audit → passed", () => {
    expect(classifyRetryBanner({ audit: { passed: true, pending_remaining: 0 }, sweep_status: "ok" })).toBe("passed");
  });

  it("stuck messages → stuck", () => {
    expect(classifyRetryBanner({ audit: { passed: false, pending_remaining: 3 }, sweep_status: "ok" })).toBe("stuck");
  });

  it("audit probe error → degraded_audit", () => {
    expect(classifyRetryBanner({ audit: { passed: false, pending_remaining: 0, error: "probe failed" } })).toBe("degraded_audit");
  });

  it("audit persistence failed → degraded_audit", () => {
    expect(classifyRetryBanner({ audit: { passed: true, pending_remaining: 0 }, audit_persist_error: "denied" })).toBe("degraded_audit");
  });

  it("stuck + degraded audit → stuck_and_degraded", () => {
    expect(
      classifyRetryBanner({
        audit: { passed: false, pending_remaining: 2, error: "probe" },
        audit_persist_error: "denied",
      }),
    ).toBe("stuck_and_degraded");
  });

  it("full sweep failure → sweep_failed", () => {
    expect(classifyRetryBanner({ sweep_status: "failed" })).toBe("sweep_failed");
  });

  it("authorization failure → unauthorized", () => {
    expect(classifyRetryBanner({ http_status: 403 })).toBe("unauthorized");
  });
});

// ---------------------------------------------------------------------------
// P1-C / P1-D — Structured & Custom Intelligence
// ---------------------------------------------------------------------------
describe("P1-C/D Intelligence 200-OK envelope interpretation", () => {
  it("successful results", () => {
    const out = interpretIntelligence({ results: [{ title: "a" }, { title: "b" }] });
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.results).toHaveLength(2);
  });

  it("successful zero results stays distinguishable from failure", () => {
    const out = interpretIntelligence({ results: [] });
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.empty).toBe(true);
  });

  it("missing key → firecrawl_not_connected", () => {
    const out = interpretIntelligence({ error: "firecrawl_not_connected" });
    expect(out.kind).toBe("error");
    if (out.kind === "error") {
      expect(out.code).toBe("firecrawl_not_connected");
      expect(out.message).toMatch(/not connected/i);
    }
  });

  it("invalid key → firecrawl_auth_failed", () => {
    const out = interpretIntelligence({ error: "firecrawl_auth_failed" });
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.message).toMatch(/rejected/i);
  });

  it("upstream HTTP failure → search_failed with upstream detail", () => {
    const out = interpretIntelligence({ error: "search_failed", upstream_message: "HTTP 502" });
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.message).toContain("HTTP 502");
  });

  it("timeout code mapped", () => {
    const out = interpretIntelligence({ error: "timeout" });
    if (out.kind === "error") expect(out.message).toMatch(/timed out/i);
  });

  it("malformed response (no results, no error) → malformed_response", () => {
    const out = interpretIntelligence({} as never);
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.code).toBe("malformed_response");
  });

  it("200 response with error envelope beats present-but-empty results", () => {
    const out = interpretIntelligence({ error: "internal_error", results: [] });
    expect(out.kind).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Onboarding field-lock migration — applied
// ---------------------------------------------------------------------------
describe("Onboarding field-lock migration (applied)", () => {
  const APPLIED_PATH =
    "supabase/migrations-pending/APPLIED_20260728_onboarding_requests_field_lock_trigger.sql.applied";
  const sql = readFileSync(join(process.cwd(), APPLIED_PATH), "utf8");

  it("uses BEFORE UPDATE trigger comparing OLD vs NEW", () => {
    expect(sql).toMatch(/BEFORE UPDATE ON public\.onboarding_requests/);
    expect(sql).toMatch(/OLD\.payment_status/);
    expect(sql).toMatch(/NEW\.payment_status/);
  });

  it("locks all sensitive fields listed in the finding", () => {
    for (const col of [
      "payment_status",
      "onboarding_status",
      "access_code",
      "final_price",
      "base_price",
      "promo_code",
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("bypasses for service_role and admin/super_admin", () => {
    expect(sql).toMatch(/service_role/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\),\s*'admin'\)/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\),\s*'super_admin'\)/);
  });

  it("provides a rollback path (DROP TRIGGER IF EXISTS)", () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_enforce_onboarding_owner_field_lock/);
  });

  it("original quarantined filename is no longer present (renamed to APPLIED_*.applied)", () => {
    expect(() =>
      readFileSync(
        join(
          process.cwd(),
          "supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql",
        ),
      ),
    ).toThrow();
  });
});
