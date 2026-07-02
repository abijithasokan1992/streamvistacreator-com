import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE_PILL: Record<Tone, string> = {
  neutral: "bg-secondary/60 text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
  accent: "bg-accent/15 text-accent",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  accent: "bg-accent",
};

export function StatusSummaryCard({
  icon: Icon,
  label,
  value,
  status,
  tone = "neutral",
  progress,
  footer,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  status?: string;
  tone?: Tone;
  progress?: number; // 0..100
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground truncate">{value}</div>
        </div>
        {status && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              TONE_PILL[tone],
            )}
          >
            {status}
          </span>
        )}
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
