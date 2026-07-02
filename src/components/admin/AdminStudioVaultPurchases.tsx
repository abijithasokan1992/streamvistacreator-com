import { useEffect, useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  topup_id: string;
  user_id: string;
  customer_email: string | null;
  product_name: string | null;
  storage_class: string | null;
  tb_added: number | null;
  billing_interval_months: number | null;
  amount_inr: number | null;
  total_paise: number | null;
  status: string;
  entitlement_projected_at: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
};

const fmtINR = (paise: number | null) =>
  paise == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
        .format(Math.round(Number(paise) / 100));

const statusColor: Record<string, string> = {
  paid: "text-emerald-300",
  pending: "text-amber-300",
  failed: "text-red-300",
};

export default function AdminStudioVaultPurchases() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>
    ) => Promise<{ data: Row[] | null; error: { message: string } | null }>)(
      "admin_studio_vault_purchases", { _limit: 100 }
    );
    if (error) setError(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-accent" />
          <h3 className="font-display text-lg">Studio Vault — Recent Purchases</h3>
        </div>
        <button onClick={refresh} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Studio Vault purchases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground border-b border-border/30">
              <tr>
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-left py-2 pr-3">Customer</th>
                <th className="text-left py-2 pr-3">Product</th>
                <th className="text-left py-2 pr-3">Class</th>
                <th className="text-right py-2 pr-3">TB</th>
                <th className="text-right py-2 pr-3">Months</th>
                <th className="text-right py-2 pr-3">Total</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Projected</th>
                <th className="text-left py-2">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rows.map((r) => (
                <tr key={r.topup_id}>
                  <td className="py-2 pr-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{r.customer_email ?? r.user_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{r.product_name ?? "—"}</td>
                  <td className="py-2 pr-3">{r.storage_class?.replace("_", " ") ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">{r.tb_added ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">{r.billing_interval_months ?? "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtINR(r.total_paise)}</td>
                  <td className={`py-2 pr-3 uppercase text-xs font-mono ${statusColor[r.status] ?? "text-muted-foreground"}`}>{r.status}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {r.entitlement_projected_at ? new Date(r.entitlement_projected_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2">
                    {r.invoice_id ? (
                      <a href={`/invoice/${r.invoice_id}`} className="text-xs text-accent hover:underline">
                        {r.invoice_number ?? r.invoice_id.slice(0, 8)}
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
