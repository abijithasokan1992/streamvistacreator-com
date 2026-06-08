import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Percent, TrendingUp } from "lucide-react";
import { formatInr } from "@/lib/storage-pricing";

type CommissionRow = {
  referrer_user_id: string;
  referrer_code: string;
  referred_user_id: string | null;
  referred_email: string | null;
  joined_at: string;
  commission_until: string;
  commission_rate: number;
  active_subs: number;
  revenue_estimate_inr: number;
  commission_inr: number;
};

// Approximate monthly revenue from price_id (admin-only view).
// Falls back to ₹650/mo when unknown; price_id naming is best-effort.
const PRICE_MAP: Record<string, number> = {
  pro_monthly: 650,
  pro_quarterly: 1800,
  pro_yearly: 6500,
};
function monthlyFromPriceId(p: string) {
  return PRICE_MAP[p] ?? 650;
}

export default function CommissionsTracker() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: refs } = await supabase
        .from("referrals")
        .select("referrer_user_id, referrer_code, referred_user_id, referred_email, created_at, commission_rate, commission_until")
        .eq("status", "approved");

      const userIds = Array.from(new Set((refs ?? []).map(r => r.referred_user_id).filter(Boolean) as string[]));
      const { data: subs } = userIds.length
        ? await supabase.from("subscriptions")
            .select("user_id, price_id, status, current_period_start")
            .in("user_id", userIds)
        : { data: [] as any[] };

      const out: CommissionRow[] = (refs ?? []).map((r: any) => {
        const userSubs = (subs ?? []).filter((s: any) => s.user_id === r.referred_user_id && ["active", "trialing", "past_due"].includes(s.status));
        const joined = new Date(r.created_at);
        const monthsActive = Math.max(
          0,
          Math.min(
            12 * 5,
            Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24 * 30))
          )
        );
        const monthly = userSubs.reduce((s: number, x: any) => s + monthlyFromPriceId(x.price_id), 0);
        const revenue = monthly * monthsActive;
        return {
          referrer_user_id: r.referrer_user_id,
          referrer_code: r.referrer_code,
          referred_user_id: r.referred_user_id,
          referred_email: r.referred_email,
          joined_at: r.created_at,
          commission_until: r.commission_until ?? new Date(joined.getTime() + 5 * 365 * 86400_000).toISOString(),
          commission_rate: Number(r.commission_rate ?? 0.1),
          active_subs: userSubs.length,
          revenue_estimate_inr: revenue,
          commission_inr: Math.round(revenue * Number(r.commission_rate ?? 0.1)),
        };
      });
      setRows(out);
      setLoading(false);
    })();
  }, []);

  const totalCommission = rows.reduce((s, r) => s + r.commission_inr, 0);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" /> Recurring Commissions
          </h2>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Percent className="h-3 w-3" /> 10% of revenue · 5-year lifespan from join date
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total accrued</div>
          <div className="font-bold text-2xl">{formatInr(totalCommission)}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No approved referrals with subscription activity yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Referred user</th>
                <th className="text-left px-3 py-2">Referrer code</th>
                <th className="text-left px-3 py-2">Joined</th>
                <th className="text-left px-3 py-2">Commission ends</th>
                <th className="text-right px-3 py-2">Active subs</th>
                <th className="text-right px-3 py-2">Est. revenue</th>
                <th className="text-right px-3 py-2">10% commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 truncate">{r.referred_email ?? r.referred_user_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.referrer_code}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.joined_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.commission_until).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">{r.active_subs}</td>
                  <td className="px-3 py-2 text-right">{formatInr(r.revenue_estimate_inr)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatInr(r.commission_inr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
