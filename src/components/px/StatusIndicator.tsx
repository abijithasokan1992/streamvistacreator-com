import { CheckCircle2, AlertTriangle, Loader2, Lock, Archive, XCircle, Circle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StreamVista Status Indicator — tri-modal (icon + text + color).
 * Never conveys state through color alone. WCAG 2.2 AA compliant.
 */
export type StatusKind =
  | "ready" | "processing" | "failed" | "warning"
  | "locked" | "archived" | "draft" | "approved" | "rejected";

const MAP: Record<StatusKind, { Icon: LucideIcon; label: string; tone: string }> = {
  ready:     { Icon: CheckCircle2,   label: "Ready",      tone: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  approved:  { Icon: CheckCircle2,   label: "Approved",   tone: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  processing:{ Icon: Loader2,        label: "Processing", tone: "text-sky-400 border-sky-500/30 bg-sky-500/5" },
  warning:   { Icon: AlertTriangle,  label: "Warning",    tone: "text-amber-400 border-amber-500/30 bg-amber-500/5" },
  failed:    { Icon: XCircle,        label: "Failed",     tone: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
  rejected:  { Icon: XCircle,        label: "Rejected",   tone: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
  locked:    { Icon: Lock,           label: "Locked",     tone: "text-muted-foreground border-border/60 bg-secondary/20" },
  archived:  { Icon: Archive,        label: "Archived",   tone: "text-muted-foreground border-border/60 bg-secondary/20" },
  draft:     { Icon: Circle,         label: "Draft",      tone: "text-muted-foreground border-border/60 bg-secondary/20" },
};

export function StatusIndicator({
  kind, label, className,
}: {
  kind: StatusKind;
  label?: string;
  className?: string;
}) {
  const cfg = MAP[kind];
  const text = label ?? cfg.label;
  return (
    <span
      role="status"
      aria-label={text}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono-tech uppercase tracking-[0.14em]",
        cfg.tone,
        className,
      )}
    >
      <cfg.Icon className={cn("w-3 h-3", kind === "processing" && "animate-spin")} aria-hidden="true" strokeWidth={2} />
      <span>{text}</span>
    </span>
  );
}
