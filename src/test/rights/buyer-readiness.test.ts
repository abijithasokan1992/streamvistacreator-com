import { describe, expect, it } from "vitest";

import { evaluateBuyerReadiness } from "@/lib/rights/buyerReadiness";

const readyInput = {
  sellerVerified: true,
  mandateVerified: true,
  rightsAuthorityVerified: true,
  rightsScopeComplete: true,
  unresolvedRightsConflict: false,
  legalCleared: true,
  qcPassed: true,
  approvedPoster: true,
  approvedTrailerOrTeaser: true,
  secureScreenerAvailable: true,
};

describe("evaluateBuyerReadiness", () => {
  it("marks a fully cleared title buyer ready", () => {
    expect(evaluateBuyerReadiness(readyInput)).toEqual({
      status: "buyer_ready",
      buyerVisible: true,
      missing: [],
      blockers: [],
    });
  });

  it("fails closed when a rights conflict exists", () => {
    const result = evaluateBuyerReadiness({
      ...readyInput,
      unresolvedRightsConflict: true,
    });

    expect(result.status).toBe("legal_hold");
    expect(result.buyerVisible).toBe(false);
    expect(result.blockers).toContain("rights_conflict");
  });

  it("requires mandate and authority documents", () => {
    const result = evaluateBuyerReadiness({
      ...readyInput,
      mandateVerified: false,
      rightsAuthorityVerified: false,
    });

    expect(result.status).toBe("needs_documents");
    expect(result.buyerVisible).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(["mandate", "rights_authority"]),
    );
  });

  it("keeps a title hidden until QC passes", () => {
    const result = evaluateBuyerReadiness({
      ...readyInput,
      qcPassed: false,
    });

    expect(result.status).toBe("qc_hold");
    expect(result.buyerVisible).toBe(false);
  });

  it("allows a workflow where a screener is not required", () => {
    const result = evaluateBuyerReadiness({
      ...readyInput,
      secureScreenerAvailable: false,
      screenerRequired: false,
    });

    expect(result.status).toBe("buyer_ready");
    expect(result.buyerVisible).toBe(true);
  });
});
