import { useEffect, useState, useRef } from "react";
import { Receipt, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtINRDecimal } from "@/lib/studioVault";
import { Link } from "react-router-dom";
import { toast } from "sonner";

async function openPaddlePortal(signal?: AbortSignal): Promise<{ ok: boolean; url?: string; error?: string; status?: number }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, error: "Please sign in again.", status: 401 };
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paddle-portal?mode=json`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error || `Portal error (${res.status})`, status: res.status };
    }
    const { url: portalUrl } = await res.json();
    if (!portalUrl) return { ok: false, error: "Portal URL missing." };
    return { ok: true, url: portalUrl };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "abort" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function friendlyPortalError(res: { error?: string; status?: number }): {
  title: string;
  description: string;
} {
  const status = res.status ?? 0;
  const error = res.error?.toLowerCase() ?? "";

  if (status === 401 || error.includes("sign in")) {
    return {
      title: "Session expired",
      description: "Please sign in again, then tap Manage subscription to retry.",
    };
  }
  if (status === 404 || error.includes("not found") || error.includes("no subscription")) {
    return {
      title: "No subscription found",
      description: "Make sure you have an active plan, then try again. Contact support if this looks wrong.",
    };
  }
  if (status >= 500 || error.includes("paddle") || error.includes("portal")) {
    return {
      title: "Billing portal temporarily unavailable",
      description: "The billing provider is having a moment. Wait a few seconds and tap Manage subscription again.",
    };
  }
  if (!status || error.includes("network") || error.includes("fetch")) {
    return {
      title: "Connection issue",
      description: "Check your internet connection and tap Manage subscription to retry.",
    };
  }
  return {
    title: res.error || "Couldn't open billing portal",
    description: "Tap Manage subscription again, or reach out to support if the problem continues.",
  };
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
  const portalPendingRef = useRef(false);
  const portalAbortRef = useRef<AbortController | null>(null);
  const loadingToastRef = useRef<string | number | undefined>(undefined);

  const dismissLoadingToast = () => {
    if (loadingToastRef.current) {
      toast.dismiss(loadingToastRef.current);
      loadingToastRef.current = undefined;
    }
  };

  const handleManage = async () => {
    if (portalLoading || portalPendingRef.current) return;
    portalPendingRef.current = true;
    setPortalLoading(true);
    portalAbortRef.current?.abort();
    const controller = new AbortController();
    portalAbortRef.current = controller;
    loadingToastRef.current = toast.loading("Generating your billing portal…");
    try {
      const res = await openPaddlePortal(controller.signal);
      if (res.ok && res.url) {
        dismissLoadingToast();
        toast.success("Billing portal ready", {
          description: "Refreshing your subscription management page…",
        });
        window.location.href = res.url;
        return;
      }
      if (res.error === "abort") return;
      if (!res.ok) {
        dismissLoadingToast();
        const { title, description } = friendlyPortalError(res);
        toast.error(title, {
          description,
          action: {
            label: "Retry",
            onClick: () => {
              toast.dismiss();
              handleManage();
            },
          },
        });
      }
    } catch (err) {
      dismissLoadingToast();
      const { title, description } = friendlyPortalError({
        error: err instanceof Error ? err.message : "Unable to reach the billing portal.",
      });
      toast.error(title, {
        description,
        action: {
          label: "Retry",
          onClick: () => {
            toast.dismiss();
            handleManage();
          },
        },
      });
    } finally {
      if (portalAbortRef.current === controller) {
        portalPendingRef.current = false;
        setPortalLoading(false);
        portalAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      portalAbortRef.current?.abort();
      dismissLoadingToast();
    };
  }, []);


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
