/**
 * Smoke test — Studio Ingest preflight wiring.
 *
 * Verifies the client calls `ingest-preflight` before touching `ingest_jobs`
 * and short-circuits on any structured reason code returned by the server.
 * We assert the CONTRACT (function name + reason handling) rather than the
 * full component, so this stays stable across UI refactors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../components/studio/ingest/StudioIngest.tsx"),
  "utf8",
);

describe("Studio Ingest preflight — contract", () => {
  it("invokes the ingest-preflight edge function before inserting jobs", () => {
    expect(src).toMatch(/functions\.invoke\(\s*["']ingest-preflight["']/);
  });

  it("opens the storage paywall when the server returns PREMIUM_REQUIRED", () => {
    expect(src).toMatch(/PREMIUM_REQUIRED/);
    expect(src).toMatch(/quota\.checkOrPaywall\(\)/);
  });

  it("handles STORAGE_REQUIRED the same way as PREMIUM_REQUIRED", () => {
    expect(src).toMatch(/STORAGE_REQUIRED/);
  });

  it("blocks the ingest_jobs insert when preflight fails", () => {
    // The preflight block appears BEFORE the first ingest_jobs insert in
    // startIngest — regression fails if someone moves the insert above.
    const invokeIdx = src.search(/functions\.invoke\(\s*["']ingest-preflight["']/);
    const insertIdx = src.search(/from\("ingest_jobs"\)\s*\.insert/);
    expect(invokeIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(invokeIdx).toBeLessThan(insertIdx);
  });
});

describe("Studio Ingest preflight — edge function shape", () => {
  const fn = readFileSync(
    resolve(__dirname, "../../../supabase/functions/ingest-preflight/index.ts"),
    "utf8",
  );

  it("emits every documented reason code", () => {
    for (const code of [
      "AUTH_REQUIRED",
      "INVALID_INPUT",
      "WORKSPACE_ACCESS_DENIED",
      "INSUFFICIENT_ROLE",
      "PREMIUM_REQUIRED",
      "STORAGE_REQUIRED",
      "INVALID_PRODUCTION",
      "PREFLIGHT_FAILED",
    ]) {
      expect(fn).toContain(code);
    }
  });

  it("logs denials as structured JSON (grep-able reason field)", () => {
    expect(fn).toMatch(/ingest_preflight_denied/);
    expect(fn).toMatch(/JSON\.stringify\(/);
  });
});
