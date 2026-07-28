import { useEffect, useState } from "react";
import { Loader2, Wallet, FileText, Receipt, AlertTriangle, RefreshCw, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BillingOperations from "@/components/admin/BillingOperations";
import ManualInvoiceConsole from "@/components/admin/ManualInvoiceConsole";
import AdminInvoices from "@/components/admin/AdminInvoices";
import PaymentTrace from "@/components/admin/PaymentTrace";
import FinanceExtensionHub from "@/components/admin/FinanceExtensionHub";

/**
 * Internal finance dashboard for StreamVista staff (admin / super_admin
 * with the matching internal permission bundles).
 *
 * Reuses existing billing components so finance staff have one focused
 * workspace without exposing the full Business & Revenue tab.
 */

type Snapshot = {
  active_subscriptions: number;
  pending_manual_invoices: number;
  unpaid_invoices: number;
  total_invoiced_30d: number;
  refunds_30d: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function AdminFinanceConsole() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [subs, manualPending, unpaidInv, invoiced30d, refunds30d] = await Promise.all([
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("manual_invoices").select("id", { count: "exact", head: true }).in("status", ["sent", "overdue"]),
      supabase.from("invoices").select("id", { count: "exact", head: true }).neq("status", "paid"),
      supabase.from("invoices").select("total_paise").gte("created_at", since).eq("status", "paid"),
      supabase.from("invoices").select("total_paise").gte("created_at", since).eq("status", "refunded"),
    ]);

    const totalInvoiced = (invoiced30d.data ?? []).reduce((sum: number, r: any) => sum + Number(r.total_paise ?? 0), 0) / 100;
    const totalRefunds = (refunds30d.data ?? []).reduce((sum: number, r: any) => sum + Number(r.total_paise ?? 0), 0) / 100;

    setSnap({
      active_subscriptions: subs.count ?? 0,
      pending_manual_invoices: manualPending.count ?? 0,
      unpaid_invoices: unpaidInv.count ?? 0,
      total_invoiced_30d: totalInvoiced,
      refunds_30d: totalRefunds,
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Payments & Finance</h3>
              <p className="text-xs text-muted-foreground">
                Subscriptions, invoices, refunds and payment traces — scoped for finance staff.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </header>

        {loading || !snap ? (
          <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading snapshot…
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Active subscriptions"  value={String(snap.active_subscriptions)} icon={<TrendingUp className="w-4 h-4" />} tone="primary" />
            <Stat label="Manual invoices pending" value={String(snap.pending_manual_invoices)} icon={<FileText className="w-4 h-4" />} tone="warn" />
            <Stat label="Unpaid invoices"       value={String(snap.unpaid_invoices)} icon={<AlertTriangle className="w-4 h-4" />} tone="warn" />
            <Stat label="Invoiced · last 30d"   value={fmt(snap.total_invoiced_30d)} icon={<Receipt className="w-4 h-4" />} tone="ok" />
            <Stat label="Refunds · last 30d"    value={fmt(snap.refunds_30d)} icon={<Calendar className="w-4 h-4" />} tone="muted" />
          </div>
        )}
      </div>

      <FinanceExtensionHub />
      <BillingOperations />
      <ManualInvoiceConsole />
      <AdminInvoices />
      <PaymentTrace />
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary"|"warn"|"ok"|"muted" }) {
  const toneCls =
    tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "warn"  ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
    : tone === "ok"    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
    : "border-border/60 bg-secondary/30 text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-display font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
