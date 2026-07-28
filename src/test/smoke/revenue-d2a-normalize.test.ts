/**
 * Phase D2A — Revenue normalization, taxonomy, calc, idempotency tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMMERCIAL_MODELS,
  isCommercialModel,
  isRightsCategory,
  modelRequiresShareRate,
} from "@/lib/revenue/commercialModels";
import { parseAmountToMinor, parseRate } from "@/lib/revenue/money";
import {
  statementIdempotencyKey,
  rowIdempotencyKey,
} from "@/lib/revenue/idempotency";
import { normalizeStatement, getAdapter, bookMyShowAdapter } from "@/lib/revenue/normalize";

describe("commercial model taxonomy", () => {
  it("includes svod/tvod/avod/mg/fixed/rev-share/per-film/bulk-title/bulk-hours", () => {
    for (const m of ["svod", "tvod", "avod", "mg", "fixed_license_fee", "revenue_share", "per_film", "bulk_title", "bulk_hours"]) {
      expect(COMMERCIAL_MODELS as readonly string[]).toContain(m);
    }
  });
  it("rights categories are NOT commercial models", () => {
    for (const c of ["linear", "non_linear", "ancillary"]) {
      expect(isCommercialModel(c)).toBe(false);
      expect(isRightsCategory(c)).toBe(true);
    }
  });
  it("share rate required only for share-bearing models", () => {
    expect(modelRequiresShareRate("fixed_license_fee")).toBe(false);
    expect(modelRequiresShareRate("per_film")).toBe(false);
    expect(modelRequiresShareRate("svod")).toBe(true);
    expect(modelRequiresShareRate("mg")).toBe(true);
  });
});

describe("money parsing (decimal safe)", () => {
  it("handles rupee symbols, commas, decimals, parentheses, blanks", () => {
    expect(parseAmountToMinor("₹ 1,234.50")).toBe(123450);
    expect(parseAmountToMinor("1234")).toBe(123400);
    expect(parseAmountToMinor("(50.25)")).toBe(-5025);
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor(null)).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor(Infinity)).toBeNull();
  });
  it("rejects out-of-range values", () => {
    expect(parseAmountToMinor("1e20")).toBeNull();
  });
  it("parseRate accepts % and fractions but bounds 0..1", () => {
    expect(parseRate("18%")).toBeCloseTo(0.18);
    expect(parseRate("0.35")).toBeCloseTo(0.35);
    expect(parseRate("-1")).toBeNull();
    expect(parseRate("150")).toBeNull();
  });
});

describe("idempotency keys", () => {
  it("statement key stable across calls but distinct for different periods", () => {
    const a = statementIdempotencyKey({ sourceType: "bookmyshow", sourceStatementId: "BMS-1", periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const b = statementIdempotencyKey({ sourceType: "bookmyshow", sourceStatementId: "BMS-1", periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const c = statementIdempotencyKey({ sourceType: "bookmyshow", sourceStatementId: "BMS-1", periodStart: "2026-08-01", periodEnd: "2026-08-31" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it("row key differs by title/date/amount/index", () => {
    const k1 = rowIdempotencyKey({ statementKey: "s1", titleExternalRef: "T1", occurredOn: "2026-07-05", grossAmountMinor: 10000, lineIndex: 0 });
    const k2 = rowIdempotencyKey({ statementKey: "s1", titleExternalRef: "T2", occurredOn: "2026-07-05", grossAmountMinor: 10000, lineIndex: 0 });
    expect(k1).not.toBe(k2);
  });
});

describe("BookMyShow adapter + normalization", () => {
  const rows = [
    { title: "Harshiv-1", date: "05/07/2026", gross: "₹1,000", gst: "180", gateway_fee: "20", in_app_fee: "10", units: "5", share_rate: "60%", model: "tvod" },
    { title: "Harshiv-1", date: "05/07/2026", gross: "₹1,000", gst: "180", gateway_fee: "20", in_app_fee: "10", units: "5", share_rate: "60%", model: "tvod" }, // duplicate
    { title: "Bad-row", date: "06/07/2026", gross: "not-a-number" },
  ];

  const result = normalizeStatement(rows, {
    sourceType: "bookmyshow",
    sourceStatementId: "BMS-1",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    currency: "INR",
  }, bookMyShowAdapter);

  it("normalises amounts to paise", () => {
    expect(result.rows[0].grossMinor).toBe(100000);
    expect(result.rows[0].taxMinor).toBe(18000);
    expect(result.rows[0].gatewayFeeMinor).toBe(2000);
    expect(result.rows[0].inAppFeeMinor).toBe(1000);
    expect(result.rows[0].netMinor).toBe(79000);
  });
  it("computes creator/platform share from rate when not provided", () => {
    expect(result.rows[0].creatorShareMinor).toBe(Math.round(79000 * 0.6));
    expect(result.rows[0].platformShareMinor).toBe(79000 - Math.round(79000 * 0.6));
  });
  it("marks in-statement duplicates and invalid rows", () => {
    expect(result.rows[1].errors).toContain("duplicate_row_in_statement");
    expect(result.rows[2].errors).toContain("gross_amount_invalid");
    expect(result.totals.errorRowCount).toBe(2);
  });
  it("preserves original raw payload for audit", () => {
    expect(result.rows[0].raw.title).toBe("Harshiv-1");
  });
  it("registry exposes bookmyshow adapter", () => {
    expect(getAdapter("bookmyshow")).toBe(bookMyShowAdapter);
    expect(getAdapter("unknown")).toBeNull();
  });
});

describe("workspace / no-write fallback (static)", () => {
  const importApi = readFileSync(join(process.cwd(), "src/lib/revenue/importApi.ts"), "utf8");
  it("has explicit database-pending fallback surface", () => {
    expect(importApi).toMatch(/class DatabasePendingError/);
    expect(importApi).toMatch(/StatementAlreadyImportedError/);
  });
  it("stores workspace_id in metadata (from mapping when present, else input) until migration lands", () => {
    expect(importApi).toMatch(/workspace_id:\s*mapping\?\.workspaceId\s*\?\?\s*input\.workspaceId/);
  });
  it("never silently overwrites existing statements", () => {
    expect(importApi).toMatch(/statement_key/);
    // Duplicates surface as StatementAlreadyImportedError parsed from the RPC's "duplicate_statement:<uuid>" payload.
    expect(importApi).toMatch(/StatementAlreadyImportedError\(/);
    expect(importApi).toMatch(/duplicate_statement/);
  });

});

describe("pending migration guardrails (static)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations-pending/20260717_010000_revenue_statement_import.sql"),
    "utf8",
  );
  it("is transactional and idempotent", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/COMMIT;\s*$/m);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
  it("has RLS covering the 4 privileged roles", () => {
    for (const role of ["admin", "super_admin", "platform_owner", "founder"]) {
      expect(sql).toContain(role);
    }
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    // Authenticated users may INSERT their own revenue_imports/lines rows;
    // DELETE remains restricted to privileged roles.
    expect(sql).not.toMatch(/FOR DELETE TO authenticated/i);
  });
  it("bounds share_rate to 0..1", () => {
    expect(sql).toMatch(/share_rate\s*>=\s*0/);
    expect(sql).toMatch(/share_rate\s*<=\s*1/);
  });
});
