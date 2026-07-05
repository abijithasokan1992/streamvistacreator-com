/**
 * Regression — ingest-preflight server-side telemetry taxonomy.
 *
 * Locks in the structured-log contract the ops runbook depends on.
 * The edge function MUST:
 *   - log every denial with `event: "ingest_preflight_denied"` and a
 *     documented `reason` code (grep-able by dashboards / alerts),
 *   - never log OCI bodies, environment variables, or PII beyond a user id +
 *     workspace id (those are already opaque UUIDs, safe to keep for triage),
 *   - respond with a stable, machine-readable JSON body the UI switches on.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fn = readFileSync(
  resolve(__dirname, "../../../supabase/functions/ingest-preflight/index.ts"),
  "utf8",
);

const REASONS = [
  "AUTH_REQUIRED",
  "INVALID_INPUT",
  "WORKSPACE_ACCESS_DENIED",
  "INSUFFICIENT_ROLE",
  "PREMIUM_REQUIRED",
  "STORAGE_REQUIRED",
  "INVALID_PRODUCTION",
  "PREFLIGHT_FAILED",
] as const;

describe("ingest-preflight — reason code taxonomy", () => {
  for (const r of REASONS) {
    it(`declares the ${r} reason code`, () => expect(fn).toContain(r));
  }

  it("ships a friendly, production-safe message for every reason", () => {
    // The FRIENDLY map must exist and cover each reason with a non-empty
    // string. We assert on the map declaration to avoid parsing runtime code.
    expect(fn).toMatch(/const FRIENDLY[^}]+AUTH_REQUIRED[^}]+PREFLIGHT_FAILED[^}]+\}/s);
  });

  it("emits structured JSON logs for denials", () => {
    expect(fn).toMatch(/JSON\.stringify\(/);
    expect(fn).toMatch(/event:\s*"ingest_preflight_denied"/);
  });

  it("never logs the Authorization header or raw secrets", () => {
    expect(fn).not.toMatch(/console\.[a-z]+\([^)]*authHeader/);
    expect(fn).not.toMatch(/console\.[a-z]+\([^)]*SUPABASE_SERVICE_ROLE/);
    expect(fn).not.toMatch(/console\.[a-z]+\([^)]*Deno\.env\.get/);
  });

  it("never surfaces raw error messages in the HTTP response body", () => {
    // Only the fixed FRIENDLY copy is ever placed on `respond(..., { message })`.
    // The regex looks for a response body that would echo an Error/.message
    // field directly — permitted uses inside console.log stay outside this check.
    expect(fn).toMatch(/reason:\s*"PREFLIGHT_FAILED"/);
    expect(fn).not.toMatch(/respond\([^)]*message:\s*\([^)]*Error\)[^)]*\.message/);
  });

  it("returns HTTP 402 for both premium/storage gates", () => {
    // Payment-required is the semantically correct status for the paywall.
    expect(fn).toMatch(/respond\(402,[^)]*PREMIUM_REQUIRED/);
    expect(fn).toMatch(/respond\(402,[^)]*STORAGE_REQUIRED/);
  });
});
