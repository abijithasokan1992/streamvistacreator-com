import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ShieldAlert, ShieldQuestion } from "lucide-react";

type Status = "unverified" | "pending" | "verified" | "rejected";

const MAP: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  unverified: { label: "Not verified", cls: "bg-muted text-muted-foreground", icon: ShieldQuestion },
  pending:    { label: "Verification pending", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  verified:   { label: "Verified", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  rejected:   { label: "Verification rejected", cls: "bg-destructive/15 text-destructive", icon: ShieldAlert },
};

export function VerificationBadge({ status }: { status: Status }) {
  const cfg = MAP[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="secondary" className={`gap-1.5 ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}
