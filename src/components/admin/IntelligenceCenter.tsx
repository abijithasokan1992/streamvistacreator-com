import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  ExternalLink,
  RefreshCw,
  Building2,
  Film,
  Newspaper,
  Radar,
  Search,
  Download,
  FileText,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Table as TableIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IntelligenceLaneTable, type StructuredLaneData } from "./IntelligenceLaneTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type ResearchResult = { title: string; url?: string; description?: string };
type LaneId = "buyers" | "festivals" | "industry" | "monitor";
type Lane = {
  id: LaneId;
  label: string;
  desc: string;
  icon: typeof Building2;
  category: string;
  queries: { label: string; query: string }[];
  accent: string;
};

const LANES: Lane[] = [
  {
    id: "buyers",
    label: "Marketplace & Buyers",
    desc: "OTT platforms, broadcasters and distributors actively acquiring content.",
    icon: Building2,
    category: "ott",
    accent: "from-sky-500/20 to-transparent",
    queries: [
      { label: "OTT acquisition news (India)", query: "OTT platform content acquisition India 2026" },
      { label: "Global distributors seeking films", query: "film distributor acquisitions looking for indie titles" },
      { label: "Broadcaster licensing deals", query: "television broadcaster licensing deals announcement 2026" },
    ],
  },
  {
    id: "festivals",
    label: "Film Festivals",
    desc: "Upcoming submission deadlines and market openings.",
    icon: Film,
    category: "festival",
    accent: "from-amber-500/20 to-transparent",
    queries: [
      { label: "Open submissions this quarter", query: "film festival open for submissions deadline 2026" },
      { label: "Co-production markets", query: "co-production market film 2026 application deadline" },
      { label: "Award-qualifying festivals", query: "Oscar BAFTA qualifying film festival submission 2026" },
    ],
  },
  {
    id: "industry",
    label: "Industry News & Tech",
    desc: "AI, cameras, workflows and distribution updates.",
    icon: Newspaper,
    category: "studio",
    accent: "from-emerald-500/20 to-transparent",
    queries: [
      { label: "AI in post-production", query: "AI post-production workflow announcement 2026" },
      { label: "Cinema camera launches", query: "cinema camera release announcement 2026" },
      { label: "Cloud media workflows", query: "cloud media pipeline camera-to-cloud news 2026" },
    ],
  },
  {
    id: "monitor",
    label: "Brand & Competitor Monitor",
    desc: "Mentions of StreamVista, Crayons Pictures and key competitors.",
    icon: Radar,
    category: "distributor",
    accent: "from-fuchsia-500/20 to-transparent",
    queries: [
      { label: "StreamVista mentions", query: "StreamVista Cloud X press coverage" },
      { label: "Crayons Pictures mentions", query: "Crayons Pictures film production news" },
      { label: "Competitor moves (Frame.io, Netflix, Prime Video)", query: "Frame.io Netflix Prime Video creator tools announcement 2026" },
    ],
  },
];

type LaneStatus = "idle" | "loading" | "success" | "error";
type LaneView = "list" | "structured";
type LaneState = {
  status: LaneStatus;
  activeQuery?: string;
  results?: ResearchResult[];
  ranAt?: number;
  error?: string;
  view?: LaneView;
  structured?: StructuredLaneData;
  structuredLoading?: boolean;
  structuredError?: string;
};
type SnapshotSummary = {
  id: string;
  created_at: string;
  source: string;
  total_signals: number;
  lanes_count: number;
};

const initialState = (): Record<LaneId, LaneState> => ({
  buyers: { status: "idle" },
  festivals: { status: "idle" },
  industry: { status: "idle" },
  monitor: { status: "idle" },
});

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function IntelligenceCenter() {
  const [state, setState] = useState<Record<LaneId, LaneState>>(initialState());
  const [customQuery, setCustomQuery] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customResults, setCustomResults] = useState<ResearchResult[] | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const { data, error } = await supabase.functions.invoke("intelligence-snapshots?action=list", {
        method: "GET",
      });
      if (error) throw new Error(error.message);
      setSnapshots(((data as { snapshots?: SnapshotSummary[] })?.snapshots) ?? []);
    } catch (e) {
      // Non-fatal
      console.warn("snapshot load failed", e);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const runLane = async (lane: Lane, query: string): Promise<LaneState> => {
    setState((s) => ({ ...s, [lane.id]: { status: "loading", activeQuery: query } }));
    try {
      const { data, error } = await supabase.functions.invoke("research-firecrawl", {
        body: { category: lane.category, query, limit: 8 },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error === "firecrawl_not_connected") {
        const next: LaneState = { status: "error", activeQuery: query, error: "Firecrawl not connected." };
        setState((s) => ({ ...s, [lane.id]: next }));
        toast.error("Firecrawl not connected. Link it in Settings → Integrations.");
        return next;
      }
      const results = ((data as { results?: ResearchResult[] })?.results) ?? [];
      const next: LaneState = { status: "success", activeQuery: query, results, ranAt: Date.now() };
      setState((s) => ({ ...s, [lane.id]: next }));
      return next;
    } catch (e) {
      const msg = (e as Error).message;
      const next: LaneState = { status: "error", activeQuery: query, error: msg };
      setState((s) => ({ ...s, [lane.id]: next }));
      toast.error(`Intelligence run failed: ${msg}`);
      return next;
    }
  };

  const saveSnapshot = async (finalState: Record<LaneId, LaneState>) => {
    setSavingSnapshot(true);
    try {
      const lanes: Record<string, unknown> = {};
      let total = 0;
      let laneCount = 0;
      for (const lane of LANES) {
        const s = finalState[lane.id];
        const results = s.results ?? [];
        lanes[lane.id] = {
          label: lane.label,
          activeQuery: s.activeQuery,
          results,
          error: s.error,
        };
        total += results.length;
        if (results.length > 0) laneCount += 1;
      }
      const { error } = await supabase.functions.invoke("intelligence-snapshots?action=save", {
        body: { payload: { lanes }, total_signals: total, lanes_count: laneCount },
      });
      if (error) throw new Error(error.message);
      toast.success("Snapshot saved");
      loadSnapshots();
    } catch (e) {
      toast.error(`Snapshot save failed: ${(e as Error).message}`);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const refreshAll = async () => {
    setRefreshingAll(true);
    const results = await Promise.all(
      LANES.map((lane) => runLane(lane, lane.queries[0].query)),
    );
    // Build a final state map since setState updates are async.
    const finalState: Record<LaneId, LaneState> = { ...state };
    LANES.forEach((lane, i) => {
      finalState[lane.id] = results[i];
    });
    setRefreshingAll(false);
    await saveSnapshot(finalState);
  };

  const runCustom = async () => {
    if (!customQuery.trim()) return;
    setCustomLoading(true);
    setCustomResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("research-firecrawl", {
        body: { category: "production_company", query: customQuery.trim(), limit: 10 },
      });
      if (error) throw new Error(error.message);
      setCustomResults(((data as { results?: ResearchResult[] })?.results) ?? []);
    } catch (e) {
      toast.error(`Search failed: ${(e as Error).message}`);
    } finally {
      setCustomLoading(false);
    }
  };

  const loadSnapshot = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        `intelligence-snapshots?action=get&id=${encodeURIComponent(id)}`,
        { method: "GET" },
      );
      if (error) throw new Error(error.message);
      const snap = (data as { snapshot?: { created_at: string; payload?: { lanes?: Record<string, { activeQuery?: string; results?: ResearchResult[]; error?: string }> } } })?.snapshot;
      if (!snap) return;
      const ts = new Date(snap.created_at).getTime();
      const next = initialState();
      for (const lane of LANES) {
        const l = snap.payload?.lanes?.[lane.id];
        if (l) {
          next[lane.id] = {
            status: l.error ? "error" : "success",
            activeQuery: l.activeQuery,
            results: l.results ?? [],
            ranAt: ts,
            error: l.error,
          };
        }
      }
      setState(next);
      toast.success(`Loaded snapshot from ${new Date(snap.created_at).toLocaleString()}`);
    } catch (e) {
      toast.error(`Load failed: ${(e as Error).message}`);
    }
  };

  const exportCsv = () => {
    const rows: string[] = ["Lane,Query,Title,URL,Description"];
    for (const lane of LANES) {
      const s = state[lane.id];
      if (!s.results || s.results.length === 0) continue;
      for (const r of s.results) {
        rows.push([lane.label, s.activeQuery ?? "", r.title, r.url ?? "", r.description ?? ""].map(csvEscape).join(","));
      }
    }
    if (rows.length === 1) {
      toast.error("No results to export. Run a lane first.");
      return;
    }
    download(`intelligence-${Date.now()}.csv`, "text/csv", rows.join("\n"));
    toast.success("CSV downloaded");
  };

  const exportPdf = () => {
    const any = LANES.some((l) => (state[l.id].results?.length ?? 0) > 0);
    if (!any) {
      toast.error("No results to export. Run a lane first.");
      return;
    }
    const now = new Date().toLocaleString();
    const sections = LANES.map((lane) => {
      const s = state[lane.id];
      const results = s.results ?? [];
      const rows = results
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.title)}</td><td>${
              isSafeUrl(r.url) ? `<a href="${safeHref(r.url)}" rel="noreferrer noopener">${escapeHtml(r.url!)}</a>` : escapeHtml(r.url ?? "")
            }</td><td>${escapeHtml(r.description ?? "")}</td></tr>`,
        )
        .join("");
      return `
        <section>
          <h2>${escapeHtml(lane.label)}</h2>
          <p class="q">Query: ${escapeHtml(s.activeQuery ?? "—")}</p>
          ${
            results.length
              ? `<table><thead><tr><th>Title</th><th>Source</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`
              : `<p class="empty">No results.</p>`
          }
        </section>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Intelligence Briefing — ${now}</title>
      <style>
        body{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;margin:32px}
        h1{font-size:20px;margin:0 0 4px}
        h2{font-size:14px;margin:24px 0 4px;border-bottom:1px solid #ddd;padding-bottom:4px}
        .meta{color:#666;font-size:11px;margin-bottom:16px}
        .q{color:#555;font-size:11px;margin:0 0 8px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{text-align:left;padding:6px 8px;vertical-align:top;border-bottom:1px solid #eee}
        th{background:#f6f6f6}
        a{color:#0645ad;text-decoration:none;word-break:break-all}
        .empty{color:#888;font-size:11px;font-style:italic}
        @media print { body{margin:16mm} }
      </style></head><body>
      <h1>Business Intelligence Briefing</h1>
      <div class="meta">Generated ${escapeHtml(now)} · StreamVista Cloud X</div>
      ${sections}
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup blocked. Allow popups to export PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const briefing = LANES.map((l) => ({
    id: l.id,
    label: l.label,
    count: state[l.id].results?.length ?? null,
    ranAt: state[l.id].ranAt,
    status: state[l.id].status,
  }));
  const totalFindings = briefing.reduce((n, b) => n + (b.count ?? 0), 0);
  const anyLoading = refreshingAll || Object.values(state).some((s) => s.status === "loading");

  return (
    <div className="space-y-6">
      {/* Today's Intelligence */}
      <section className="rounded-2xl border border-border/50 bg-gradient-to-br from-accent/10 via-background to-background p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Today's Intelligence
            </div>
            <h2 className="font-display text-2xl mt-2">
              {totalFindings === 0
                ? "No briefings run yet"
                : `${totalFindings} signals across ${briefing.filter((b) => b.count).length} lanes`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Automatic daily refresh at 06:00 UTC. Snapshots are timestamped so you can compare
              intelligence over time. Every finding is source-linked.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={refreshAll}
              disabled={anyLoading}
              className="h-9"
            >
              {refreshingAll ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
              )}
              Refresh Intelligence
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCsv}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {briefing.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-border/40 bg-background/50 px-3 py-2.5"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                {b.label}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums flex items-center gap-1.5">
                {b.status === "loading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : b.status === "error" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                ) : b.count === null ? (
                  "—"
                ) : (
                  b.count
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {b.ranAt ? new Date(b.ranAt).toLocaleTimeString() : "not run"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {LANES.map((lane) => {
          const s = state[lane.id];
          const Icon = lane.icon;
          return (
            <section
              key={lane.id}
              className={`rounded-2xl border border-border/50 bg-gradient-to-br ${lane.accent} bg-card overflow-hidden`}
            >
              <header className="p-5 flex items-start justify-between gap-3 border-b border-border/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-accent" />
                    <h3 className="font-semibold text-sm">{lane.label}</h3>
                    <StatusPill status={s.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{lane.desc}</p>
                </div>
                {s.status === "success" && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {s.results?.length ?? 0} results
                  </Badge>
                )}
              </header>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {lane.queries.map((q) => {
                    const active = s.activeQuery === q.query;
                    return (
                      <button
                        key={q.label}
                        onClick={() => runLane(lane, q.query)}
                        disabled={s.status === "loading"}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-accent/15 text-accent border-accent/40"
                            : "bg-secondary/40 hover:bg-secondary text-foreground border-border/60"
                        } disabled:opacity-50`}
                      >
                        {s.status === "loading" && active ? (
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                        ) : (
                          <Sparkles className="w-3 h-3 inline mr-1 opacity-60" />
                        )}
                        {q.label}
                      </button>
                    );
                  })}
                </div>

                {s.status === "idle" && (
                  <div className="text-xs text-muted-foreground italic">
                    Pick a preset above to run this lane.
                  </div>
                )}

                {s.status === "loading" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gathering intelligence…
                  </div>
                )}

                {s.status === "error" && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">Firecrawl run failed</div>
                      <div className="opacity-80 truncate">{s.error ?? "Unknown error"}</div>
                      <button
                        onClick={() => runLane(lane, s.activeQuery ?? lane.queries[0].query)}
                        className="mt-1 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {s.status === "success" && s.results && s.results.length === 0 && (
                  <div className="text-xs text-muted-foreground">No results for this query.</div>
                )}

                {s.status === "success" && s.results && s.results.length > 0 && (
                  <ul className="divide-y divide-border/40 -mx-1">
                    {s.results.map((r, i) => (
                      <li key={`${r.url ?? r.title}-${i}`} className="px-1 py-2.5">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                        {isSafeUrl(r.url) && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            {safeHost(r.url!)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Snapshots history */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Snapshot history</h3>
            {savingSnapshot && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          <Button variant="ghost" size="sm" onClick={loadSnapshots} disabled={loadingSnapshots} className="h-8">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingSnapshots ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Every manual refresh and the 06:00 UTC daily job save a timestamped snapshot. Click any row
          to restore it into the view above for comparison.
        </p>
        {snapshots.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No snapshots yet. Run "Refresh Intelligence" to save the first one.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {snapshots.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => loadSnapshot(s.id)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/40 rounded px-2 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.source === "cron" ? "Daily job" : "Manual"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {s.total_signals} signals · {s.lanes_count} lanes
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ad-hoc search fallback */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Ad-hoc intelligence query</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          For one-off lookups outside the standard lanes. Results are ephemeral.
        </p>
        <div className="flex gap-2">
          <Input
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="e.g. Sony Pictures India acquisitions 2026"
            onKeyDown={(e) => e.key === "Enter" && runCustom()}
            disabled={customLoading}
          />
          <Button onClick={runCustom} disabled={customLoading || !customQuery.trim()}>
            {customLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="ml-2">Run</span>
          </Button>
        </div>

        {customResults && customResults.length > 0 && (
          <ul className="mt-4 divide-y divide-border/40">
            {customResults.map((r, i) => (
              <li key={`${r.url ?? r.title}-${i}`} className="py-2.5">
                <div className="text-sm font-medium">{r.title}</div>
                {r.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {r.description}
                  </p>
                )}
                {isSafeUrl(r.url) && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    {r.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: LaneStatus }) {
  if (status === "loading")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> updating
      </span>
    );
  if (status === "success")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500">
        <CheckCircle2 className="w-3 h-3" /> live
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
        <AlertTriangle className="w-3 h-3" /> error
      </span>
    );
  return null;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

// Only allow http(s) URLs. Blocks javascript:, data:, vbscript:, etc. XSS via
// externally-sourced Firecrawl result URLs rendered in the same-origin popup.
function safeHref(url: string | undefined | null): string {
  if (!url) return "#";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
    return escapeHtml(u.toString());
  } catch {
    return "#";
  }
}

function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
