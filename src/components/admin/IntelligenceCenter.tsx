import { useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type LaneState = {
  loading: boolean;
  activeQuery?: string;
  results?: ResearchResult[];
  ranAt?: number;
};

export default function IntelligenceCenter() {
  const [state, setState] = useState<Record<LaneId, LaneState>>({
    buyers: { loading: false },
    festivals: { loading: false },
    industry: { loading: false },
    monitor: { loading: false },
  });
  const [customQuery, setCustomQuery] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customResults, setCustomResults] = useState<ResearchResult[] | null>(null);

  const runLane = async (lane: Lane, query: string) => {
    setState((s) => ({ ...s, [lane.id]: { loading: true, activeQuery: query } }));
    try {
      const { data, error } = await supabase.functions.invoke("research-firecrawl", {
        body: { category: lane.category, query, limit: 8 },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error === "firecrawl_not_connected") {
        toast.error("Firecrawl not connected. Link it in Settings → Integrations.");
        setState((s) => ({ ...s, [lane.id]: { loading: false } }));
        return;
      }
      const results = ((data as { results?: ResearchResult[] })?.results) ?? [];
      setState((s) => ({
        ...s,
        [lane.id]: { loading: false, activeQuery: query, results, ranAt: Date.now() },
      }));
    } catch (e) {
      toast.error(`Intelligence run failed: ${(e as Error).message}`);
      setState((s) => ({ ...s, [lane.id]: { loading: false } }));
    }
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

  const briefing = LANES.map((l) => ({
    id: l.id,
    label: l.label,
    count: state[l.id].results?.length ?? null,
    ranAt: state[l.id].ranAt,
  }));

  const totalFindings = briefing.reduce((n, b) => n + (b.count ?? 0), 0);

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
              Trigger any lane below to pull fresh, source-linked results. Nothing is stored — every
              finding is reviewed before it enters CRM, productions or outreach.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => LANES.forEach((l) => runLane(l, l.queries[0].query))}
            className="h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Run all lanes
          </Button>
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
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {b.count === null ? "—" : b.count}
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{lane.desc}</p>
                </div>
                {s.ranAt && (
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
                        disabled={s.loading}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-accent/15 text-accent border-accent/40"
                            : "bg-secondary/40 hover:bg-secondary text-foreground border-border/60"
                        } disabled:opacity-50`}
                      >
                        {s.loading && active ? (
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                        ) : (
                          <Sparkles className="w-3 h-3 inline mr-1 opacity-60" />
                        )}
                        {q.label}
                      </button>
                    );
                  })}
                </div>

                {!s.results && !s.loading && (
                  <div className="text-xs text-muted-foreground italic">
                    Pick a preset above to run this lane.
                  </div>
                )}

                {s.loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gathering intelligence…
                  </div>
                )}

                {s.results && s.results.length === 0 && (
                  <div className="text-xs text-muted-foreground">No results for this query.</div>
                )}

                {s.results && s.results.length > 0 && (
                  <ul className="divide-y divide-border/40 -mx-1">
                    {s.results.map((r, i) => (
                      <li key={`${r.url ?? r.title}-${i}`} className="px-1 py-2.5">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            {new URL(r.url).hostname}
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
                {r.url && (
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
