import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowUpRight, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * WorkspacePlanCard — authoritative live plan module.
 * Reads from `plan_assignments` + `plans` + `subscriptions` + `invoices`.
 * No hardcoded values. Everything below is derived from the DB.
 */

type PlanRow = {
  name: string | null;
  code: string | null;
  description: string | null;
  price_amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  storage_gb: number | null;
  bandwidth_gb: number | null;
  user_limit: number | null;
  features: any;
};

type Assignment = { status: string | null; created_at: string | null; plan: PlanRow | null };
type Subscription = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  subscription_type: string | null;
};
type Invoice = {
  id: string;
  invoice_number: string;
  total_paise: number;
  currency: string;
  status: string;
  created_at: string;
  description: string | null;
};

export default function WorkspacePlanCard() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [pa, s, inv] = await Promise.all([
        (supabase as any)
          .from("plan_assignments")
          .select("status, created_at, plan:plans(name, code, description, price_amount, currency, billing_cycle, storage_gb, bandwidth_gb, user_limit, features)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("subscriptions")
          .select("status, current_period_end, cancel_at_period_end, subscription_type")
          .eq("user_id", user.id)
          .in("status", ["active", "trialing", "past_due", "paused"])
          .order("current_period_end", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("invoices")
          .select("id, invoice_number, total_paise, currency, status, created_at, description")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      setAssignment(pa.data ?? null);
      setSub(s.data ?? null);
      setInvoices((inv.data ?? []) as Invoice[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="rounded-2xl border border-border/40 bg-card/40 h-64 animate-pulse" />;
  }

  const plan = assignment?.plan;
  const planName = plan?.name || "Free";
  const isFree = !assignment || (plan?.code === "free") || !plan;
  const statusRaw = sub?.status || assignment?.status || (isFree ? "free" : "active");
  const featureList = deriveFeatures(plan);

  const renewalLabel = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 grid place-items-center ring-1 ring-accent/20">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold">
              Current Plan
            </p>
            <h3 className="font-semibold text-lg leading-tight mt-0.5">{planName}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
              <StatusPill status={statusRaw} />
              {plan?.billing_cycle && <span>· {plan.billing_cycle}</span>}
              {renewalLabel && (
                <span>· {sub?.cancel_at_period_end ? "Ends" : "Renews"} {renewalLabel}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFree ? (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:bg-accent/90"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Upgrade
            </Link>
          ) : (
            <Link
              to="/dashboard/content?section=billing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary/40"
            >
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </header>

      {featureList.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold mb-2">
            Included
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {featureList.map((f) => (
              <li key={f} className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
            Recent Billing
          </p>
          <Link to="/dashboard/content?section=billing" className="text-[11px] text-accent hover:underline">
            View all
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/50 p-3">
            No invoices yet. Charges will appear here after your first paid transaction.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {invoices.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground truncate w-24 shrink-0">{i.invoice_number}</span>
                <span className="flex-1 truncate text-muted-foreground/80">{i.description || "—"}</span>
                <span className="tabular-nums shrink-0">{formatMoney(i.total_paise, i.currency)}</span>
                <StatusPill status={i.status} tone="invoice" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function deriveFeatures(plan: PlanRow | null | undefined): string[] {
  if (!plan) {
    return [
      "Free workspace for creators & buyers",
      "Included baseline storage",
      "Community support",
    ];
  }
  const out: string[] = [];
  if (plan.storage_gb != null) out.push(`${plan.storage_gb >= 1024 ? (plan.storage_gb / 1024).toFixed(0) + " TB" : plan.storage_gb + " GB"} cinema-grade storage`);
  if (plan.bandwidth_gb != null && plan.bandwidth_gb > 0) out.push(`${plan.bandwidth_gb} GB bandwidth / cycle`);
  if (plan.user_limit != null && plan.user_limit > 0) out.push(`Up to ${plan.user_limit} workspace seats`);
  const f = plan.features;
  if (f && typeof f === "object") {
    if (Array.isArray(f)) {
      f.forEach((s) => { if (typeof s === "string") out.push(s); });
    } else {
      for (const [k, v] of Object.entries(f)) {
        if (v === true) out.push(prettifyKey(k));
        else if (typeof v === "string" && v.length < 60) out.push(`${prettifyKey(k)}: ${v}`);
      }
    }
  }
  if (plan.description && out.length < 3) out.push(plan.description);
  return out.slice(0, 8);
}

function prettifyKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatusPill({ status, tone }: { status: string; tone?: "invoice" }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    active: "text-success border-success/30 bg-success/5",
    trialing: "text-accent border-accent/30 bg-accent/5",
    past_due: "text-destructive border-destructive/30 bg-destructive/5",
    paused: "text-warning border-warning/30 bg-warning/5",
    canceled: "text-muted-foreground border-border/50 bg-secondary/20",
    free: "text-muted-foreground border-border/50 bg-secondary/20",
    paid: "text-success border-success/30 bg-success/5",
    failed: "text-destructive border-destructive/30 bg-destructive/5",
    pending: "text-warning border-warning/30 bg-warning/5",
  };
  const cls = map[s] || "text-muted-foreground border-border/50 bg-secondary/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {tone === "invoice" && s === "pending" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
      {s || "unknown"}
    </span>
  );
}

function formatMoney(paise: number, currency: string): string {
  const amt = Number(paise ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "INR").toUpperCase() }).format(amt);
  } catch {
    return `${(currency || "INR").toUpperCase()} ${amt.toFixed(2)}`;
  }
}
