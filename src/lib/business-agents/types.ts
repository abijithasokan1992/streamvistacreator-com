export type OpportunityKind =
  | "film_licensing"
  | "ai_dataset_licensing"
  | "distribution_service"
  | "qc_delivery_service"
  | "partnership"
  | "funding";

export type OpportunityStage =
  | "discovered"
  | "qualified"
  | "matched"
  | "rights_review"
  | "owner_approval"
  | "outreach_ready"
  | "negotiating"
  | "contracting"
  | "payment_pending"
  | "delivery"
  | "won"
  | "lost"
  | "blocked";

export type RightsStatus = "clear" | "partial" | "pending" | "conflict";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export interface BuyerRequirement {
  buyerId: string;
  buyerName: string;
  kind: OpportunityKind;
  languages: string[];
  territories: string[];
  rightsRequested: string[];
  minimumHours?: number;
  maximumHours?: number;
  budgetCurrency?: string;
  budgetMin?: number;
  budgetMax?: number;
  deadline?: string;
  source: "email" | "form" | "api" | "a2a" | "manual";
}

export interface CatalogueCandidate {
  titleId: string;
  title: string;
  language: string;
  durationMinutes: number;
  territories: string[];
  availableRights: string[];
  masterReady: boolean;
  rightsStatus: RightsStatus;
  aiTrainingPermission: ApprovalStatus;
  minimumPrice?: number;
  currency?: string;
}

export interface CandidateMatch {
  titleId: string;
  title: string;
  score: number;
  matchedRights: string[];
  matchedTerritories: string[];
  blockers: string[];
  eligible: boolean;
}

export interface CommercialGuardrails {
  currency: string;
  askingPrice: number;
  floorPrice: number;
  advancePercent: number;
  allowExclusivity: boolean;
  allowedTermsMonths: number[];
}

export interface NonBindingOffer {
  opportunityId: string;
  buyerId: string;
  currency: string;
  price: number;
  advancePercent: number;
  termMonths: number;
  exclusive: boolean;
  titleIds: string[];
  ownerApproval: ApprovalStatus;
  legalApproval: ApprovalStatus;
  binding: false;
}

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  stage: OpportunityStage;
  requirement: BuyerRequirement;
  matches: CandidateMatch[];
  offer?: NonBindingOffer;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}
