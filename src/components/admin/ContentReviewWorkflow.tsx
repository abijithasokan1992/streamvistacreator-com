import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, ClipboardList, History } from "lucide-react";
import { toast } from "sonner";

type Status =
  | "submitted" | "in_review" | "qc_review" | "legal_review"
  | "approved" | "ready_for_distribution"
  | "changes_requested" | "hold" | "rejected" | "archived"
  | "draft" | "incomplete" | "locked"
  // legacy enum value — kept for backward-compat reads only; not surfaced as a queue or transition.
  | "published";

interface QueueRow {
  id: string;
  title: string;
  status: Status;
  previous_status: Status | null;
  owner_user_id: string;
  owner_email: string | null;
  workspace_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  locked: boolean;
  latest_note: string | null;
  updated_at: string;
}

interface HistoryRow {
  kind: "approval" | "audit";
  occurred_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  from_status: string | null;
  to_status: string | null;
  action: string | null;
  note: string | null;
  details: any;
}

// Current review workflow does NOT include "published" — the terminal positive
// state is "ready_for_distribution". Commercial release is a future stream.
const QUEUES: { value: Status; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In Review" },
  { value: "qc_review", label: "QC Review" },
  { value: "legal_review", label: "Legal Review" },
  { value: "approved", label: "Approved" },
  { value: "ready_for_distribution", label: "Ready For Distribution" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "hold", label: "Hold" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

const TRANSITIONS: Record<string, { value: Status; label: string; variant?: any }[]> = {
  submitted: [
    { value: "in_review", label: "Start Review" },
    { value: "changes_requested", label: "Request Changes" },
    { value: "hold", label: "Hold" },
    { value: "rejected", label: "Reject", variant: "destructive" },
  ],
  in_review: [
    { value: "qc_review", label: "Send to QC" },
    { value: "changes_requested", label: "Request Changes" },
    { value: "hold", label: "Hold" },
    { value: "rejected", label: "Reject", variant: "destructive" },
  ],
  qc_review: [
    { value: "legal_review", label: "Send to Legal" },
    { value: "changes_requested", label: "Request Changes" },
    { value: "hold", label: "Hold" },
    { value: "rejected", label: "Reject", variant: "destructive" },
  ],
  legal_review: [
    { value: "approved", label: "Approve" },
    { value: "changes_requested", label: "Request Changes" },
    { value: "hold", label: "Hold" },
    { value: "rejected", label: "Reject", variant: "destructive" },
  ],
  approved: [
    { value: "ready_for_distribution", label: "Mark Ready For Distribution" },
    { value: "hold", label: "Hold" },
  ],
  ready_for_distribution: [
    { value: "hold", label: "Hold" },
    { value: "archived", label: "Archive" },
  ],
  hold: [
    { value: "in_review", label: "Resume → In Review" },
    { value: "qc_review", label: "Resume → QC" },
    { value: "legal_review", label: "Resume → Legal" },
    { value: "approved", label: "Resume → Approved" },
    { value: "ready_for_distribution", label: "Resume → Ready For Distribution" },
    { value: "rejected", label: "Reject", variant: "destructive" },
  ],
};

function statusColor(s: string) {
  switch (s) {
    case "approved": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "ready_for_distribution": return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "rejected": return "bg-red-500/15 text-red-300 border-red-500/30";
    case "hold": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "changes_requested": return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    case "archived": return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    default: return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  }
}

export default function ContentReviewWorkflow() {
  const [activeTab, setActiveTab] = useState<Status>("submitted");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalTitles, setTotalTitles] = useState(0);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [note, setNote] = useState("");
  const [transitionBusy, setTransitionBusy] = useState<string | null>(null);

  const loadQueue = useCallback(async (status: Status) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_review_queue", { _status: status });
    if (error) toast.error(error.message);
    setRows((data as QueueRow[]) || []);
    setLoading(false);
  }, []);

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("content_titles")
      .select("status");
    if (error) return;
    const c: Record<string, number> = {};
    (data || []).forEach((r: any) => { c[r.status] = (c[r.status] || 0) + 1; });
    setCounts(c);
    setTotalTitles((data || []).length);
  }, []);

  useEffect(() => { loadQueue(activeTab); }, [activeTab, loadQueue]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const openReview = async (row: QueueRow) => {
    setSelected(row);
    setNote("");
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc("admin_title_history", { _title_id: row.id });
    if (error) toast.error(error.message);
    setHistory((data as HistoryRow[]) || []);
    setHistoryLoading(false);
  };

  const runTransition = async (to: Status) => {
    if (!selected) return;
    setTransitionBusy(to);
    const { data, error } = await supabase.rpc("transition_title_status", {
      _title_id: selected.id, _to_status: to, _note: note || null,
    });
    setTransitionBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status → ${to}`);
    setSelected(null);
    setNote("");
    await Promise.all([loadQueue(activeTab), loadCounts()]);
    void data;
  };

  const counterTiles = useMemo(() => ([
    ...QUEUES.map(q => ({ label: q.label, value: counts[q.value] || 0 })),
    { label: "Total Titles", value: totalTitles },
  ]), [counts, totalTitles]);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-sky-400" />
          <CardTitle>Content Review Workflow</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadQueue(activeTab); loadCounts(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {counterTiles.map(t => (
            <div key={t.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="text-2xl font-semibold">{t.value}</div>
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Status)}>
          <TabsList className="flex flex-wrap h-auto">
            {QUEUES.map(q => (
              <TabsTrigger key={q.value} value={q.value} className="text-xs">
                {q.label}{typeof counts[q.value] === "number" ? ` (${counts[q.value]})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
          {QUEUES.map(q => (
            <TabsContent key={q.value} value={q.value} className="mt-4">
              <div className="overflow-x-auto rounded-md border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Submitted</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Latest Note</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        <Loader2 className="inline w-4 h-4 animate-spin mr-2" /> Loading…
                      </td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No titles in this queue.</td></tr>
                    ) : rows.map(r => (
                      <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{r.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.owner_email || r.owner_user_id}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[280px] truncate">{r.latest_note || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openReview(r)}>Review</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Owner" value={selected.owner_email || selected.owner_user_id} />
                <Info label="Workspace" value={selected.workspace_id || "—"} />
                <Info label="Status" value={<Badge variant="outline" className={statusColor(selected.status)}>{selected.status}</Badge>} />
                <Info label="Locked" value={selected.locked ? "Yes" : "No"} />
                <Info label="Submitted" value={selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : "—"} />
                <Info label="Approved" value={selected.approved_at ? new Date(selected.approved_at).toLocaleString() : "—"} />
                {selected.published_at && (
                  <Info label="Published (legacy)" value={new Date(selected.published_at).toLocaleString()} />
                )}
                <Info label="Previous Status" value={selected.previous_status || "—"} />
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Review Note</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for this transition…" rows={3} />
              </div>

              <div className="flex flex-wrap gap-2">
                {(TRANSITIONS[selected.status] || []).map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={opt.variant || "default"}
                    disabled={!!transitionBusy}
                    onClick={() => runTransition(opt.value)}
                  >
                    {transitionBusy === opt.value && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {opt.label}
                  </Button>
                ))}
                {!TRANSITIONS[selected.status] && (
                  <div className="text-sm text-muted-foreground">No transitions available from <code>{selected.status}</code>.</div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <History className="w-4 h-4" /> Status Timeline
                </div>
                {historyLoading ? (
                  <div className="text-muted-foreground text-sm"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No history yet.</div>
                ) : (
                  <ol className="space-y-2">
                    {history.map((h, i) => (
                      <li key={i} className="rounded-md border border-border/40 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {h.kind === "approval"
                              ? `${h.from_status || "—"} → ${h.to_status || "—"}`
                              : (h.action || "audit")}
                          </span>
                          <span className="text-muted-foreground">{new Date(h.occurred_at).toLocaleString()}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {h.actor_email || h.actor_user_id || "system"}{h.note ? ` — ${h.note}` : ""}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
