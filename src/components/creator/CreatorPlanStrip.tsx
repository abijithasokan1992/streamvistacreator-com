import { Sparkles } from "lucide-react";
import { PlanVisibilityCard, type PlanTier } from "@/components/shared/tools";
import type { FreeTierStatus, TitleRow } from "@/lib/creator/titleApi";

/**
 * Plan visibility strip for the Creator dashboard.
 * Reads only data the dashboard already has — no extra fetches.
 */
export default function CreatorPlanStrip({
  isFree,
  tier,
  titles,
  onUpgrade,
}: {
  isFree: boolean;
  tier: FreeTierStatus | null;
  titles: TitleRow[];
  onUpgrade: () => void;
}) {
  const planTier: PlanTier = isFree ? "free" : "paid";
  const planName = isFree ? "Creator Free" : "Creator Premium";

  const lifecycle = tier?.lifecycle_count ?? 0;
  const maxSubs = tier?.max_submissions;
  const drafts = titles.filter((t) => t.status === "draft" || t.status === "incomplete").length;
  const submitted = titles.filter((t) =>
    ["submitted", "in_review", "qc_review", "legal_review"].includes(t.status),
  ).length;
  const approved = titles.filter((t) => t.status === "approved" || t.status === "ready_for_distribution").length;

  const submissionPath = approved > 0
    ? `${approved} approved · ${submitted} in review`
    : submitted > 0
      ? `${submitted} in review · ${drafts} draft${drafts === 1 ? "" : "s"}`
      : drafts > 0
        ? `${drafts} draft${drafts === 1 ? "" : "s"} — keep going`
        : "No titles yet — start a draft";

  const quotas = [
    {
      label: "Storage",
      used: isFree ? "Free allocation" : "Premium allocation",
      total: isFree ? "limited" : "5 TB",
    },
    {
      label: "Titles",
      used: String(lifecycle),
      total: maxSubs == null ? "unlimited" : String(maxSubs),
      percent: maxSubs ? Math.min(100, Math.round((lifecycle / maxSubs) * 100)) : undefined,
    },
  ];

  return (
    <PlanVisibilityCard
      icon={Sparkles}
      planName={planName}
      tier={planTier}
      quotas={quotas}
      statusLine={submissionPath}
      ctaLabel={isFree ? "Upgrade" : "Manage"}
      onCta={onUpgrade}
    />
  );
}
