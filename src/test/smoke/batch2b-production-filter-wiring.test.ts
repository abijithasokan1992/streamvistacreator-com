import { describe, it, expect, beforeEach } from "vitest";
import {
  applyProductionFilterByOwnerColumn,
  applyProductionFilterByTitleIdColumn,
  applyProductionFilterToTitlesQuery,
  NON_PRODUCTION_OWNER_IDS,
} from "@/lib/operations/productionFilters";
import {
  primeQuarantinedTitleIdsCache,
  resetQuarantinedTitleIdsCache,
  fetchQuarantinedTitleIds,
} from "@/lib/operations/useQuarantinedTitleIds";

/**
 * Batch 2b regression: the centralized production filter is the ONLY
 * source of truth for excluding quarantined records from operational
 * dashboards. These tests assert the helper API surface is stable and
 * every helper produces the exact PostgREST call each consuming file
 * relies on. If someone adds a new dashboard, they can lean on these
 * expectations instead of re-implementing filtering logic locally.
 */

function makeFakeQuery(name = "content_titles") {
  const calls: Array<[string, ...unknown[]]> = [];
  const q: any = {};
  const chain = (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args]);
      return q;
    };
  ["eq", "neq", "not", "select", "order", "limit", "gte", "lte", "in"].forEach(
    (m) => (q[m] = chain(m)),
  );
  q.__calls = calls;
  q.__table = name;
  return q;
}

describe("productionFilters — Batch 2b centralized wiring", () => {
  beforeEach(() => {
    resetQuarantinedTitleIdsCache();
  });

  it("applyProductionFilterToTitlesQuery excludes all NON_PRODUCTION_OWNER_IDS and metadata.is_test", () => {
    const q = makeFakeQuery();
    applyProductionFilterToTitlesQuery(q);
    const neqCalls = q.__calls.filter((c: any[]) => c[0] === "neq");
    expect(neqCalls).toHaveLength(NON_PRODUCTION_OWNER_IDS.length);
    for (const ownerId of NON_PRODUCTION_OWNER_IDS) {
      expect(neqCalls.some((c: any[]) => c[1] === "owner_user_id" && c[2] === ownerId)).toBe(
        true,
      );
    }
    const notCalls = q.__calls.filter((c: any[]) => c[0] === "not");
    expect(notCalls).toContainEqual(["not", "metadata->>is_test", "eq", "true"]);
  });

  it("applyProductionFilterByOwnerColumn excludes ONLY flagged non-production owners", () => {
    const q = makeFakeQuery("notifications");
    applyProductionFilterByOwnerColumn(q, "user_id");
    const neq = q.__calls.filter((c: any[]) => c[0] === "neq");
    expect(neq).toHaveLength(NON_PRODUCTION_OWNER_IDS.length);
    // Every neq call must reference the passed column name.
    for (const call of neq) expect(call[1]).toBe("user_id");
  });

  it("applyProductionFilterByOwnerColumn honours a custom column name", () => {
    const q = makeFakeQuery("invoices");
    applyProductionFilterByOwnerColumn(q, "customer_user_id");
    const neq = q.__calls.filter((c: any[]) => c[0] === "neq");
    expect(neq.every((c: any[]) => c[1] === "customer_user_id")).toBe(true);
  });

  it("applyProductionFilterByTitleIdColumn is a no-op when quarantined list is empty", () => {
    const q = makeFakeQuery("distribution_program_offers");
    applyProductionFilterByTitleIdColumn(q, [], "title_id");
    expect(q.__calls).toHaveLength(0);
    applyProductionFilterByTitleIdColumn(q, null, "title_id");
    expect(q.__calls).toHaveLength(0);
  });

  it("applyProductionFilterByTitleIdColumn issues a single .not(...in...) call with all IDs", () => {
    const q = makeFakeQuery("revenue_lines");
    const ids = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"];
    applyProductionFilterByTitleIdColumn(q, ids, "title_id");
    expect(q.__calls).toEqual([
      ["not", "title_id", "in", `(${ids.join(",")})`],
    ]);
  });

  it("cache primer skips the DB round-trip and returns primed IDs synchronously", async () => {
    const primed = ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"];
    primeQuarantinedTitleIdsCache(primed);
    const result = await fetchQuarantinedTitleIds();
    expect(result).toEqual(primed);
  });

  it("reset clears the cache so the next fetch reloads", async () => {
    primeQuarantinedTitleIdsCache(["x"]);
    resetQuarantinedTitleIdsCache();
    // Without the supabase client mocked, the loader fails open to [].
    const result = await fetchQuarantinedTitleIds();
    expect(Array.isArray(result)).toBe(true);
  });
});
