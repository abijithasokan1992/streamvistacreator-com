import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const admin = fs.readFileSync(path.join(root, "src/pages/Admin.tsx"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/components/admin/AdminClassificationConsole.tsx"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase/migrations-pending/20260718_020000_admin_commercial_grading.sql"), "utf8");

describe("admin QC, legal and A/B/C classification", () => {
  it("keeps the existing submitted review workflow", () => expect(admin).toContain("ContentReviewWorkflow"));
  it("keeps dedicated QC and legal panels", () => {
    expect(admin).toContain('initialPanel="qc"');
    expect(admin).toContain('initialPanel="legal"');
  });
  it("adds one compact classification surface", () => expect(admin).toContain("<AdminClassificationConsole />"));
  it("supports title and partner grades separately", () => {
    expect(sql).toContain("content_grade");
    expect(sql).toContain("partner_grade");
  });
  it("limits grades to A B or C", () => expect(sql.match(/IN \('a','b','c'\)/g)?.length).toBeGreaterThanOrEqual(2));
  it("requires a reason and writes an audit record", () => {
    expect(sql).toContain("commercial_grade_audit");
    expect(sql).toContain("length(btrim(reason)) >= 3");
  });
  it("uses an admin-only RPC", () => {
    expect(sql).toContain("admin_set_commercial_grade");
    expect(sql).toContain("Admin access required");
  });
  it("does not auto publish, reject or delete", () => {
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.content_titles\s+SET\s+status/i);
  });
  it("keeps the migration pending", () => expect(sql).toContain("BEGIN;"));
  it("explains that grading is internal priority only", () => expect(ui).toContain("never auto-publishes, rejects, deletes, or changes user access"));
});
