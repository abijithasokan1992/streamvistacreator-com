import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Activity, ChevronDown, ChevronUp } from "lucide-react";
import TechnicalDetailsDisclosure from "@/components/admin/TechnicalDetailsDisclosure";
import { isTestRecord, razorpayEventLabel } from "@/lib/copy/adminLabels";

type Row = {
  id: string;
  created_at: string;
  event_type: string;
  source: string;
  order_id: string | null;
  payment_id: string | null;
  subscription_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  status: string | null;
  error_code: string | null;
  error_description: string | null;
  signature_valid: boolean | null;
  payload: any;
};

const EVENT_OPTIONS = [
  "all",
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.processed",
  "subscription.activated",
  "subscription.charged",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "admin.test",
  "verify.payment",
];

function statusVariant(s: string | null, err: string | null): "default" | "destructive" | "secondary" {
  if (err) return "destructive";
  if (!s) return "secondary";
  if (["captured", "paid", "active", "authenticated", "success"].includes(s)) return "default";
  if (["failed", "halted", "cancelled"].includes(s)) return "destructive";
  return "secondary";
}

export default function RazorpayAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("razorpay_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
    const { data, error } = await q;
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.order_id, r.payment_id, r.subscription_id, r.status, r.error_code, r.error_description]
        .some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [rows, search]);

  return (
    <Card className="bg-card/80 border-border/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary" />
          Payment Activity History
          <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by order or payment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64"
          />
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No Razorpay events recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const isOpen = expanded === r.id;
              const humanEvent = razorpayEventLabel(r.event_type);
              const testFlag = isTestRecord(r.event_type, r.source);
              return (
                <div key={r.id} className="rounded-md border border-border/60 bg-background/40">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={statusVariant(r.status, r.error_code)} className="shrink-0">
                        {humanEvent}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      {r.amount_paise != null && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ₹{(r.amount_paise / 100).toFixed(2)}
                        </span>
                      )}
                      {r.error_code && (
                        <span className="text-xs text-destructive truncate">
                          Payment could not be completed.
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3">
                      <TechnicalDetailsDisclosure
                        testRecord={testFlag}
                        defaultOpen={false}
                        title="Developer support fields"
                        entries={[
                          { label: "event_type", value: r.event_type, mono: true },
                          { label: "source", value: r.source, mono: true },
                          { label: "order_id", value: r.order_id ?? "—", mono: true },
                          { label: "payment_id", value: r.payment_id ?? "—", mono: true },
                          { label: "subscription_id", value: r.subscription_id ?? "—", mono: true },
                          { label: "status", value: r.status ?? "—", mono: true },
                          { label: "currency", value: r.currency ?? "—", mono: true },
                          { label: "signature_valid", value: String(r.signature_valid ?? "—"), mono: true },
                          { label: "error_code", value: r.error_code ?? "—", mono: true },
                          { label: "error_description", value: r.error_description ?? "—", mono: true },
                        ]}
                      >
                        <pre className="text-[11px] overflow-x-auto max-h-80 text-muted-foreground">
{JSON.stringify(r.payload, null, 2)}
                        </pre>
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
