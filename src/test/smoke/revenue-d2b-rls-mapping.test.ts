/**
 * Phase D2B — RLS/workspace isolation, mapping, reconciliation, idempotency
 * and SQL guardrail tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeStatement, bookMyShowAdapter } from "@/lib/revenue/normalize";
import { proposeMappings, canConfirmImport } from "@/lib/revenue/mapping";
import type { TitleCandidate, DealCandidate } from "@/lib/revenue/mapping";
import { reconcile } from "@/lib/revenue/reconciliation";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations-pending/20260717_010000_revenue_statement_import.sql"),
  "utf8",
);

// ---------- SQL guardrails (workspace isolation, least privilege) --------

describe("D2B SQL guardrails", () => {
  it("drops the earlier broad admin ALL policies", () => {
    expect(SQL).toMatch(/DROP POLICY IF EXISTS "admins manage revenue imports"/);
    expect(SQL).toMatch(/DROP POLICY IF EXISTS "admins manage revenue lines"/);
    expect(SQL).toMatch(/DROP POLICY IF EXISTS "owners view own revenue lines"/);
  });
  it("revokes blanket writes from authenticated on both revenue tables", () => {
    expect(SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.revenue_imports FROM authenticated/);
    expect(SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.revenue_lines FROM authenticated/);
  });
  it("only privileged roles may INSERT/UPDATE either table", () => {
    for (const t of ["revenue_imports", "revenue_lines"]) {
      expect(SQL).toMatch(new RegExp(`${t}_privileged_insert`));
      expect(SQL).toMatch(new RegExp(`${t}_privileged_update`));
    }
    // No DELETE policy for authenticated on either table.
    expect(SQL).not.toMatch(/FOR DELETE TO authenticated/i);
  });
  it("SELECT policies are workspace/ownership scoped, never blanket authenticated", () => {
    expect(SQL).toMatch(/revenue_imports_scoped_select[\s\S]*is_workspace_member\(workspace_id, auth\.uid\(\)\)/);
    expect(SQL).toMatch(/revenue_lines_scoped_select[\s\S]*owner_user_id = auth\.uid\(\)/);
    expect(SQL).toMatch(/revenue_lines_scoped_select[\s\S]*is_workspace_member\(workspace_id, auth\.uid\(\)\)/);
  });
  it("privileged role helper covers the 4 required roles", () => {
    for (const role of ["admin", "super_admin", "platform_owner", "founder"]) {
      expect(SQL).toContain(role);
    }
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.is_revenue_privileged/);
    expect(SQL).toMatch(/SECURITY DEFINER/);
  });
  it("conflicts table has a dedupe unique index (idempotent retry)", () => {
    expect(SQL).toMatch(/revenue_import_conflicts_dedupe_uidx/);
    expect(SQL).toMatch(/UNIQUE INDEX[\s\S]*statement_key, COALESCE\(row_key,''\), reason/);
  });
  it("stays transactional and additive", () => {
    expect(SQL).toMatch(/^BEGIN;/m);
    expect(SQL).toMatch(/COMMIT;\s*$/m);
    expect(SQL).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(SQL).not.toMatch(/\bTRUNCATE\b/i);
  });
});

// ---------- Mapping (admin step) -----------------------------------------

const rows = normalizeStatement(
  [
    { title: "Harshiv", date: "05/07/2026", gross: "1000", units: "1" },
    { title: "Unknown Movie", date: "05/07/2026", gross: "500", units: "1" },
    { title: "Doubled Title", date: "05/07/2026", gross: "300", units: "1" },
    { title: "", date: "05/07/2026", gross: "100", units: "1" },
  ],
  { sourceType: "bookmyshow", sourceStatementId: "BMS-2", currency: "INR" },
  bookMyShowAdapter,
).rows;

const titles: TitleCandidate[] = [
  { id: "T-Harshiv", title: "Harshiv", ownerUserId: "creator-1", workspaceId: "w1" },
  { id: "T-DupA", title: "Doubled Title", ownerUserId: "creator-2", workspaceId: "w1" },
  { id: "T-DupB", title: "Doubled Title", ownerUserId: "creator-3", workspaceId: "w2" },
];
const deals: DealCandidate[] = [
  { id: "D-1", titleId: "T-Harshiv", buyerUserId: "buyer-1" },
  { id: "D-2", titleId: "T-Other", buyerUserId: "buyer-1" },
];

describe("admin mapping", () => {
  it("exact-match maps a single-hit title", () => {
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: "buyer-1", dealMemoId: null, workspaceId: "w1",
    });
    const harshiv = res.rows.find((r) => r.lineIndex === 0)!;
    expect(harshiv.status).toBe("mapped");
    expect(harshiv.titleId).toBe("T-Harshiv");
  });
  it("no match → hold_for_review, never silently mapped", () => {
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: null, dealMemoId: null, workspaceId: null,
    });
    const unknown = res.rows.find((r) => r.lineIndex === 1)!;
    expect(unknown.status).toBe("hold_for_review");
    expect(unknown.titleId).toBeNull();
    expect(unknown.reasons).toContain("no_title_match");
  });
  it("ambiguous title → hold_for_review with both candidates", () => {
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: null, dealMemoId: null, workspaceId: null,
    });
    const dup = res.rows.find((r) => r.lineIndex === 2)!;
    expect(dup.status).toBe("hold_for_review");
    expect(dup.reasons).toContain("ambiguous_title_match");
    expect(dup.candidates).toEqual(expect.arrayContaining(["T-DupA", "T-DupB"]));
  });
  it("missing reference → hold_for_review with no_title_reference", () => {
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: null, dealMemoId: null, workspaceId: null,
    });
    const blank = res.rows.find((r) => r.lineIndex === 3)!;
    expect(blank.status).toBe("hold_for_review");
    expect(blank.reasons).toContain("no_title_reference");
  });
  it("deal-title mismatch is flagged as conflict and blocks confirm", () => {
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: "buyer-1", dealMemoId: "D-2", workspaceId: "w1",
    });
    const harshiv = res.rows.find((r) => r.lineIndex === 0)!;
    expect(harshiv.status).toBe("conflict");
    expect(harshiv.reasons).toContain("deal_title_mismatch");
    expect(canConfirmImport(res)).toBe(false);
  });
  it("all rows mapped-or-held → confirm allowed; conflict → blocked", () => {
    const ok = proposeMappings(rows, titles, deals, {
      buyerUserId: "buyer-1", dealMemoId: null, workspaceId: "w1",
    });
    expect(canConfirmImport(ok)).toBe(true);
  });
  it("per-row override wins over batch defaults", () => {
    const overrides = { [rows[1].rowKey]: { titleId: "T-Harshiv", status: "mapped" as const } };
    const res = proposeMappings(rows, titles, deals, {
      buyerUserId: null, dealMemoId: null, workspaceId: null,
    }, overrides);
    const forced = res.rows.find((r) => r.lineIndex === 1)!;
    expect(forced.titleId).toBe("T-Harshiv");
    expect(forced.status).toBe("mapped");
  });
});

// ---------- Reconciliation -----------------------------------------------

describe("expected-vs-actual reconciliation", () => {
  it("fixed license fee: variance / shortfall / surplus", () => {
    expect(reconcile({ model: "fixed_license_fee", expectedMinor: 100000, actualNetMinor: 100000 }).status).toBe("on_track");
    expect(reconcile({ model: "fixed_license_fee", expectedMinor: 100000, actualNetMinor: 80000 }).status).toBe("shortfall");
    expect(reconcile({ model: "fixed_license_fee", expectedMinor: 100000, actualNetMinor: 150000 }).status).toBe("surplus");
    expect(reconcile({ model: "fixed_license_fee", expectedMinor: null, actualNetMinor: 1 }).notes).toContain("expected_missing");
  });
  it("MG: recouping when share < MG, recouped when share >= remaining", () => {
    const r1 = reconcile({ model: "mg", expectedMinor: 1_00_000_00, shareRate: 0.5, actualNetMinor: 1_00_000_00, priorRecoupedMinor: 0 });
    // MG = 10,000,000; share = 5,000,000; still recouping.
    expect(r1.status).toBe("recouping");
    expect(r1.recoupedMinor).toBe(5_00_000_0);
    expect(r1.remainingMinor).toBe(5_00_000_0);
    expect(r1.creatorShareMinor).toBe(0);

    const r2 = reconcile({ model: "mg", expectedMinor: 1_00_000_00, shareRate: 0.5, actualNetMinor: 4_00_000_00, priorRecoupedMinor: 0 });
    // share = 20,000,000; > MG 10,000,000 → recouped, overage 10,000,000.
    expect(r2.status).toBe("recouped");
    expect(r2.remainingMinor).toBe(0);
    expect(r2.creatorShareMinor).toBe(1_00_000_00);
  });
  it("MG: prior recoupment reduces outstanding without going negative", () => {
    const r = reconcile({ model: "mg", expectedMinor: 100, shareRate: 1, actualNetMinor: 100, priorRecoupedMinor: 999 });
    expect(r.remainingMinor).toBe(0);
    expect(r.status).toBe("recouped");
  });
  it("revenue share: creator + platform sum to actual net (paise safe)", () => {
    const r = reconcile({ model: "revenue_share", shareRate: 0.35, actualNetMinor: 12345 });
    expect(r.creatorShareMinor + r.platformShareMinor).toBe(12345);
    expect(r.status).toBe("on_track");
  });
  it("share rate out of range is clamped, not exploded", () => {
    const hi = reconcile({ model: "revenue_share", shareRate: 5, actualNetMinor: 1000 });
    expect(hi.creatorShareMinor).toBe(1000);
    const lo = reconcile({ model: "revenue_share", shareRate: -1, actualNetMinor: 1000 });
    expect(lo.creatorShareMinor).toBe(0);
  });
  it("unsupported model returns n/a rather than misreporting", () => {
    const r = reconcile({ model: "per_film", expectedMinor: null, actualNetMinor: 500 });
    expect(r.status).toBe("n/a");
  });
});

// ---------- Idempotent retry (normalize + conflicts contract) ------------

describe("idempotent retry", () => {
  it("same statement + rows produce identical statement_key and row_keys", () => {
    const a = normalizeStatement(
      [{ title: "X", date: "05/07/2026", gross: "10", units: "1" }],
      { sourceType: "bookmyshow", sourceStatementId: "R-1", currency: "INR" },
      bookMyShowAdapter,
    );
    const b = normalizeStatement(
      [{ title: "X", date: "05/07/2026", gross: "10", units: "1" }],
      { sourceType: "bookmyshow", sourceStatementId: "R-1", currency: "INR" },
      bookMyShowAdapter,
    );
    expect(a.statementKey).toBe(b.statementKey);
    expect(a.rows[0].rowKey).toBe(b.rows[0].rowKey);
  });
  it("conflict dedupe key composition is enforced at SQL layer", () => {
    expect(SQL).toMatch(/statement_key, COALESCE\(row_key,''\), reason/);
  });
});
