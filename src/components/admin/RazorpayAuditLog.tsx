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
            placeholder="Search order / payment / sub id…"
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
              return (
                <div key={r.id} className="rounded-md border border-border/60 bg-background/40">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={statusVariant(r.status, r.error_code)} className="shrink-0">
                        {r.event_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      <span className="text-xs font-mono truncate">
                        {r.payment_id || r.order_id || r.subscription_id || "—"}
                      </span>
                      {r.amount_paise != null && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ₹{(r.amount_paise / 100).toFixed(2)}
                        </span>
                      )}
                      {r.error_code && (
                        <span className="text-xs text-destructive truncate">
                          {r.error_code}: {r.error_description}
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isOpen && (
                    <pre className="px-3 pb-3 pt-0 text-[11px] overflow-x-auto max-h-80 text-muted-foreground">
{JSON.stringify(
  {
    source: r.source,
    status: r.status,
    signature_valid: r.signature_valid,
    currency: r.currency,
    order_id: r.order_id,
    payment_id: r.payment_id,
    subscription_id: r.subscription_id,
    payload: r.payload,
  },
  null,
  2,
)}
                    </pre>
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
