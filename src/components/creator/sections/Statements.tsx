import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreatorInvoices from "@/components/creator/CreatorInvoices";
import UpgradeCreatorPlanCard from "@/components/creator/UpgradeCreatorPlanCard";
import { HardDrive, ChevronDown, ChevronUp, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";

type Topup = {
  id: string; tb_added: number | null; amount_inr: number | null;
  status: string | null; created_at: string;
  razorpay_order_id: string | null;
};

type Event = { id: string; kind: string; description: string; amount: string; at: string };

const STATUS_TONE: Record<string, string> = {
  paid:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed:    "bg-rose-500/15 text-rose-300 border-rose-500/30",
  abandoned: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  refunded:  "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export default function StatementsSection() {
  const { user } = useAuth();
  const [topups, setTopups] = useState<Topup[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tu, payments, subs, audit] = await Promise.all([
        (supabase as any).from("storage_topups").select("id,tb_added,amount_inr,status,created_at,razorpay_order_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("fastlink_payments").select("id, razorpay_payment_id, razorpay_order_id, amount_inr, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("subscriptions").select("id, product_id, price_id, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("razorpay_audit_log").select("id, event_type, status, amount_paise, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setTopups((tu.data ?? []) as Topup[]);

      const out: Event[] = [];
      for (const p of payments.data ?? []) out.push({ id: `p-${p.id}`, kind: "Payment", description: `${p.razorpay_payment_id ?? p.razorpay_order_id ?? ""}`.trim() || "Payment", amount: p.amount_inr != null ? `₹${Number(p.amount_inr).toFixed(2)}` : "—", at: p.created_at });
      for (const s of subs.data ?? []) out.push({ id: `s-${s.id}`, kind: "Subscription", description: `${s.product_id || s.price_id || "Subscription"} · ${s.status ?? ""}`, amount: "—", at: s.created_at });
      for (const a of audit.data ?? []) out.push({ id: `a-${a.id}`, kind: a.event_type ?? "Razorpay event", description: a.status ?? "", amount: a.amount_paise != null ? `₹${(Number(a.amount_paise) / 100).toFixed(2)}` : "—", at: a.created_at });
      out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setEvents(out);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/40 bg-secondary/5 px-4 py-3 text-[11px] text-muted-foreground">
        Free Creator plan includes <span className="text-foreground font-medium">5 GB</span> of storage.
        Paid and managed-service plans unlock premium review handling, dedicated inbox support, and advanced licensing controls.
      </div>
      <CreatorInvoices />

      {/* Storage allocation history — read-only record of past changes */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-accent" />
            <h3 className="font-display text-lg font-bold">Storage Allocation History</h3>
            <span className="text-xs text-muted-foreground">
              {topups.length} record{topups.length === 1 ? "" : "s"}
            </span>
          </div>
          <Link
            to="/dashboard/content?section=upgrade"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 text-xs font-semibold hover:bg-secondary/30"
          >
            <LifeBuoy className="w-3.5 h-3.5" /> Request more storage
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Read-only record of storage allocations applied to your account (admin grants and founder-assisted top-ups). Creator storage changes are not self-serve today — use the Upgrade tab to request more.
        </p>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : topups.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No storage allocations recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Storage</th>
                  <th className="text-right py-2 pr-4">Amount</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Order</th>
                </tr>
              </thead>
              <tbody>
                {topups.map((t) => (
                  <tr key={t.id} className="border-t border-border/30">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">{t.tb_added != null ? `${t.tb_added} TB` : "—"}</td>
                    <td className="py-2 pr-4 text-right font-mono">{t.amount_inr != null ? `₹${Number(t.amount_inr).toFixed(2)}` : "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${STATUS_TONE[t.status ?? ""] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {t.status ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{t.razorpay_order_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Raw payment events — collapsed by default */}
      <section className="rounded-2xl border border-border/40 bg-card p-5">
        <button
          onClick={() => setShowEvents((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold"
        >
          <span>Show payment events</span>
          {showEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showEvents && (
          events.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No additional payment events recorded.</p>
          ) : (
            <div className="rounded-xl border border-border/40 overflow-hidden mt-4">
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
                  {events.map((r) => (
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
          )
        )}
      </section>
    </div>
  );
}
