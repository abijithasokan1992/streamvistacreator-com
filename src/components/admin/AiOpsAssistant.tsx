import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bot, ChevronRight, ChevronLeft, RefreshCw, AlertTriangle, TrendingUp,
  CheckCircle2, Clock, Sparkles,
} from "lucide-react";
import { useMissionSignals, type MissionSignal } from "./hooks/useMissionSignals";

/**
 * Persistent right-side AI Operations Assistant.
 * Reads from the shared useMissionSignals cache — never generates prose,
 * only surfaces actionable operational intelligence.
 */
export default function AiOpsAssistant() {
  const [open, setOpen] = useState(true);
  const nav = useNavigate();
  const { signals, health, critical, attention, info, totalOpen, etaMin, loading, refresh, lastUpdated } = useMissionSignals();

  const suggested: MissionSignal[] = [...critical, ...attention, ...info].filter(s => s.count > 0).slice(0, 3);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Ops Assistant"
        className="fixed right-3 top-24 z-40 h-11 w-11 rounded-full bg-gradient-primary text-primary-foreground shadow-lg grid place-items-center hover:scale-105 transition"
      >
        <Bot className="w-5 h-5" />
        {critical.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] font-bold text-white grid place-items-center px-1">
            {critical.reduce((s, x) => s + x.count, 0)}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className="fixed right-3 top-24 bottom-4 z-40 w-[320px] max-w-[92vw] rounded-2xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-secondary/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold leading-tight">Ops Assistant</div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              {lastUpdated ? `Updated ${fmtAgo(lastUpdated)}` : "Loading…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh"
            className="h-7 w-7 rounded-md hover:bg-secondary/60 grid place-items-center text-muted-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Collapse"
            className="h-7 w-7 rounded-md hover:bg-secondary/60 grid place-items-center text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {/* Health pill */}
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
          health.status === "red" ? "border-red-500/40 bg-red-500/5 text-red-300" :
          health.status === "yellow" ? "border-amber-500/40 bg-amber-500/5 text-amber-300" :
          "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
        }`}>
          {health.status === "green" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold">Platform Health</div>
            <div className="text-xs">{health.note}</div>
          </div>
        </div>

        {/* Snapshot */}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Open items" value={totalOpen} icon={<TrendingUp className="w-3.5 h-3.5" />} />
          <Stat label="ETA to clear" value={etaMin === 0 ? "0m" : etaMin < 60 ? `${etaMin}m` : `${Math.round(etaMin / 60)}h`} icon={<Clock className="w-3.5 h-3.5" />} />
        </div>

        {/* Categories */}
        <Category title="Critical" tone="danger" items={critical} nav={nav} />
        <Category title="Needs attention" tone="warn" items={attention} nav={nav} />
        <Category title="Information" tone="info" items={info} nav={nav} />

        {/* Suggested next actions */}
        {suggested.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Suggested next
            </div>
            <ol className="space-y-1">
              {suggested.map((s, i) => (
                <li key={s.key}>
                  <Link
                    to={`/admin?dept=${s.dept}&section=${s.section}`}
                    className="flex items-center gap-2 rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5 text-xs hover:border-accent/50"
                  >
                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center text-[10px] font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">Clear {s.label.toLowerCase()}</span>
                    <span className="text-[10px] text-muted-foreground">{s.count}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {totalOpen === 0 && !loading && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-4 text-center text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
            Queue is clear.
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/10 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-base font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Category({ title, tone, items, nav }: {
  title: string; tone: "danger" | "warn" | "info"; items: MissionSignal[];
  nav: (p: string) => void;
}) {
  if (items.length === 0) return null;
  const cls = tone === "danger" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-muted-foreground";
  return (
    <section>
      <div className={`text-[10px] uppercase tracking-wider mb-1 ${cls}`}>{title}</div>
      <ul className="space-y-1">
        {items.map(i => (
          <li key={i.key}>
            <button
              onClick={() => nav(`/admin?dept=${i.dept}&section=${i.section}`)}
              className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40 text-xs"
            >
              <span className="truncate text-left">{i.label}</span>
              <span className="text-xs font-bold shrink-0">{i.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function fmtAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
