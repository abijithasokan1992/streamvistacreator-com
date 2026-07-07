import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RequestCard } from "../requests/RequestCard";
import { NewRequestForm } from "../requests/NewRequestForm";
import { STATE_LABEL, type Row, type Category } from "../requests/shared";
import { cn } from "@/lib/utils";

/**
 * Pipeline stages shown as the primary navigation for a buyer's requests.
 * Each stage maps to one or more underlying commercial_requests.state values
 * so buyers see business terminology instead of raw statuses.
 */
const PIPELINE = [
  { id: "submitted",    label: "Submitted",     states: ["pending_admin_review"] },
  { id: "review",       label: "Under review",  states: ["awaiting_creator_review"] },
  { id: "clarify",      label: "Clarification", states: ["more_info_required"] },
  { id: "negotiation",  label: "Negotiation",   states: ["approved_for_negotiation"] },
  { id: "agreement",    label: "Agreement",     states: ["agreement_pending"] },
  { id: "delivery",     label: "Delivery",      states: ["delivery_authorized"] },
  { id: "closed",       label: "Closed",        states: ["closed", "rejected"] },
] as const;

type StageId = typeof PIPELINE[number]["id"] | "all";

export default function RequestsSection({
  rows,
  loading,
  reload,
  onNeedsGate,
  composerOpen,
  onComposerChange,
  prefill,
  onPrefillConsumed,
}: {
  rows: Row[];
  loading: boolean;
  reload: () => void;
  onNeedsGate: () => void;
  composerOpen: boolean;
  onComposerChange: (open: boolean) => void;
  prefill: { category?: Category; title?: string } | null;
  onPrefillConsumed: () => void;
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageId>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const p of PIPELINE) c[p.id] = rows.filter(r => p.states.includes(r.state as never)).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const stageStates = stage === "all"
      ? null
      : PIPELINE.find(p => p.id === stage)?.states ?? null;
    return rows.filter(r => {
      if (stageStates && !stageStates.includes(r.state as never)) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        r.title_query, r.admin_notes, r.message,
        STATE_LABEL[r.state],
        r.terms?.territory, r.terms?.rights_category, r.terms?.exclusivity,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, stage]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">My requests</h2>
          <p className="text-sm text-muted-foreground">
            Track every acquisition, licensing and screener enquiry across the pipeline.
          </p>
        </div>
        <Button onClick={() => onComposerChange(true)}>
          <Plus className="w-4 h-4 mr-1.5" aria-hidden />
          New request
        </Button>
      </header>

      {/* Pipeline overview */}
      <nav aria-label="Request pipeline" className="-mx-2 px-2 overflow-x-auto">
        <ul className="flex gap-1.5 min-w-max pb-1">
          <li>
            <PipelineChip active={stage === "all"} label="All" count={counts.all} onClick={() => setStage("all")} />
          </li>
          {PIPELINE.map(p => (
            <li key={p.id}>
              <PipelineChip
                active={stage === p.id}
                label={p.label}
                count={counts[p.id] ?? 0}
                onClick={() => setStage(p.id)}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requests…"
          className="pl-8"
          aria-label="Search requests"
        />
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center" role="status" aria-label="Loading requests">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <h3 className="font-semibold">
            {rows.length === 0 ? "No requests yet" : "Nothing in this stage"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {rows.length === 0
              ? "Start a new request. Admin reviews every enquiry before looping in the title owner."
              : "Try a different pipeline stage or clear your search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 list-none">
          {filtered.map(r => <li key={r.id}><RequestCard row={r} /></li>)}
        </ul>
      )}

      <Dialog
        open={composerOpen}
        onOpenChange={(o) => { onComposerChange(o); if (!o) onPrefillConsumed(); }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
            <DialogDescription>
              Submit a commercial enquiry. Admin reviews every request before the title owner is contacted.
            </DialogDescription>
          </DialogHeader>
          <NewRequestForm
            defaultCategory={prefill?.category}
            defaultTitle={prefill?.title}
            onNeedsGate={onNeedsGate}
            onSubmitted={() => { onComposerChange(false); onPrefillConsumed(); reload(); }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PipelineChip({ active, label, count, onClick }: {
  active: boolean; label: string; count: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap",
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-secondary/20 border-border/50 hover:border-accent/50",
      )}
    >
      <span>{label}</span>
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full",
        active ? "bg-accent-foreground/15" : "bg-background/60 border border-border/40",
      )}>{count}</span>
    </button>
  );
}
