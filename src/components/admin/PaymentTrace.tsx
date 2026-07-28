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
import TechnicalDetailsDisclosure from "@/components/admin/TechnicalDetailsDisclosure";
import { isTestRecord } from "@/lib/copy/adminLabels";

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
    { label: "Payment Started", ts: t.checkout_opened_at, icon: <Activity className="w-3.5 h-3.5" />, ok: !!t.checkout_opened_at },
    { label: "Payment Return Check", ts: t.payment_completed_at, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: !!t.payment_completed_at },
    { label: "Confirm Payment Started", ts: t.verify_started_at, icon: <Clock className="w-3.5 h-3.5" />, ok: !!t.verify_started_at },
    { label: "Confirm Payment Completed", ts: t.verify_completed_at, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: !!t.verify_completed_at && !failed, failed: !!t.verify_completed_at && failed },
    { label: "Automatic Payment Update Received", ts: t.webhook_received_at, icon: <Webhook className="w-3.5 h-3.5" />, ok: !!t.webhook_received_at && t.webhook_signature_valid !== false, failed: t.webhook_signature_valid === false },
    { label: "Access Granted", ts: t.entitlement_completed_at, icon: <HardDrive className="w-3.5 h-3.5" />, ok: t.allocation_created },
    { label: "Invoice Created", ts: t.entitlement_completed_at, icon: <Receipt className="w-3.5 h-3.5" />, ok: t.invoice_created },
    { label: "Completed", ts: t.final_result?.startsWith("verified_success") || t.final_result === "webhook_processed" ? t.updated_at : null, icon: <CheckCircle2 className="w-3.5 h-3.5" />, ok: t.final_result === "verified_success" || t.final_result === "verified_success_already_processed" || t.final_result === "webhook_processed" },
  ];
}

function summarize(t: Trace): { label: string; tone: "ok" | "warn" | "err" | "pending" } {
  const success = t.final_result === "verified_success"
    || t.final_result === "verified_success_already_processed"
    || t.final_result === "webhook_processed";
  if (success) return { label: "Payment Successful", tone: "ok" };
  if (t.final_result?.includes("failed")) return { label: "Payment Failed", tone: "err" };
  if (t.frontend_state === "checkout_dismissed") return { label: "Payment Window Closed", tone: "warn" };
  if (t.verify_completed_at && !t.webhook_received_at) return { label: "Payment Confirmation Pending", tone: "pending" };
  if (t.webhook_received_at && !t.verify_completed_at && !t.final_result?.includes("failed")) return { label: "Payment Confirmation Pending", tone: "pending" };
  if (t.payment_completed_at && !t.webhook_received_at && !t.verify_completed_at) return { label: "Payment Confirmation Pending", tone: "warn" };
  if (t.webhook_received_at && t.final_result?.includes("verify_failed")) return { label: "Payment Confirmation Pending", tone: "warn" };
  if (t.checkout_opened_at && !t.payment_completed_at) return { label: "Payment Started", tone: "pending" };
  return { label: "Payment Confirmation Pending", tone: "pending" };
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
            <Activity className="w-5 h-5 text-accent" /> Payment Journey
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Detailed Payment History for every order — from payment start to confirmation, invoice, and access granted.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by order or customer…"
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
                    <span className="text-xs">Customer: <span className="font-medium">{t.user_id ? `#${String(t.user_id).slice(0, 8)}` : "—"}</span></span>
                    <span className="text-xs text-muted-foreground ml-auto">{rupees(t.amount_paise)} · {fmt(t.order_created_at)}</span>
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

                      {t.last_error && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded p-2 flex items-start gap-2 border border-destructive/30">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                          <span>{t.last_error.includes("BAD_REQUEST_ERROR") ? "Payment could not be completed." : t.last_error}</span>
                        </div>
                      )}

                      <TechnicalDetailsDisclosure
                        testRecord={isTestRecord(t.webhook_event, t.source)}
                        title="Developer support fields"
                        entries={[
                          { label: "order_id", value: t.order_id, mono: true },
                          { label: "payment_id", value: t.payment_id ?? "—", mono: true },
                          { label: "topup_id", value: t.topup_id ?? "—", mono: true },
                          { label: "user_id", value: t.user_id ?? "—", mono: true },
                          { label: "source", value: t.source ?? "—", mono: true },
                          { label: "order_status", value: t.razorpay_order_status ?? "—", mono: true },
                          { label: "payment_status", value: t.razorpay_payment_status ?? "—", mono: true },
                          { label: "frontend_state", value: t.frontend_state ?? "—", mono: true },
                          { label: "webhook_event", value: t.webhook_event ?? "—", mono: true },
                          { label: "signature_valid", value: String(t.webhook_signature_valid ?? "—"), mono: true },
                          { label: "invoice_id", value: t.invoice_id ?? "—", mono: true },
                          { label: "final_result", value: t.final_result ?? "—", mono: true },
                        ]}
                      >
                        {t.extra && Object.keys(t.extra).length > 0 && (
                          <pre className="mt-2 bg-background/40 border border-border/40 rounded p-2 overflow-auto max-h-48 text-[11px]">
{JSON.stringify(t.extra, null, 2)}
                          </pre>
                        )}
                      </TechnicalDetailsDisclosure>
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
