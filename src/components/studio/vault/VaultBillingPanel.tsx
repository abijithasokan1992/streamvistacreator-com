import { useEffect, useState } from "react";
import { Receipt, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtINRDecimal } from "@/lib/studioVault";
import { Link } from "react-router-dom";
import { toast } from "sonner";

async function openPaddlePortal(): Promise<{ ok: boolean; error?: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, error: "Please sign in again." };
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paddle-portal?mode=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error || `Portal error (${res.status})` };
  }
  const { url: portalUrl } = await res.json();
  if (!portalUrl) return { ok: false, error: "Portal URL missing." };
  window.location.href = portalUrl;
  return { ok: true };
}


type Invoice = {
  id: string;
  invoice_number: string | null;
  description: string | null;
  total_paise: number | null;
  issued_at: string | null;
  source: string | null;
};

type Topup = {
  id: string;
  status: string;
  amount_inr: number | null;
  tb_added: number | null;
  storage_class: string | null;
  billing_interval_months: number | null;
  source: string | null;
  created_at: string;
};

export default function VaultBillingPanel() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManage = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const res = await openPaddlePortal();
      if (!res.ok) {
        toast.error(res.error || "Couldn't open billing portal", {
          description: "Please try again or contact support if the issue persists.",
        });
      }
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : "Unable to reach the billing portal.",
      });
    } finally {
      setPortalLoading(false);
    }
  };


  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [inv, tp] = await Promise.all([
        supabase
          .from("invoices")
          .select("id,invoice_number,description,total_paise,issued_at,source")
          .eq("user_id", user.id)
          .eq("source", "studio_vault")
          .order("issued_at", { ascending: false })
          .limit(10),
        supabase
          .from("storage_topups")
          .select("id,status,amount_inr,tb_added,storage_class,billing_interval_months,source,created_at")
          .eq("user_id", user.id)
          .eq("source", "studio_vault")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setInvoices((inv.data as Invoice[]) ?? []);
      setTopups((tp.data as Topup[]) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="rounded-2xl border border-border/40 p-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>;

  // Separate real receipts (paid) from incomplete / failed / abandoned
  // checkout attempts so the customer-facing receipts view is truthful.
  const paidTopups = topups.filter((t) => t.status === "paid");
  const incompleteTopups = topups.filter((t) => t.status !== "paid");

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl">Vault Billing</h2>
        </div>
        <button
          type="button"
          onClick={handleManage}
          disabled={portalLoading}
          aria-busy={portalLoading}
          aria-label={portalLoading ? "Opening billing portal…" : "Manage subscription"}
          className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] hover:bg-accent/10 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />}
          {portalLoading ? "Opening portal…" : "Manage subscription"}
        </button>
      </div>


      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent purchases</div>
        {paidTopups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vault purchases yet.</p>
        ) : (
          <ul className="text-sm divide-y divide-border/30">
            {paidTopups.map((t) => (
              <li key={t.id} className="py-2 flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()} · {t.tb_added ?? 1} TB ·{" "}
                  {t.storage_class?.replace("_", " ") ?? "vault"} · {t.billing_interval_months ?? 1}mo
                </span>
                <span className="text-xs uppercase tracking-widest font-mono text-emerald-300">
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        {incompleteTopups.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowIncomplete((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-accent underline-offset-2 hover:underline"
            >
              {showIncomplete ? "Hide" : `Show ${incompleteTopups.length} incomplete checkout attempt${incompleteTopups.length === 1 ? "" : "s"}`}
            </button>
            {showIncomplete && (
              <ul className="text-xs divide-y divide-border/20 mt-2 opacity-70">
                {incompleteTopups.map((t) => (
                  <li key={t.id} className="py-1.5 flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()} · {t.tb_added ?? 1} TB
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest font-mono ${
                      t.status === "pending" ? "text-amber-300" : "text-muted-foreground"
                    }`}>{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>


      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Invoices</div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="text-sm divide-y divide-border/30">
            {invoices.map((i) => (
              <li key={i.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{i.invoice_number ?? i.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{i.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{fmtINRDecimal(Number(i.total_paise ?? 0))}</span>
                  <Link to={`/invoice/${i.id}`} className="text-xs text-accent underline-offset-2 hover:underline">View</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
