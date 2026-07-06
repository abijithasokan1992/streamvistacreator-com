import { useEffect, useState } from "react";
import { Loader2, Receipt, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Subscription = {
  id: string;
  status: string;
  gateway: string | null;
  provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  subscription_type: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  description: string | null;
  currency: string | null;
  total_paise: number | null;
  status: string;
  issued_at: string | null;
  created_at: string;
};

function fmtMoney(paise: number | null, currency: string | null) {
  if (paise == null) return "—";
  const amount = paise / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency ?? "INR").toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  succeeded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  refunded: "bg-secondary text-muted-foreground border-border/60",
};

export default function BillingSection() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [subRes, invRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id,status,gateway,provider,current_period_start,current_period_end,cancel_at_period_end,subscription_type")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select("id,invoice_number,description,currency,total_paise,status,issued_at,created_at")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false, nullsFirst: false })
          .limit(50),
      ]);
      if (cancelled) return;
      setLoading(false);
      setSub((subRes.data as unknown as Subscription) ?? null);
      setInvoices((invRes.data as unknown as Invoice[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const paid = invoices.filter(i => ["paid", "succeeded"].includes(i.status));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-xl">Billing</h2>
        <p className="text-sm text-muted-foreground">Your current plan, invoices and payment history.</p>
      </header>

      {loading ? (
        <div className="py-12 grid place-items-center" role="status" aria-label="Loading billing">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Receipt className="w-3.5 h-3.5" aria-hidden /> Current plan
            </div>
            {sub ? (
              <>
                <div className="mt-1.5 text-lg font-semibold capitalize">
                  {sub.subscription_type ?? "Buyer plan"} · <span className="text-sm text-muted-foreground">{sub.status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {sub.current_period_start && sub.current_period_end
                    ? `${new Date(sub.current_period_start).toLocaleDateString()} → ${new Date(sub.current_period_end).toLocaleDateString()}`
                    : "Active"}
                  {sub.cancel_at_period_end && " · Cancels at period end"}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 text-lg font-semibold">Buyer · Admin-mediated access</div>
                <p className="text-xs text-muted-foreground mt-1">
                  No paid subscription on file. Commercial deliveries are invoiced per approved package.
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Invoices &amp; payment history</h3>
              <span className="text-[10px] text-muted-foreground">{paid.length} paid · {invoices.length} total</span>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {invoices.map(i => (
                  <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {i.invoice_number ?? "Invoice"}
                        {i.description && <span className="text-muted-foreground font-normal"> · {i.description}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {i.issued_at ? new Date(i.issued_at).toLocaleDateString() : new Date(i.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm tabular-nums">{fmtMoney(i.total_paise, i.currency)}</span>
                      <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[i.status] ?? "bg-secondary text-muted-foreground border-border/60")}>
                        {i.status}
                      </Badge>
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2" aria-label={`View invoice ${i.invoice_number ?? ""}`}>
                        <a href={`/invoice/${i.id}`} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
