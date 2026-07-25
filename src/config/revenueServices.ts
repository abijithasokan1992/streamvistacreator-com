export type RevenueServiceId = "film_onboarding" | "licensing_ready";

export interface RevenueService {
  id: RevenueServiceId;
  name: string;
  description: string;
  baseAmountInr: number;
  gstRate: number;
  totalAmountInr: number;
  deliverables: string[];
  enabled: boolean;
}

export const REVENUE_SERVICES: RevenueService[] = [
  {
    id: "film_onboarding",
    name: "Film Onboarding Package",
    description: "Prepare one title for structured StreamVista onboarding.",
    baseAmountInr: 999,
    gstRate: 18,
    totalAmountInr: 1179,
    deliverables: [
      "Film listing and metadata check",
      "Poster and trailer intake",
      "Rights-document checklist",
      "Buyer-ready title profile",
    ],
    enabled: true,
  },
  {
    id: "licensing_ready",
    name: "Licensing Ready Package",
    description: "Prepare one title for buyer-facing licensing review.",
    baseAmountInr: 2999,
    gstRate: 18,
    totalAmountInr: 3539,
    deliverables: [
      "Metadata review",
      "Rights-readiness checklist",
      "QC review coordination",
      "Watermarked screener preparation",
      "Buyer-submission preparation",
    ],
    enabled: true,
  },
];

export function getRevenueService(id: RevenueServiceId): RevenueService | undefined {
  return REVENUE_SERVICES.find((service) => service.id === id);
}
