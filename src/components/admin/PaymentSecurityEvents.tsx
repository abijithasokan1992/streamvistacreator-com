import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Evt {
  id: string;
  created_at: string;
  severity: string;
  action_type: string;
  event_category: string | null;
  order_id: string | null;
  payment_id: string | null;
  event_id: string | null;
  error_message: string | null;
  extra: any;
}

const CATEGORY_LABEL: Record<string, string> = {
  invalid_signature: "Invalid signature",
  duplicate_event: "Duplicate event",
  replay_attempt: "Replay attempt",
  idempotency_conflict: "Idempotency conflict",
  entitlement_projection_failure: "Entitlement projection failure",
  subscription_mapping_failure: "Subscription mapping failure",
  invoice_mismatch: "Invoice mismatch",
  amount_mismatch: "Amount mismatch",
  webhook_parse_failure: "Webhook parse failure",
  unknown_payment_mapping: "Unknown payment mapping",
};

export default function PaymentSecurityEvents() {
  const [rows, setRows] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("payment_security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as Evt[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { if (r.event_category) c[r.event_category] = (c[r.event_category] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h3 className="font-display text-lg font-bold">Payment Security Events</h3>
          <span className="text-xs text-muted-foreground">{rows.length} recent</span>
        </div>
        <Button onClick={load} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
          <div key={k} className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
            <div className="font-display font-bold text-lg">{counts[k] ?? 0}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No payment security events recorded.</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left p-2 font-medium">When</th>
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Severity</th>
                <th className="text-left p-2 font-medium">Order / Payment</th>
                <th className="text-left p-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30 align-top">
                  <td className="p-2 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <span className="font-semibold">{r.event_category ? CATEGORY_LABEL[r.event_category] : r.action_type}</span>
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      r.severity === "ERROR" ? "bg-rose-500/15 text-rose-600" :
                      r.severity === "WARN" ? "bg-amber-500/15 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.severity}</span>
                  </td>
                  <td className="p-2 font-mono text-[10px]">
                    {r.order_id && <div>O: {r.order_id}</div>}
                    {r.payment_id && <div>P: {r.payment_id}</div>}
                  </td>
                  <td className="p-2 text-muted-foreground max-w-md">
                    {r.error_message ?? <span className="italic opacity-60">no message</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
