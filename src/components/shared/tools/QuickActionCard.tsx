import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";

export type QuickActionCardProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "accent" | "warning";
  className?: string;
};

const TONE: Record<NonNullable<QuickActionCardProps["tone"]>, string> = {
  default: "hover:border-border hover:bg-secondary/30",
  accent: "border-accent/30 hover:border-accent/60 hover:bg-accent/5",
  warning: "border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-400/5",
};

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  cta,
  onClick,
  disabled,
  tone = "default",
  className,
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group text-left rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        TONE[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary/40 p-2 group-hover:bg-secondary/60 transition-colors">
          <Icon className="w-4 h-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description && (
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</div>
          )}
          {cta && (
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
              {cta}
              <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
