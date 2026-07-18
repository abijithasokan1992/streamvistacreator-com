/**
 * Focused reliability tests for this batch. Kept dependency-free so they
 * run in the standard vitest environment without hitting Supabase.
 *
 *  A) platform-readiness — each metric fails in isolation.
 *  B) MCP fallback       — schema-drift errors become structured unavailable.
 *  C) DIT bucket SQL     — pending migration is idempotent + private.
 *  D) Email sweep split  — audit-only failure ≠ sweep failure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isSchemaMissingError, unavailable } from "@/lib/mcp/lib/control";

const readFn = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("A) platform-readiness metric isolation", () => {
  const src = readFn("supabase/functions/platform-readiness/index.ts");

  it("does not reference removed columns ingest_telemetry.successful / deal_memos.signed_at", () => {
    expect(/ingest_telemetry[\s\S]{0,200}\.successful/.test(src)).toBe(false);
    // The prose comment mentions `signed_at` as an explanation, but the code
    // must not read or write that column.
    expect(/\.signed_at\b/.test(src)).toBe(false);
    expect(/["']signed_at["']/.test(src)).toBe(false);
  });

  it("uses severity-based derivation for ingest_telemetry health", () => {
    expect(src).toMatch(/ingest_telemetry[\s\S]*severity/);
  });

  it("uses approval_status as the deal-memo signed proxy", () => {
    expect(src).toMatch(/deal_memos[\s\S]*approval_status[\s\S]*approved/);
  });
});

describe("B) MCP tool schema-drift fallback", () => {
  it("classifies PostgREST undefined_column as schema-missing", () => {
    expect(isSchemaMissingError({ code: "42703", message: "column x does not exist" })).toBe(true);
    expect(isSchemaMissingError({ code: "42P01", message: "relation y does not exist" })).toBe(true);
    expect(isSchemaMissingError({ message: "Could not find the 'foo' column of 'bar'" })).toBe(true);
  });

  it("does not classify unrelated DB errors as schema-missing", () => {
    expect(isSchemaMissingError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isSchemaMissingError(null)).toBe(false);
  });

  it("unavailable() returns a structured non-error envelope", () => {
    const r = unavailable({ failed_emails: [], count: 0 }, "email_send_log schema drift");
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toMatchObject({
      unavailable: true,
      reason: "email_send_log schema drift",
      failed_emails: [],
      count: 0,
    });
  });
});

describe("C) DIT pending storage migration", () => {
  const sql = readFn(
    "supabase/migrations-pending/20260718_000000_dit_ingest_screenshots_bucket.sql",
  );

  it("provisions a PRIVATE bucket (never public)", () => {
    expect(sql).toMatch(/dit-ingest-screenshots[\s\S]*false/);
    expect(/public\s*=\s*true/i.test(sql)).toBe(false);
  });

  it("is idempotent — ON CONFLICT + DROP POLICY IF EXISTS", () => {
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "dit_screenshots_owner_read"/);
  });

  it("scopes owner policies to the caller's auth.uid folder prefix", () => {
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  });

  it("grants admin/QC READ-ONLY (no INSERT/UPDATE/DELETE admin policy)", () => {
    expect(sql).toMatch(/"dit_screenshots_admin_read"[\s\S]*FOR SELECT/);
    expect(/dit_screenshots_admin_(insert|update|delete)/.test(sql)).toBe(false);
  });
});

describe("D) retry-failed-emails: sweep vs audit split", () => {
  const src = readFn("supabase/functions/retry-failed-emails/index.ts");

  it("distinguishes sweep_status from audit_status", () => {
    expect(src).toMatch(/sweep_status/);
    expect(src).toMatch(/audit_status/);
  });

  it("returns HTTP 2xx when sweep succeeded but audit persist failed", () => {
    // The status is 502 only when `sweepFailed`, otherwise 200.
    expect(src).toMatch(/httpStatus\s*=\s*sweepFailed\s*\?\s*502\s*:\s*200/);
  });

  it("returns non-2xx on unhandled sweep crash", () => {
    expect(src).toMatch(/status:\s*500/);
    expect(src).toMatch(/sweep_status:\s*"failed"/);
  });
});
