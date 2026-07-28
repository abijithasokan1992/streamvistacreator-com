import { describe, it, expect } from "vitest";
import {
  isProductionTitle,
  NON_PRODUCTION_OWNER_IDS,
  NON_PRODUCTION_CLASSIFICATIONS,
} from "@/lib/operations/productionFilters";

/**
 * Batch 2 counter-hygiene guard. Confirms the shared production filter
 * excludes every row that the 20260728 quarantine migration tagged, and
 * still admits genuine creator drafts. If any counter surface starts
 * reflecting quarantined rows again this test will fail first.
 */

const genuineDraft = {
  id: "genuine-1",
  owner_user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  metadata: { format: "feature_film" },
};

describe("productionFilters — Batch 2 quarantine hygiene", () => {
  it("admits a genuine creator draft with no test signals", () => {
    expect(isProductionTitle(genuineDraft)).toBe(true);
  });

  it("excludes every classification tagged by the Batch 2 migration", () => {
    for (const cls of NON_PRODUCTION_CLASSIFICATIONS) {
      expect(
        isProductionTitle({
          id: `q-${cls}`,
          owner_user_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          metadata: { data_classification: cls, is_test: true },
        }),
      ).toBe(false);
    }
  });

  it("excludes rows whose only signal is is_test = true", () => {
    expect(
      isProductionTitle({
        id: "flag-only",
        owner_user_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        metadata: { is_test: true },
      }),
    ).toBe(false);
  });

  it("excludes rows owned by the known non-production owner ids", () => {
    for (const ownerId of NON_PRODUCTION_OWNER_IDS) {
      expect(
        isProductionTitle({
          id: `own-${ownerId}`,
          owner_user_id: ownerId,
          metadata: {},
        }),
      ).toBe(false);
    }
  });

  it("expected class set contains system_test and pre_production (Batch 2 additions)", () => {
    expect(NON_PRODUCTION_CLASSIFICATIONS).toContain("system_test");
    expect(NON_PRODUCTION_CLASSIFICATIONS).toContain("pre_production");
  });

  it("excludes orphan rows (owner_user_id null)", () => {
    expect(
      isProductionTitle({ id: "orphan", owner_user_id: null, metadata: {} }),
    ).toBe(false);
  });
});
