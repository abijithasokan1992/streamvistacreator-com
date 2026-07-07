import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, X, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useMissionSignals } from "./hooks/useMissionSignals";

/**
 * Floating Action Center — a single collapsible list of everything the
 * single operator needs to act on. Each item deep-links to the affected
 * workspace/section.
 */
export default function ActionCenter() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { signals, totalOpen, critical, refresh, loading } = useMissionSignals();

  const badgeCount = critical.reduce((s, x) => s + x.count, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Action Center"
        className="fixed bottom-5 right-5 z-40 h-14 pl-4 pr-5 rounded-full bg-gradient-primary text-primary-foreground shadow-2xl flex items-center gap-2 hover:scale-105 transition"
      >
        <Zap className="w-5 h-5" />
        <span className="text-sm font-semibold">Actions</span>
        <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-background/25 grid place-items-center text-xs font-bold">
          {totalOpen}
        </span>
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-red-500 text-[10px] font-bold text-white grid place-items-center px-1">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full sm:max-w-md rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40 bg-secondary/20">
              <div>
                <h3 className="font-display text-sm font-bold">Action Center</h3>
                <p className="text-[11px] text-muted-foreground">{totalOpen} item{totalOpen === 1 ? "" : "s"} pending</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="h-8 w-8 rounded-md hover:bg-secondary/60 grid place-items-center text-muted-foreground"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button onClick={() => setOpen(false)} aria-label="Close" className="h-8 w-8 rounded-md hover:bg-secondary/60 grid place-items-center text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/40">
              {totalOpen === 0 && (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold mt-2">Queue is clear.</p>
                  <p className="text-xs text-muted-foreground mt-1">Nothing needs your attention right now.</p>
                </div>
              )}
              {signals.filter(s => s.count > 0).map(s => (
                <button
                  key={s.key}
                  onClick={() => { setOpen(false); nav(`/admin?dept=${s.dept}&section=${s.section}`); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 text-left transition"
                >
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                    s.tone === "danger" ? "bg-red-500/15 text-red-300" :
                    s.tone === "warn"   ? "bg-amber-500/15 text-amber-300" :
                                          "bg-secondary/50 text-foreground"
                  }`}>
                    {s.count}
                  </span>
                  <span className="flex-1 text-sm">{s.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
