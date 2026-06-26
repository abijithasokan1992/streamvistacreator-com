import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Sparkles, type LucideIcon } from "lucide-react";

export type PlanTier = "free" | "paid" | "managed" | "founder" | "custom";

const TIER_PILL: Record<PlanTier, string> = {
  free: "bg-secondary/60 text-muted-foreground",
  paid: "bg-accent/15 text-accent",
  managed: "bg-sky-500/15 text-sky-300",
  founder: "bg-amber-500/15 text-amber-300",
  custom: "bg-violet-500/15 text-violet-300",
};

const TIER_LABEL: Record<PlanTier, string> = {
  free: "Free",
  paid: "Paid",
  managed: "Managed",
  founder: "Founder",
  custom: "Custom",
};

export type PlanVisibilityQuota = {
  label: string;
  used?: string;
  total?: string;
  percent?: number; // 0..100
};

export function PlanVisibilityCard({
  planName,
  tier,
  quotas = [],
  statusLine,
  ctaLabel,
  onCta,
  icon: Icon = Sparkles,
  className,
}: {
  planName: string;
  tier: PlanTier;
  quotas?: PlanVisibilityQuota[];
  statusLine?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-gradient-to-br from-card/60 to-card/30 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-lg bg-secondary/40 p-2">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current plan</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-semibold text-foreground truncate">{planName}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", TIER_PILL[tier])}>
                {TIER_LABEL[tier]}
              </span>
            </div>
            {statusLine && <div className="text-xs text-muted-foreground mt-1">{statusLine}</div>}
          </div>
        </div>
        {ctaLabel && onCta && (
          <Button size="sm" variant="outline" onClick={onCta} className="shrink-0">
            {ctaLabel}
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>

      {quotas.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quotas.map((q, i) => (
            <div key={i} className="rounded-lg bg-secondary/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{q.label}</span>
                {(q.used || q.total) && (
                  <span className="text-foreground font-medium">
                    {q.used}
                    {q.total ? ` / ${q.total}` : ""}
                  </span>
                )}
              </div>
              {typeof q.percent === "number" && (
                <div className="mt-2 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      q.percent > 90 ? "bg-red-400" : q.percent > 75 ? "bg-amber-400" : "bg-accent",
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, q.percent))}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
