import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Circle, XCircle, Clock, RefreshCw, Activity,
  AlertTriangle, CreditCard, Webhook, Receipt, HardDrive,
} from "lucide-react";

type Trace = {
  id: string;
  order_id: string;
  payment_id: string | null;
  user_id: string | null;
  source: string | null;
  topup_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  razorpay_order_status: string | null;
  razorpay_payment_status: string | null;
  frontend_state: string | null;
  webhook_event: string | null;
  webhook_signature_valid: boolean | null;
  invoice_id: string | null;
  invoice_created: boolean;
  allocation_created: boolean;
  final_result: string | null;
  last_error: string | null;
  order_created_at: string;
  checkout_opened_at: string | null;
  payment_completed_at: string | null;
  verify_started_at: string | null;
  verify_completed_at: string | null;
  webhook_received_at: string | null;
  entitlement_started_at: string | null;
  entitlement_completed_at: string | null;
  extra: Record<string, unknown>;
  updated_at: string;
};

type Step = { label: string; ts: string | null; icon: React.ReactNode; ok?: boolean; pending?: boolean; failed?: boolean };

function buildTimeline(t: Trace): Step[] {
  const failed = (t.final_result ?? "").includes("failed");
  return [
    { label: "Order Created", ts: t.order_created_at, icon: <CreditCard className="w-3.5 h-3.5" />, ok: true },
    { label: "Checkout Opened", ts: t.checkout_opened_at, icon: <Activity className="w-3.5 h-3.5" />, ok: !!t.checkout_opened_at },
    { label: "Payment Success Callback", ts: t.payment_completed_at, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: !!t.payment_completed_at },
    { label: "Verify Started", ts: t.verify_started_at, icon: <Clock className="w-3.5 h-3.5" />, ok: !!t.verify_started_at },
    { label: "Verify Completed", ts: t.verify_completed_at, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: !!t.verify_completed_at && !failed, failed: !!t.verify_completed_at && failed },
    { label: "Webhook Received", ts: t.webhook_received_at, icon: <Webhook className="w-3.5 h-3.5" />, ok: !!t.webhook_received_at && t.webhook_signature_valid !== false, failed: t.webhook_signature_valid === false },
    { label: "Entitlement Allocated", ts: t.entitlement_completed_at, icon: <HardDrive className="w-3.5 h-3.5" />, ok: t.allocation_created },
    { label: "Invoice Created", ts: t.entitlement_completed_at, icon: <Receipt className="w-3.5 h-3.5" />, ok: t.invoice_created },
    { label: "Completed", ts: t.final_result?.startsWith("verified_success") || t.final_result === "webhook_processed" ? t.updated_at : null, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: t.final_result === "verified_success" || t.final_result === "verified_success_already_processed" || t.final_result === "webhook_processed" },
  ];
}

function summarize(t: Trace): { label: string; tone: "ok" | "warn" | "err" | "pending" } {
  if (t.final_result === "verified_success" || t.final_result === "verified_success_already_processed" || t.final_result === "webhook_processed") return { label: "✅ Completed", tone: "ok" };
  if (t.final_result?.includes("failed")) return { label: `❌ ${t.final_result}`, tone: "err" };
  if (t.frontend_state === "checkout_dismissed") return { label: "🚪 Checkout Dismissed", tone: "warn" };
  if (t.payment_completed_at && !t.webhook_received_at && !t.verify_completed_at) return { label: "⚠️ Webhook Missing", tone: "warn" };
  if (t.webhook_received_at && t.final_result?.includes("verify_failed")) return { label: "⚠️ Webhook OK / Verify Failed", tone: "warn" };
  if (t.checkout_opened_at && !t.payment_completed_at) return { label: "⏳ Checkout Open", tone: "pending" };
  return { label: t.frontend_state ?? "pending", tone: "pending" };
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function rupees(p: number | null) {
  if (!p) return "—";
  return `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function PaymentTrace() {
  const [rows, setRows] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ok" | "warn" | "err" | "pending">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_traces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as unknown as Trace[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter(r => {
      const s = summarize(r).tone;
      if (filter !== "all" && s !== filter) return false;
      if (!ql) return true;
      return [r.order_id, r.payment_id, r.topup_id, r.user_id, r.source, r.final_result]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(ql));
    });
  }, [rows, q, filter]);

  return (
    <Card className="border-border/40">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" /> Payment Trace
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Forensic timeline for every Razorpay order — checkout → callback → verify → webhook → entitlement → invoice.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search order_id / payment_id / topup_id / user_id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
          {(["all","ok","warn","err","pending"] as const).map(k => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              onClick={() => setFilter(k)}
              className="capitalize"
            >
              {k}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length}</span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">Loading payment traces…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border/40 rounded-lg">
            No payment traces match.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const s = summarize(t);
              const isOpen = expanded === t.id;
              const timeline = buildTimeline(t);
              return (
                <div key={t.id} className="border border-border/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="w-full text-left p-3 flex flex-wrap items-center gap-3 hover:bg-muted/40 transition-colors"
                  >
                    <Badge
                      className={
                        s.tone === "ok" ? "bg-emerald-600" :
                        s.tone === "err" ? "bg-destructive" :
                        s.tone === "warn" ? "bg-amber-500/80 text-black" :
                        "bg-muted text-foreground"
                      }
                    >
                      {s.label}
                    </Badge>
                    <span className="font-mono text-xs">{t.order_id}</span>
                    {t.payment_id && <span className="font-mono text-[11px] text-muted-foreground">{t.payment_id}</span>}
                    {t.source && <Badge variant="outline" className="text-[10px]">{t.source}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{rupees(t.amount_paise)} · {fmt(t.created_at as unknown as string ?? t.order_created_at)}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/40 bg-muted/20 p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {timeline.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <span className={
                              step.failed ? "text-destructive" :
                              step.ok ? "text-emerald-400" :
                              step.ts ? "text-amber-400" :
                              "text-muted-foreground"
                            }>
                              {step.failed ? <XCircle className="w-3.5 h-3.5" /> :
                               step.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                               <Circle className="w-3.5 h-3.5" />}
                            </span>
                            <div className="flex-1">
                              <div className="font-medium">{step.label}</div>
                              <div className="text-muted-foreground font-mono">{fmt(step.ts)}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-background/40 rounded-lg p-3 border border-border/40">
                        <div><span className="text-muted-foreground">order_status:</span> {t.razorpay_order_status ?? "—"}</div>
                        <div><span className="text-muted-foreground">payment_status:</span> {t.razorpay_payment_status ?? "—"}</div>
                        <div><span className="text-muted-foreground">frontend_state:</span> {t.frontend_state ?? "—"}</div>
                        <div><span className="text-muted-foreground">webhook_event:</span> {t.webhook_event ?? "—"}</div>
                        <div><span className="text-muted-foreground">sig_valid:</span> {String(t.webhook_signature_valid ?? "—")}</div>
                        <div><span className="text-muted-foreground">invoice_created:</span> {String(t.invoice_created)}</div>
                        <div><span className="text-muted-foreground">allocation_created:</span> {String(t.allocation_created)}</div>
                        <div><span className="text-muted-foreground">final_result:</span> {t.final_result ?? "—"}</div>
                        <div className="col-span-2"><span className="text-muted-foreground">topup_id:</span> {t.topup_id ?? "—"}</div>
                        <div className="col-span-2"><span className="text-muted-foreground">user_id:</span> {t.user_id ?? "—"}</div>
                        {t.invoice_id && <div className="col-span-2"><span className="text-muted-foreground">invoice_id:</span> {t.invoice_id}</div>}
                      </div>

                      {t.last_error && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded p-2 flex items-start gap-2 border border-destructive/30">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> {t.last_error}
                        </div>
                      )}

                      {t.extra && Object.keys(t.extra).length > 0 && (
                        <details className="text-[11px]">
                          <summary className="cursor-pointer text-muted-foreground">extra</summary>
                          <pre className="mt-2 bg-background/40 border border-border/40 rounded p-2 overflow-auto max-h-48">
{JSON.stringify(t.extra, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
