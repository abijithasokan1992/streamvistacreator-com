import { useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import { StatusBadge } from "@/components/creator/title/StatusBadge";
import type { SectionId } from "@/components/creator/CreatorSidebar";
import { cn } from "@/lib/utils";

/**
 * Submissions — cross-title operational queue for the creator.
 * Practical queue, not a reporting dashboard. Groups owner's titles by state.
 */

type BucketId = "draft" | "submitted" | "review" | "approved";
type Bucket = { id: BucketId; label: string; match: (s: string) => boolean };

const BUCKETS: Bucket[] = [
  { id: "draft",     label: "Drafts",            match: (s) => s === "draft" || s === "incomplete" || s === "changes_requested" },
  { id: "submitted", label: "Submitted",         match: (s) => s === "submitted" },
  { id: "review",    label: "In Review",         match: (s) => s === "in_review" || s === "qc_review" || s === "legal_review" || s === "hold" },
  { id: "approved",  label: "Approved / Ready",  match: (s) => s === "approved" || s === "ready_for_distribution" || s === "published" },
];

export default function SubmissionsSection({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BucketId | "all">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try { setTitles(await listTitles(user.id)); } finally { setLoading(false); }
    })();
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: titles.length };
    for (const b of BUCKETS) c[b.id] = titles.filter((t) => b.match(t.status)).length;
    return c;
  }, [titles]);

  const filtered = useMemo(() => {
    if (active === "all") return titles;
    const b = BUCKETS.find((x) => x.id === active)!;
    return titles.filter((t) => b.match(t.status));
  }, [active, titles]);

  if (loading) {
    return <div className="grid place-items-center py-16"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip label={`All (${counts.all})`} active={active === "all"} onClick={() => setActive("all")} />
        {BUCKETS.map((b) => (
          <Chip key={b.id} label={`${b.label} (${counts[b.id] ?? 0})`} active={active === b.id} onClick={() => setActive(b.id)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 p-10 text-center">
          <Inbox className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Once you submit a title, you'll track its review status here.
          </p>
          <button
            onClick={() => onNavigate("titles")}
            className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open Titles <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border/30 rounded-xl border border-border/40 bg-secondary/5">
          {filtered.map((t) => (
            <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={t.status} />
                <button
                  onClick={() => onNavigate("titles")}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Open <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs rounded-full border px-3 py-1.5 transition-colors",
        active
          ? "border-accent/60 bg-accent/15 text-foreground"
          : "border-border/40 bg-secondary/5 text-muted-foreground hover:bg-secondary/20",
      )}
    >
      {label}
    </button>
  );
}
