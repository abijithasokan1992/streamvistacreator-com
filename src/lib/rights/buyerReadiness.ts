export type BuyerReadinessStatus =
  | "buyer_ready"
  | "conditional"
  | "needs_documents"
  | "legal_hold"
  | "qc_hold"
  | "internal_only";

export interface BuyerReadinessInput {
  sellerVerified: boolean;
  mandateVerified: boolean;
  rightsAuthorityVerified: boolean;
  rightsScopeComplete: boolean;
  unresolvedRightsConflict: boolean;
  legalCleared: boolean;
  qcPassed: boolean;
  approvedPoster: boolean;
  approvedTrailerOrTeaser: boolean;
  secureScreenerAvailable: boolean;
  screenerRequired?: boolean;
}

export interface BuyerReadinessResult {
  status: BuyerReadinessStatus;
  buyerVisible: boolean;
  missing: string[];
  blockers: string[];
}

/**
 * Pure fail-closed evaluator for buyer-facing title readiness.
 * This function does not grant access. RLS and server-side authorization remain authoritative.
 */
export function evaluateBuyerReadiness(
  input: BuyerReadinessInput,
): BuyerReadinessResult {
  const missing: string[] = [];
  const blockers: string[] = [];

  if (!input.sellerVerified) missing.push("seller_verification");
  if (!input.mandateVerified) missing.push("mandate");
  if (!input.rightsAuthorityVerified) missing.push("rights_authority");
  if (!input.rightsScopeComplete) missing.push("rights_scope");
  if (!input.approvedPoster) missing.push("approved_poster");
  if (!input.approvedTrailerOrTeaser) missing.push("approved_trailer_or_teaser");
  if ((input.screenerRequired ?? true) && !input.secureScreenerAvailable) {
    missing.push("secure_screener");
  }

  if (input.unresolvedRightsConflict) blockers.push("rights_conflict");
  if (!input.legalCleared) blockers.push("legal_not_cleared");
  if (!input.qcPassed) blockers.push("qc_not_passed");

  if (input.unresolvedRightsConflict) {
    return { status: "legal_hold", buyerVisible: false, missing, blockers };
  }

  if (!input.legalCleared) {
    return { status: "legal_hold", buyerVisible: false, missing, blockers };
  }

  if (!input.qcPassed) {
    return { status: "qc_hold", buyerVisible: false, missing, blockers };
  }

  if (
    !input.sellerVerified ||
    !input.mandateVerified ||
    !input.rightsAuthorityVerified ||
    !input.rightsScopeComplete
  ) {
    return { status: "needs_documents", buyerVisible: false, missing, blockers };
  }

  if (missing.length > 0) {
    return { status: "conditional", buyerVisible: false, missing, blockers };
  }

  return { status: "buyer_ready", buyerVisible: true, missing, blockers };
}
