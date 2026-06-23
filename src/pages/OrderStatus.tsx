import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, XCircle, RefreshCw, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Topup = {
  id: string;
  user_id: string;
  status: string;
  source: string | null;
  tb_added: number | null;
  amount_inr: number | null;
  total_paise: number | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  entitlement_projected_at: string | null;
  created_at: string;
  updated_at: string;
};

type StageState = "done" | "active" | "pending" | "failed";

function Stage({ title, hint, state, ts }: { title: string; hint: string; state: StageState; ts?: string | null }) {
  const Icon =
    state === "done" ? CheckCircle2 :
    state === "failed" ? XCircle :
    state === "active" ? Loader2 :
    Clock;
  const color =
    state === "done" ? "text-emerald-400" :
    state === "failed" ? "text-red-400" :
    state === "active" ? "text-accent" :
    "text-muted-foreground";
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`mt-0.5 ${color}`}>
        <Icon className={`w-5 h-5 ${state === "active" ? "animate-spin" : ""}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-foreground">{title}</div>
          {state === "active" && <Badge variant="outline" className="text-[10px]">in progress</Badge>}
          {state === "done" && <Badge className="bg-emerald-600 text-[10px]">done</Badge>}
          {state === "failed" && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        {ts && <div className="text-[10px] text-muted-foreground mt-1 font-mono">{new Date(ts).toLocaleString()}</div>}
      </div>
    </div>
  );
}

export default function OrderStatus() {
  const { topupId } = useParams<{ topupId: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [topup, setTopup] = useState<Topup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState<string>(new Date().toISOString());

  const productLabel = params.get("label") ?? "Studio Vault Storage";

  const fetchOnce = async () => {
    if (!topupId) return;
    const { data, error: err } = await supabase
      .from("storage_topups")
      .select("id,user_id,status,source,tb_added,amount_inr,total_paise,razorpay_order_id,razorpay_payment_id,entitlement_projected_at,created_at,updated_at")
      .eq("id", topupId)
      .maybeSingle();
    setLastTick(new Date().toISOString());
    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setError("Order not found or you don't have access to it."); setLoading(false); return; }
    setError(null);
    setTopup(data as Topup);
    setLoading(false);
  };

  useEffect(() => {
    fetchOnce();
    if (!topupId) return;
    // Realtime
    const channel = supabase
      .channel(`storage_topup_${topupId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "storage_topups", filter: `id=eq.${topupId}` }, (payload) => {
        setTopup((prev) => ({ ...(prev as Topup), ...(payload.new as Topup) }));
        setLastTick(new Date().toISOString());
      })
      .subscribe();
    // Poll fallback every 4s for the first 3 minutes while non-terminal
    const start = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - start > 1000 * 60 * 5) { clearInterval(poll); return; }
      const s = topup?.status;
      if (s === "paid" || s === "failed" || s === "refunded" || s === "cancelled") { clearInterval(poll); return; }
      fetchOnce();
    }, 4000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupId]);

  const stages = useMemo(() => {
    if (!topup) {
      return {
        order: "pending" as StageState,
        captured: "pending" as StageState,
        verified: "pending" as StageState,
        activated: "pending" as StageState,
      };
    }
    const failed = topup.status === "failed" || topup.status === "cancelled";
    const paid = topup.status === "paid";
    const hasOrder = !!topup.razorpay_order_id;
    const hasPayment = !!topup.razorpay_payment_id;
    const activated = !!topup.entitlement_projected_at;

    return {
      order: hasOrder ? "done" : (failed ? "failed" : "active"),
      captured: hasPayment ? "done" : (failed ? "failed" : hasOrder ? "active" : "pending"),
      verified: paid ? "done" : (failed ? "failed" : hasPayment ? "active" : "pending"),
      activated: activated ? "done" : (failed ? "failed" : paid ? "active" : "pending"),
    } as Record<string, StageState>;
  }, [topup]);

  const isTerminal = topup?.status === "paid" || topup?.status === "failed" || topup?.status === "cancelled";
  const isSuccess = topup?.status === "paid" && !!topup?.entitlement_projected_at;

  // Verification failure / stall detection: payment captured by Razorpay
  // but server-side signature verify or entitlement projection never landed.
  const now = Date.now();
  const ageSec = topup ? Math.floor((now - new Date(topup.updated_at).getTime()) / 1000) : 0;
  const chargedButNotVerified =
    !!topup &&
    !!topup.razorpay_payment_id &&
    topup.status !== "paid" &&
    topup.status !== "cancelled";
  const verificationStalled =
    chargedButNotVerified && (topup?.status === "failed" || ageSec > 60);
  const paidButNotActivated =
    !!topup && topup.status === "paid" && !topup.entitlement_projected_at && ageSec > 30;
  const showRecovery = verificationStalled || paidButNotActivated;

  const supportMessage = topup
    ? [
        `Hi StreamVista support,`,
        ``,
        `My ${productLabel} purchase was charged but the plan has not activated. Please reconcile manually.`,
        ``,
        `topup_id: ${topup.id}`,
        `razorpay_order_id: ${topup.razorpay_order_id ?? "(none)"}`,
        `razorpay_payment_id: ${topup.razorpay_payment_id ?? "(none)"}`,
        `status: ${topup.status}`,
        `amount: ₹${(topup.total_paise ? topup.total_paise / 100 : Number(topup.amount_inr ?? 0)).toLocaleString("en-IN")}`,
        `tb_requested: ${topup.tb_added ?? "(unknown)"}`,
        `entitlement_projected_at: ${topup.entitlement_projected_at ?? "(not set)"}`,
        `created_at: ${topup.created_at}`,
        `last_updated: ${topup.updated_at}`,
        ``,
        `Thank you.`,
      ].join("\n")
    : "";
  const supportHref = topup
    ? `/support?message=${encodeURIComponent(supportMessage)}${user?.email ? `&email=${encodeURIComponent(user.email)}` : ""}`
    : "/support";

  return (
    <main className="min-h-dvh px-4 py-10 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Order status</div>
        <h1 className="font-display text-3xl font-bold mt-1">{productLabel}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live updates from our payment & provisioning pipeline. This page refreshes itself — keep it open while your plan activates.
        </p>
      </div>

      {loading && (
        <div className="glass-strong rounded-2xl p-8 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your order…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <div className="flex items-center gap-2 font-semibold text-red-300">
            <XCircle className="w-5 h-5" /> Could not load order
          </div>
          <div className="text-sm text-muted-foreground mt-1">{error}</div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={fetchOnce}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
            <Button asChild variant="secondary"><Link to="/support">Contact support</Link></Button>
          </div>
        </div>
      )}

      {topup && !error && (
        <div className="glass-strong rounded-2xl p-6 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Order</div>
              <div className="font-mono text-xs">{topup.razorpay_order_id ?? "pending…"}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="font-semibold">
                ₹{(topup.total_paise ? topup.total_paise / 100 : Number(topup.amount_inr ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 my-2" />

          <Stage
            title="Order created"
            hint="We created a secure Razorpay order for your purchase."
            state={stages.order}
            ts={topup.created_at}
          />
          <Stage
            title="Payment captured"
            hint="Razorpay confirmed the charge on your card / UPI / netbanking."
            state={stages.captured}
            ts={topup.razorpay_payment_id ? topup.updated_at : null}
          />
          <Stage
            title="Payment verified"
            hint="Server-side signature verified and recorded in our ledger."
            state={stages.verified}
            ts={topup.status === "paid" ? topup.updated_at : null}
          />
          <Stage
            title="Plan activated"
            hint={`${topup.tb_added ?? "—"} TB added to your vault entitlement. Storage limits and dashboards refreshed.`}
            state={stages.activated}
            ts={topup.entitlement_projected_at}
          />

          <div className="border-t border-border/40 my-2" />

          {isSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <div className="font-semibold">Your plan is live</div>
                <div className="text-sm text-muted-foreground">
                  {topup.tb_added} TB of storage is now available. A receipt has been sent to {user?.email ?? "your email"}.
                </div>
              </div>
            </div>
          )}

          {isTerminal && !isSuccess && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-red-300">
                <XCircle className="w-5 h-5" /> Order did not complete
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Status: <span className="font-mono">{topup.status}</span>. If your card was charged, our team has already been notified and will reconcile within 24h.
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline"><Link to="/support">Open a support ticket</Link></Button>
                <Button asChild variant="secondary"><Link to="/dashboard/studio">Back to dashboard</Link></Button>
              </div>
            </div>
          )}

          {!isTerminal && (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Waiting for the next event… Last refresh {new Date(lastTick).toLocaleTimeString()}.
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={fetchOnce}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Secured by Razorpay · Verified server-side
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/dashboard/studio">Go to dashboard <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
