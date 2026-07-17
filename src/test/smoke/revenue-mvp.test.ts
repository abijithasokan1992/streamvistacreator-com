/**
 * Revenue MVP focused tests.
 *
 * Covers:
 *   - RFC4180 CSV parser edge cases (quoted commas, quoted newlines, CRLF, BOM).
 *   - Corrected payment-rail registry (RazorpayX = unconfigured capability,
 *     legacy Django = deprecated).
 *   - Admin surface wiring: RevenueStatementImport is registered in Admin
 *     Business IA and Creator Statements exposes a Revenue tab.
 *   - Buyer Send Money absence guard still holds after changes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, requireHeaders } from "@/lib/revenue/csv";
import {
  PAYMENT_RAILS,
  getRail,
  isRailActive,
  canSurfaceRail,
  isRailAvailableCapability,
} from "@/lib/payments/paymentRails";

const SRC = join(process.cwd(), "src");

describe("RFC4180 CSV parser", () => {
  it("handles simple headers + rows", () => {
    const r = parseCsv("a,b\n1,2\n3,4");
    expect(r.headers).toEqual(["a", "b"]);
    expect(r.rows).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
    expect(r.errors).toEqual([]);
  });

  it("handles quoted commas and quoted newlines", () => {
    const r = parseCsv('title,notes\n"Hello, World","line1\nline2"\n');
    expect(r.rows).toEqual([{ title: "Hello, World", notes: "line1\nline2" }]);
  });

  it("handles CRLF and escaped quotes", () => {
    const r = parseCsv('title,q\r\n"He said ""hi""",1\r\n');
    expect(r.rows).toEqual([{ title: 'He said "hi"', q: "1" }]);
  });

  it("strips UTF-8 BOM", () => {
    const r = parseCsv("\uFEFFa,b\n1,2");
    expect(r.headers).toEqual(["a", "b"]);
    expect(r.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("reports unterminated quoted field", () => {
    const r = parseCsv('a,b\n"unterminated,2');
    expect(r.errors).toContain("unterminated_quoted_field");
  });

  it("requireHeaders is case-insensitive", () => {
    expect(requireHeaders(["Gross", "Tax"], ["gross"])).toEqual([]);
    expect(requireHeaders(["a", "b"], ["gross"])).toEqual(["gross"]);
  });
});

describe("payment rails — corrected semantics", () => {
  it("razorpay_standard remains the only active rail", () => {
    const active = PAYMENT_RAILS.filter((r) => r.status === "active").map((r) => r.id);
    expect(active).toEqual(["razorpay_standard"]);
    expect(isRailActive("razorpay_standard")).toBe(true);
  });

  it("razorpayx_payouts is unconfigured (capability), NOT deprecated", () => {
    const rail = getRail("razorpayx_payouts");
    expect(rail.status).toBe("unconfigured");
    expect(rail.capability).toBe("payout");
    expect(canSurfaceRail("razorpayx_payouts")).toBe(false);
    expect(isRailAvailableCapability("razorpayx_payouts")).toBe(true);
    // Note must not mislabel it as manual or deprecated.
    expect(rail.note.toLowerCase()).not.toContain("deprecated");
    expect(rail.note.toLowerCase()).not.toContain("manual fallback");
    expect(rail.note.toLowerCase()).toContain("automatic");
  });

  it("legacy Django/PythonAnywhere stays deprecated", () => {
    const rail = getRail("legacy_django_pythonanywhere");
    expect(rail.status).toBe("deprecated");
    expect(canSurfaceRail("legacy_django_pythonanywhere")).toBe(false);
    expect(isRailAvailableCapability("legacy_django_pythonanywhere")).toBe(false);
  });

  it("paddle stays disabled unless enabled at build", () => {
    expect(isRailActive("paddle")).toBe(false);
  });
});

describe("admin & creator surface wiring", () => {
  it("Admin.tsx registers Revenue Statements section", () => {
    const admin = readFileSync(join(SRC, "pages/Admin.tsx"), "utf8");
    expect(admin).toContain("RevenueStatementImport");
    expect(admin).toContain("revenue-statements");
  });

  it("Creator Statements exposes Billing and Revenue tabs", () => {
    const stmt = readFileSync(join(SRC, "components/creator/sections/Statements.tsx"), "utf8");
    expect(stmt).toContain("CreatorRevenueSummary");
    expect(stmt).toMatch(/"billing".*"revenue"|\["billing", "revenue"\]/s);
  });

  it("RevenueStatementImport uses selectors (Select) and RFC4180 parser", () => {
    const src = readFileSync(join(SRC, "components/admin/RevenueStatementImport.tsx"), "utf8");
    expect(src).toContain("parseCsv");
    expect(src).not.toMatch(/csvText\.split\(\/\\r\?\\n\/\)/);
  });

  it("RevenueMappingStep uses Select dropdowns instead of raw ID inputs", () => {
    const src = readFileSync(join(SRC, "components/admin/RevenueMappingStep.tsx"), "utf8");
    expect(src).toContain("@/components/ui/select");
    expect(src).not.toContain('placeholder="buyer user id"');
    expect(src).not.toContain('placeholder="workspace id"');
  });
});

describe("no Buyer Send Money or generic Downloads regression", () => {
  it("Buyer CommercialSection contains no Send Money entry", () => {
    const src = readFileSync(join(SRC, "components/buyer/sections/CommercialSection.tsx"), "utf8");
    expect(/send\s+money/i.test(src)).toBe(false);
  });
});
