import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, AlertTriangle, CheckCircle2, ShieldOff, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

type Range = "24h" | "7d" | "30d";
const RANGE_HOURS: Record<Range, number> = { "24h": 24, "7d": 168, "30d": 720 };

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  sent:        { label: "Sent",       cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  pending:     { label: "Pending",    cls: "bg-amber-500/10 text-amber-300 border-amber-500/30",       icon: Clock },
  dlq:         { label: "Failed",     cls: "bg-rose-500/10 text-rose-300 border-rose-500/30",          icon: AlertTriangle },
  failed:      { label: "Failed",     cls: "bg-rose-500/10 text-rose-300 border-rose-500/30",          icon: AlertTriangle },
  bounced:     { label: "Bounced",    cls: "bg-rose-500/10 text-rose-300 border-rose-500/30",          icon: AlertTriangle },
  complained:  { label: "Complaint",  cls: "bg-rose-500/10 text-rose-300 border-rose-500/30",          icon: AlertTriangle },
  suppressed:  { label: "Suppressed", cls: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",          icon: ShieldOff },
};

export default function EmailLogMonitor() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - RANGE_HOURS[range] * 3600_000).toISOString();
    const { data } = await supabase
      .from("email_send_log")
      .select("id,message_id,template_name,recipient_email,status,error_message,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  const retryFailed = async () => {
    setRetrying(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.functions.invoke("retry-failed-emails", { body: {} });
      if (error) throw error;
      const payload = (data ?? {}) as {
        sweep_status?: "ok" | "degraded" | "failed";
        audit_status?: "ok" | "failed";
        audit_persist_status?: "ok" | "failed";
        pending_remaining?: number;
        audit?: { passed?: boolean; pending_remaining?: number };
      };
      const sweep = payload.sweep_status ?? "ok";
      const auditPersistOk =
        (payload.audit_persist_status ?? (payload.audit_status === "ok" ? "ok" : "failed")) === "ok";
      const pending = payload.pending_remaining ?? payload.audit?.pending_remaining ?? 0;
      if (sweep === "failed") {
        setBanner("Retry failed — sweeper did not complete. Check admin audit alerts.");
      } else if (pending > 0 && !auditPersistOk) {
        setBanner(
          `Retry sweep OK — ${pending} message_id(s) still pending, will retry next run. Audit persistence unavailable.`,
        );
      } else if (pending > 0) {
        setBanner(`Retry sweep OK — ${pending} message_id(s) still pending, will retry next run.`);
      } else if (!auditPersistOk) {
        setBanner("Retry sweep succeeded — audit persistence unavailable. Sweep results are safe.");
      } else {
        setBanner("Retry sweep OK — 0 stuck message_ids remaining.");
      }
      await load();
    } catch (e) {
      setBanner(`Retry failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => { load(); }, [range]);

  // Dedupe by message_id, keep latest
  const latest = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const key = r.message_id ?? r.id;
      if (!map.has(key)) map.set(key, r);
    }
    return [...map.values()];
  }, [rows]);

  const templates = useMemo(
    () => Array.from(new Set(latest.map(r => r.template_name).filter(Boolean))) as string[],
    [latest]
  );

  const filtered = useMemo(() => {
    return latest.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (search && !(r.recipient_email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [latest, statusFilter, templateFilter, search]);

  const counts = useMemo(() => {
    const c = { total: latest.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of latest) {
      if (r.status === "sent") c.sent++;
      else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced") c.failed++;
      else if (r.status === "suppressed" || r.status === "complained") c.suppressed++;
      else if (r.status === "pending") c.pending++;
    }
    return c;
  }, [latest]);

  return (
    <div className="glass-strong rounded-3xl p-6 md:p-8 border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
            <Mail className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">Email Dispatch Monitor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live delivery, failures & DLQ across all SMTP sends.</p>
          </div>
        </div>
        <button
          onClick={retryFailed}
          disabled={retrying || loading}
          className="h-9 px-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs font-medium hover:bg-rose-500/20 flex items-center gap-1.5 disabled:opacity-50"
          title="Requeue DLQ messages and reconcile stuck pending rows"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", retrying && "animate-spin")} /> Retry failed
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="h-9 px-3 rounded-xl border border-border/60 text-xs font-medium hover:bg-secondary/40 flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>
      {banner && (
        <div className="mb-4 rounded-xl border border-border/60 bg-input/20 px-3 py-2 text-xs text-muted-foreground">
          {banner}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Total" value={counts.total} accent="text-foreground" />
        <Stat label="Sent" value={counts.sent} accent="text-emerald-300" />
        <Stat label="Pending" value={counts.pending} accent="text-amber-300" />
        <Stat label="Failed / DLQ" value={counts.failed} accent="text-rose-300" />
        <Stat label="Suppressed" value={counts.suppressed} accent="text-zinc-300" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Segmented value={range} setValue={(v) => setRange(v as Range)} opts={[["24h","24h"],["7d","7 days"],["30d","30 days"]]} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-xl bg-input/40 border border-border/60 text-xs">
          <option value="all">All status</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="dlq">Failed (DLQ)</option>
          <option value="suppressed">Suppressed</option>
        </select>
        <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)} className="h-9 px-3 rounded-xl bg-input/40 border border-border/60 text-xs">
          <option value="all">All templates</option>
          {templates.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by recipient…"
          className="flex-1 min-w-[180px] h-9 px-3 rounded-xl bg-input/40 border border-border/60 text-xs outline-none focus:border-accent/70"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.4fr_120px_140px] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-input/20 border-b border-border/40">
          <div>Template</div><div>Recipient</div><div>Status</div><div>When</div>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/30">
          {loading ? (
            <div className="p-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No email events in this window.</div>
          ) : filtered.map(r => {
            const meta = STATUS_META[r.status ?? ""] ?? { label: r.status ?? "—", cls: "bg-muted/20 text-muted-foreground border-border/40", icon: Mail };
            const Icon = meta.icon;
            return (
              <div key={r.id} className="grid grid-cols-[1fr_1.4fr_120px_140px] gap-2 px-4 py-3 text-xs hover:bg-input/20 transition-colors">
                <div className="font-mono text-foreground/90 truncate">{r.template_name ?? "—"}</div>
                <div className="min-w-0 text-muted-foreground">
                  <div className="truncate" title={r.recipient_email ?? undefined}>{r.recipient_email ?? "—"}</div>
                  {r.error_message && (
                    <div className="mt-0.5 text-[10px] text-rose-300/90 whitespace-pre-wrap break-words" title={r.error_message}>
                      {r.error_message}
                    </div>
                  )}
                </div>
                <div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium", meta.cls)}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>
                <div className="text-muted-foreground/80 text-[11px]">{new Date(r.created_at).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-input/20 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-bold mt-1", accent)}>{value}</div>
    </div>
  );
}

function Segmented({ value, setValue, opts }: { value: string; setValue: (v: string) => void; opts: [string, string][] }) {
  return (
    <div className="inline-flex h-9 p-0.5 rounded-xl bg-input/40 border border-border/60">
      {opts.map(([v, l]) => (
        <button
          key={v}
          onClick={() => setValue(v)}
          className={cn(
            "px-3 text-xs rounded-lg transition-all",
            value === v ? "bg-gradient-primary text-primary-foreground glow-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >{l}</button>
      ))}
    </div>
  );
}
