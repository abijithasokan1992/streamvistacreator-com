import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestCard } from "../requests/RequestCard";
import { NewRequestForm } from "../requests/NewRequestForm";
import { STATE_LABEL, type Row, type Category } from "../requests/shared";

type Filter = "all" | "open" | "active" | "closed";

const OPEN = ["pending_admin_review", "awaiting_creator_review", "more_info_required"];
const ACTIVE = ["awaiting_creator_review", "approved_for_negotiation", "agreement_pending"];
const CLOSED = ["closed", "rejected", "delivery_authorized"];

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
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === "open"   && !OPEN.includes(r.state))   return false;
      if (filter === "active" && !ACTIVE.includes(r.state)) return false;
      if (filter === "closed" && !CLOSED.includes(r.state)) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        r.title_query, r.admin_notes, r.message,
        STATE_LABEL[r.state],
        r.terms?.territory, r.terms?.rights_category, r.terms?.exclusivity,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, filter]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Acquisition requests</h2>
          <p className="text-sm text-muted-foreground">
            Every commercial enquiry is admin-mediated. Track status, messages and timeline in one place.
          </p>
        </div>
        <Button onClick={() => onComposerChange(!composerOpen)} aria-expanded={composerOpen}>
          <Plus className="w-4 h-4 mr-1.5" aria-hidden />
          {composerOpen ? "Hide new request" : "New request"}
        </Button>
      </header>

      {composerOpen && (
        <NewRequestForm
          defaultCategory={prefill?.category}
          defaultTitle={prefill?.title}
          onNeedsGate={onNeedsGate}
          onSubmitted={() => { onComposerChange(false); onPrefillConsumed(); reload(); }}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="sm:w-44" aria-label="Filter requests">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All requests</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="active">Active conversation</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center" role="status" aria-label="Loading requests">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <h3 className="font-semibold">
            {rows.length === 0 ? "No requests yet" : "No requests match"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {rows.length === 0
              ? "Submit an acquisition, licensing, screener or rights enquiry. Admin reviews every request before looping in the title owner."
              : "Try clearing the search or filters."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 list-none">
          {filtered.map(r => <li key={r.id}><RequestCard row={r} /></li>)}
        </ul>
      )}
    </section>
  );
}
