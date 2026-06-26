import { Cloud } from "lucide-react";
import { PlanVisibilityCard, type PlanTier } from "@/components/shared/tools";

export default function StudioPlanStrip({
  hasPaidVault,
  hasTesting,
  totalGb,
  usedGb,
  onUpgrade,
}: {
  hasPaidVault: boolean;
  hasTesting: boolean;
  totalGb: number;
  usedGb: number;
  onUpgrade: () => void;
}) {
  const tier: PlanTier = hasPaidVault ? "paid" : hasTesting ? "managed" : "free";
  const planName = hasPaidVault
    ? "Studio Vault — Paid"
    : hasTesting
      ? "Studio Vault — Testing allowance"
      : "Studio Vault — Not activated";

  const percent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;

  return (
    <PlanVisibilityCard
      icon={Cloud}
      planName={planName}
      tier={tier}
      statusLine={
        hasPaidVault
          ? "Recurring vault active. Add capacity any time."
          : hasTesting
            ? "Testing allowance — buy 1 TB to activate real capacity."
            : "Buy 1 TB to start uploading."
      }
      quotas={[
        {
          label: "Allocated",
          used: totalGb >= 1024 ? `${(totalGb / 1024).toFixed(1)} TB` : `${totalGb.toFixed(0)} GB`,
          total: undefined,
        },
        {
          label: "Used",
          used: `${usedGb.toFixed(1)} GB`,
          total: totalGb > 0 ? (totalGb >= 1024 ? `${(totalGb / 1024).toFixed(1)} TB` : `${totalGb.toFixed(0)} GB`) : undefined,
          percent: totalGb > 0 ? percent : undefined,
        },
      ]}
      ctaLabel={hasPaidVault ? "Manage" : "Get storage"}
      onCta={onUpgrade}
    />
  );
}
