import { describe, expect, it } from "vitest";
import {
  canReleaseCleanMasters,
  createNonBindingOffer,
  rankCandidates,
  scoreCandidate,
} from "./opportunityEngine";
import type { BuyerRequirement, CatalogueCandidate } from "./types";

const requirement: BuyerRequirement = {
  buyerId: "buyer-1",
  buyerName: "AI Data Buyer",
  kind: "ai_dataset_licensing",
  languages: ["Malayalam"],
  territories: ["Worldwide"],
  rightsRequested: ["ai_training", "model_evaluation"],
  minimumHours: 25,
  source: "a2a",
};

const readyFilm: CatalogueCandidate = {
  titleId: "title-1",
  title: "Ready Film",
  language: "Malayalam",
  durationMinutes: 105,
  territories: ["Worldwide"],
  availableRights: ["ai_training", "model_evaluation"],
  masterReady: true,
  rightsStatus: "clear",
  aiTrainingPermission: "approved",
};

describe("business opportunity engine", () => {
  it("marks a fully rights-cleared AI title eligible", () => {
    const result = scoreCandidate(requirement, readyFilm);
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.score).toBe(100);
  });

  it("fails closed when AI-training permission is not approved", () => {
    const result = scoreCandidate(requirement, {
      ...readyFilm,
      aiTrainingPermission: "pending",
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("ai_training_permission_not_approved");
  });

  it("ranks eligible buyer-fit titles before blocked titles", () => {
    const ranked = rankCandidates(requirement, [
      { ...readyFilm, titleId: "blocked", title: "Blocked Film", masterReady: false },
      readyFilm,
    ]);
    expect(ranked[0].titleId).toBe("title-1");
    expect(ranked[0].eligible).toBe(true);
  });

  it("rejects offers below the owner-approved floor", () => {
    const matches = rankCandidates(requirement, [readyFilm]);
    expect(() =>
      createNonBindingOffer({
        opportunityId: "opp-1",
        requirement,
        matches,
        guardrails: {
          currency: "INR",
          askingPrice: 1_200_000,
          floorPrice: 600_000,
          advancePercent: 50,
          allowExclusivity: false,
          allowedTermsMonths: [12],
        },
        proposedPrice: 500_000,
      }),
    ).toThrow("below the approved commercial floor");
  });

  it("creates only a non-binding offer pending owner and legal approval", () => {
    const matches = rankCandidates(requirement, [readyFilm]);
    const offer = createNonBindingOffer({
      opportunityId: "opp-1",
      requirement,
      matches,
      guardrails: {
        currency: "INR",
        askingPrice: 1_200_000,
        floorPrice: 600_000,
        advancePercent: 50,
        allowExclusivity: false,
        allowedTermsMonths: [12],
      },
    });
    expect(offer.binding).toBe(false);
    expect(offer.ownerApproval).toBe("pending");
    expect(offer.legalApproval).toBe("pending");
    expect(canReleaseCleanMasters(offer, true)).toBe(false);
  });

  it("releases clean masters only after both approvals and payment", () => {
    const matches = rankCandidates(requirement, [readyFilm]);
    const offer = createNonBindingOffer({
      opportunityId: "opp-1",
      requirement,
      matches,
      guardrails: {
        currency: "INR",
        askingPrice: 1_200_000,
        floorPrice: 600_000,
        advancePercent: 50,
        allowExclusivity: false,
        allowedTermsMonths: [12],
      },
    });
    const approved = {
      ...offer,
      ownerApproval: "approved" as const,
      legalApproval: "approved" as const,
    };
    expect(canReleaseCleanMasters(approved, false)).toBe(false);
    expect(canReleaseCleanMasters(approved, true)).toBe(true);
  });
});
