import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/lib/creator/titleApi";

const STYLES: Record<ContentStatus, string> = {
  draft:              "bg-secondary/30 text-foreground/80 border-border/50",
  incomplete:         "bg-amber-500/10 text-amber-300 border-amber-500/30",
  submitted:          "bg-sky-500/10 text-sky-300 border-sky-500/30",
  in_review:          "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  qc_review:          "bg-violet-500/10 text-violet-300 border-violet-500/30",
  legal_review:       "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30",
  changes_requested:  "bg-orange-500/10 text-orange-300 border-orange-500/30",
  approved:           "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected:           "bg-rose-500/10 text-rose-300 border-rose-500/30",
  hold:               "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
  published:          "bg-teal-500/10 text-teal-300 border-teal-500/30",
  archived:           "bg-muted/30 text-muted-foreground border-border/50",
};

const LABELS: Record<ContentStatus, string> = {
  draft: "Draft",
  incomplete: "Incomplete",
  submitted: "Submitted",
  in_review: "Under Review",
  qc_review: "QC Review",
  legal_review: "Legal Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  rejected: "Rejected",
  hold: "Hold",
  published: "Published",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5",
      STYLES[status] ?? STYLES.draft,
    )}>
      {LABELS[status] ?? status}
    </span>
  );
}
