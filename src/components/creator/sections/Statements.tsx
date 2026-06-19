import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = { id: string; kind: string; description: string; amount: string; at: string };

export default function StatementsSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const out: Row[] = [];
      const [payments, subs, topups, audit] = await Promise.all([
        (supabase as any).from("fastlink_payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("storage_topups").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("razorpay_audit_log").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      for (const p of payments.data ?? []) {
        out.push({
          id: `p-${p.id}`, kind: "Invoice",
          description: `Payment ${p.razorpay_payment_id ?? p.razorpay_order_id ?? ""}`.trim(),
          amount: p.amount_inr != null ? `₹${Number(p.amount_inr).toFixed(2)}` : "—",
          at: p.created_at,
        });
      }
      for (const s of subs.data ?? []) {
        out.push({
          id: `s-${s.id}`, kind: "Subscription",
          description: `${s.product_id || s.price_id || "Subscription"} · ${s.status ?? ""}`,
          amount: "—",
          at: s.created_at,
        });
      }
      for (const t of topups.data ?? []) {
        out.push({
          id: `t-${t.id}`, kind: "Storage",
          description: `Top-up ${t.tb_added ? `${t.tb_added} TB` : ""}`.trim(),
          amount: t.amount_inr != null ? `₹${Number(t.amount_inr).toFixed(2)}` : "—",
          at: t.created_at,
        });
      }
      for (const a of audit.data ?? []) {
        out.push({
          id: `a-${a.id}`, kind: "Razorpay",
          description: `${a.event_type ?? "Event"} · ${a.status ?? ""}`,
          amount: a.amount_paise != null ? `₹${(Number(a.amount_paise) / 100).toFixed(2)}` : "—",
          at: a.created_at,
        });
      }
      out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setRows(out);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No billing history yet.</p>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs">{r.kind}</td>
                  <td className="px-3 py-2 text-xs truncate max-w-[300px]">{r.description}</td>
                  <td className="px-3 py-2 text-xs text-right font-mono">{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="rounded-xl border border-dashed border-border/50 bg-secondary/5 p-6 text-center">
        <p className="text-sm">Advanced Revenue Reporting Coming Soon</p>
      </div>
    </div>
  );
}
