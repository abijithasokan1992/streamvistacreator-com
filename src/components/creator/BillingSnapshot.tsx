import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * BillingSnapshot — reads the caller's recent `invoices` and last active
 * `plan_assignment`. No hardcoded amounts. If nothing exists, we show an
 * explicit "No Data Found" state instead of a placeholder.
 */

type Invoice = {
  id: string;
  invoice_number: string;
  total_paise: number;
  currency: string;
  status: string;
  issued_at: string | null;
  created_at: string;
  description: string | null;
};

type PlanInfo = { name: string | null; status: string | null };

export default function BillingSnapshot() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [inv, pa] = await Promise.all([
        (supabase as any)
          .from("invoices")
          .select("id, invoice_number, total_paise, currency, status, issued_at, created_at, description")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        (supabase as any)
          .from("plan_assignments")
          .select("status, plan:plans(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setInvoices((inv.data ?? []) as Invoice[]);
      setPlan(pa.data ? { name: pa.data.plan?.name ?? null, status: pa.data.status ?? null } : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 h-[140px] animate-pulse" />;
  }

  const hasAny = invoices.length > 0 || !!plan;

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 grid place-items-center">
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">Billing</p>
            <p className="text-sm font-semibold mt-0.5">
              {plan?.name ? `${plan.name} · ${plan.status}` : "No active plan"}
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/content?section=billing"
          className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
        >
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {!hasAny ? (
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs text-muted-foreground">
          No Data Found. Billing history will appear here once you upgrade or add capacity.
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs text-muted-foreground">
          No invoices yet. You're on {plan?.name ?? "the current plan"}.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/60">
          {invoices.map((i) => (
            <li key={i.id} className="py-2 flex items-center gap-3 text-xs">
              <span className="font-mono text-muted-foreground truncate">{i.invoice_number}</span>
              <span className="flex-1 truncate text-muted-foreground/80">{i.description || "—"}</span>
              <span className="tabular-nums">
                {formatMoney(i.total_paise, i.currency)}
              </span>
              <span className={
                i.status === "paid" ? "text-emerald-400"
                : i.status === "failed" ? "text-red-400"
                : "text-muted-foreground"
              }>
                {i.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMoney(paise: number, currency: string): string {
  const amt = Number(paise ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "INR").toUpperCase() }).format(amt);
  } catch {
    return `${currency?.toUpperCase() ?? "INR"} ${amt.toFixed(2)}`;
  }
}
