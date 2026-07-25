import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, MinusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: "bulk_approve" | "bulk_sendback";
  offer_ids: string[];
  outcomes: Array<{ id: string; name: string; result: "ok" | "skipped" | "failed"; note?: string }>;
  reason: string | null;
  succeeded: number;
  skipped: number;
  failed: number;
  created_at: string;
};

export function BuyerOfferAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buyer_offer_audit_log")
        .select("id,actor_email,action,offer_ids,outcomes,reason,succeeded,skipped,failed,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setRows((data ?? []) as AuditRow[]);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("buyer-offer-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "buyer_offer_audit_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <section className="rounded-xl border border-border/50 bg-card">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <h2 className="text-sm font-semibold">Bulk action audit log</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Every bulk Approve and Send Back — who, when, which offers, and why.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="h-8 px-2.5 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:bg-secondary/40 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      {err && (
        <div className="m-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {err}
        </div>
      )}

      {!err && rows.length === 0 && !loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No bulk actions recorded yet.</div>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => {
            const isOpen = expanded.has(r.id);
            const isApprove = r.action === "bulk_approve";
            return (
              <li key={r.id} className="px-3 py-2.5">
                <button
                  onClick={() => toggle(r.id)}
                  className="w-full flex items-center gap-2 text-left hover:bg-secondary/30 rounded-md px-1.5 py-1"
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                    isApprove ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  )}>
                    {isApprove ? "Approve" : "Send back"}
                  </span>
                  <span className="text-xs font-medium truncate">
                    {r.actor_email ?? "unknown user"}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </button>
                <div className="pl-6 pr-2 mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                  <span>{r.offer_ids.length} offer{r.offer_ids.length === 1 ? "" : "s"}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">✓ {r.succeeded}</span>
                  <span>− {r.skipped} skipped</span>
                  <span className="text-red-600 dark:text-red-400">✗ {r.failed}</span>
                </div>
                {isOpen && (
                  <div className="pl-6 pr-2 mt-2 space-y-2">
                    {r.reason && (
                      <div className="rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</div>
                        <div className="text-xs mt-0.5 whitespace-pre-wrap">{r.reason}</div>
                      </div>
                    )}
                    <ul className="rounded-md border border-border/50 divide-y divide-border/40">
                      {(r.outcomes ?? []).map((o, idx) => (
                        <li key={`${o.id}-${idx}`} className="px-2.5 py-1.5 flex items-center gap-2 text-xs">
                          {o.result === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          {o.result === "skipped" && <MinusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          {o.result === "failed" && <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                          <span className="truncate">{o.name}</span>
                          <span className="ml-auto text-[10px] font-mono text-muted-foreground truncate">{o.id.slice(0, 8)}</span>
                          {o.note && <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">{o.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
