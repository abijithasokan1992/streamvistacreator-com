import { Cloud } from "lucide-react";
import { PlanVisibilityCard, type PlanTier } from "@/components/shared/tools";

export default function StudioPlanStrip({
  hasPaidVault,
  hasTesting: _hasTesting,
  totalGb,
  usedGb,
  onUpgrade,
}: {
  hasPaidVault: boolean;
  /** Retained for API compatibility; testing allowance is not surfaced in production UI. */
  hasTesting: boolean;
  totalGb: number;
  usedGb: number;
  onUpgrade: () => void;
}) {
  const tier: PlanTier = hasPaidVault ? "paid" : "free";
  const planName = hasPaidVault ? "Studio Vault — Paid" : "Studio Vault — Not activated";

  const percent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;

  return (
    <PlanVisibilityCard
      icon={Cloud}
      planName={planName}
      tier={tier}
      statusLine={
        hasPaidVault
          ? "Recurring vault active. Add capacity any time."
          : "Storage not activated. Choose a storage plan to begin uploading."
      }
      quotas={
        hasPaidVault
          ? [
              {
                label: "Allocated",
                used: totalGb >= 1024 ? `${(totalGb / 1024).toFixed(1)} TB` : `${totalGb.toFixed(0)} GB`,
                total: undefined,
              },
              {
                label: "Used",
                used: `${usedGb.toFixed(1)} GB`,
                total:
                  totalGb > 0
                    ? totalGb >= 1024
                      ? `${(totalGb / 1024).toFixed(1)} TB`
                      : `${totalGb.toFixed(0)} GB`
                    : undefined,
                percent: totalGb > 0 ? percent : undefined,
              },
            ]
          : []
      }
      ctaLabel={hasPaidVault ? "Manage" : "Upgrade Storage"}
      onCta={onUpgrade}
    />
  );
}
