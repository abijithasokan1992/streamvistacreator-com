import type {
  BuyerRequirement,
  CandidateMatch,
  CatalogueCandidate,
  CommercialGuardrails,
  NonBindingOffer,
} from "./types";

const normalise = (value: string) => value.trim().toLowerCase();

const overlap = (requested: string[], available: string[]) => {
  const availableSet = new Set(available.map(normalise));
  return requested.filter((item) => availableSet.has(normalise(item)));
};

export function scoreCandidate(
  requirement: BuyerRequirement,
  candidate: CatalogueCandidate,
): CandidateMatch {
  const blockers: string[] = [];
  const matchedRights = overlap(requirement.rightsRequested, candidate.availableRights);
  const matchedTerritories = overlap(requirement.territories, candidate.territories);
  const languageMatch = requirement.languages.some(
    (language) => normalise(language) === normalise(candidate.language),
  );

  if (!languageMatch) blockers.push("language_mismatch");
  if (matchedRights.length !== requirement.rightsRequested.length) blockers.push("rights_mismatch");
  if (requirement.territories.length > 0 && matchedTerritories.length === 0) {
    blockers.push("territory_mismatch");
  }
  if (!candidate.masterReady) blockers.push("master_not_ready");
  if (candidate.rightsStatus !== "clear") blockers.push(`rights_${candidate.rightsStatus}`);
  if (
    requirement.kind === "ai_dataset_licensing" &&
    candidate.aiTrainingPermission !== "approved"
  ) {
    blockers.push("ai_training_permission_not_approved");
  }

  let score = 0;
  if (languageMatch) score += 25;
  score += Math.min(25, matchedRights.length * 10);
  if (requirement.territories.length === 0 || matchedTerritories.length > 0) score += 15;
  if (candidate.masterReady) score += 15;
  if (candidate.rightsStatus === "clear") score += 15;
  if (
    requirement.kind !== "ai_dataset_licensing" ||
    candidate.aiTrainingPermission === "approved"
  ) {
    score += 5;
  }

  return {
    titleId: candidate.titleId,
    title: candidate.title,
    score,
    matchedRights,
    matchedTerritories,
    blockers,
    eligible: blockers.length === 0,
  };
}

export function rankCandidates(
  requirement: BuyerRequirement,
  candidates: CatalogueCandidate[],
): CandidateMatch[] {
  return candidates
    .map((candidate) => scoreCandidate(requirement, candidate))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function createNonBindingOffer(input: {
  opportunityId: string;
  requirement: BuyerRequirement;
  matches: CandidateMatch[];
  guardrails: CommercialGuardrails;
  proposedPrice?: number;
  termMonths?: number;
  exclusive?: boolean;
}): NonBindingOffer {
  const eligible = input.matches.filter((match) => match.eligible);
  if (eligible.length === 0) throw new Error("No eligible titles are available for an offer.");

  const price = input.proposedPrice ?? input.guardrails.askingPrice;
  if (price < input.guardrails.floorPrice) {
    throw new Error("Proposed price is below the approved commercial floor.");
  }

  const termMonths = input.termMonths ?? input.guardrails.allowedTermsMonths[0];
  if (!input.guardrails.allowedTermsMonths.includes(termMonths)) {
    throw new Error("Proposed term is outside approved commercial guardrails.");
  }

  const exclusive = input.exclusive ?? false;
  if (exclusive && !input.guardrails.allowExclusivity) {
    throw new Error("Exclusivity is not permitted by the approved guardrails.");
  }

  return {
    opportunityId: input.opportunityId,
    buyerId: input.requirement.buyerId,
    currency: input.guardrails.currency,
    price,
    advancePercent: input.guardrails.advancePercent,
    termMonths,
    exclusive,
    titleIds: eligible.map((match) => match.titleId),
    ownerApproval: "pending",
    legalApproval: "pending",
    binding: false,
  };
}

export function canReleaseCleanMasters(offer: NonBindingOffer, paymentReceived: boolean): boolean {
  return (
    offer.ownerApproval === "approved" &&
    offer.legalApproval === "approved" &&
    paymentReceived
  );
}
