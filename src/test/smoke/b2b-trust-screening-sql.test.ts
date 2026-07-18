import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screenerPath = resolve(__dirname, "../../../supabase/migrations-pending/20260718_030000_b2b_screener_and_storage_lifecycle.sql");
const sealsPath = resolve(__dirname, "../../../supabase/migrations-pending/20260718_031000_title_trust_seals.sql");
const screener = readFileSync(screenerPath, "utf8");
const seals = readFileSync(sealsPath, "utf8");

describe("B2B trust and one-time screening pending SQL", () => {
  it("keeps both migrations pending", () => {
    expect(screenerPath).toMatch(/migrations-pending/);
    expect(sealsPath).toMatch(/migrations-pending/);
  });

  it("uses one view by default and an atomic begin function", () => {
    expect(screener).toMatch(/max_views[^;]*default\s+1/i);
    expect(screener).toMatch(/screening_begin_verification/i);
    expect(screener).toMatch(/for\s+update/i);
  });

  it("locks verification on completion and supports admin-only reset with reason", () => {
    expect(screener).toMatch(/verification_locked_at/i);
    expect(screener).toMatch(/admin_reset_screening_verification/i);
    expect(screener).toMatch(/reset reason|required/i);
  });

  it("tracks Oracle and AWS lifecycle without moving or deleting objects", () => {
    expect(screener).toMatch(/asset_storage_lifecycle/i);
    expect(screener).toMatch(/oracle|oci/i);
    expect(screener).toMatch(/aws/i);
    expect(screener).not.toMatch(/delete\s+from\s+public\.asset_storage_lifecycle/i);
  });

  it("binds QC and Legal seals to a stable version fingerprint", () => {
    expect(seals).toMatch(/title_trust_seal_kind/i);
    expect(seals).toMatch(/version_fingerprint\s+text\s+not\s+null/i);
    expect(seals).toMatch(/title_trust_seals_one_live_version/i);
  });

  it("will not issue a seal before the corresponding admin status passes", () => {
    expect(seals).toMatch(/_qc\s*<>\s*'passed'/i);
    expect(seals).toMatch(/_legal\s*<>\s*'cleared'/i);
  });

  it("requires privileged role checks and a revocation reason", () => {
    for (const role of ["admin", "super_admin", "platform_owner", "founder"]) {
      expect(seals).toContain(`has_role(auth.uid(), '${role}')`);
    }
    expect(seals).toMatch(/revocation reason is required/i);
  });

  it("does not grant seal writes directly to authenticated users", () => {
    expect(seals).toMatch(/grant\s+select\s+on\s+public\.title_trust_seals\s+to\s+authenticated/i);
    expect(seals).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*title_trust_seals[^;]*authenticated/i);
  });

  it("contains no destructive title SQL", () => {
    for (const sql of [screener, seals]) {
      expect(sql).not.toMatch(/delete\s+from\s+public\.content_titles/i);
      expect(sql).not.toMatch(/truncate/i);
      expect(sql).not.toMatch(/drop\s+table\s+public\.content_titles/i);
    }
  });
});
