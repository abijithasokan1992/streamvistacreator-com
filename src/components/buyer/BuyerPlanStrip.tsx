import { Briefcase } from "lucide-react";
import { PlanVisibilityCard, type PlanTier } from "@/components/shared/tools";

export default function BuyerPlanStrip({
  openRequests,
  activeConversations,
  approvedScreeners,
  onNewRequest,
}: {
  openRequests: number;
  activeConversations: number;
  approvedScreeners: number;
  onNewRequest: () => void;
}) {
  const tier: PlanTier = "managed";
  return (
    <PlanVisibilityCard
      icon={Briefcase}
      planName="Buyer · Admin-mediated access"
      tier={tier}
      statusLine={
        openRequests === 0
          ? "No open requests — send a brief to begin."
          : `${openRequests} open · ${activeConversations} in active conversation`
      }
      quotas={[
        { label: "Approved screeners", used: String(approvedScreeners) },
        { label: "Active conversations", used: String(activeConversations) },
      ]}
      ctaLabel="New request"
      onCta={onNewRequest}
    />
  );
}
