import { useEffect, useState } from "react";
import { HardDrive, Zap, Sparkles, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";
import { extractFnError, reportBillingFailure } from "@/lib/payments/billingFailure";
import {
  PAYG_TB_INR,
  FREE_STORAGE_GB,
  FREE_BANDWIDTH_GB,
  FREE_BANDWIDTH_OVERAGE_INR_PER_GB,
} from "@/components/streamvista/plans";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";

interface UsageProfile {
  plan_tier: string;
  storage_used_mb: number;
  bandwidth_used_mb: number;
  topup_tb: number;
}

const MB_PER_GB = 1024;
const MB_PER_TB = 1024 * 1024;

/**
 * StorageUsageCard
 * ─────────────────
 *  • Free plan      → shows 128 GB storage + 500 GB bandwidth meters.
 *  • Creator plan   → shows (1 TB + topup_tb) usage with a 1-click
 *                     "Top up next 1 TB · ₹767" button (soft block when full).
 */
export default function StorageUsageCard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UsageProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toppingUp, setToppingUp] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("plan_tier,storage_used_mb,bandwidth_used_mb,topup_tb")
      .eq("user_id", user.id)
      .maybeSingle();
    setLoading(false);
    if (data) setProfile(data as UsageProfile);
  };

  useEffect(() => { load(); }, [user?.id]);

  const topUp = async () => {
    if (!user) return;
    setToppingUp(true);
    const t = toast.loading("Opening Razorpay…");
    let stage: "dialog_launch" | "order_create" | "payment_verify" = "dialog_launch";
    try {
      assertLiveCheckoutHost();
      stage = "order_create";
      const { data, error } = await supabase.functions.invoke("create-storage-topup", {
        body: { tb: 1 },
      });
      if (error) {
        const msg = await extractFnError(error, "Could not create storage top-up");
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!(data as any)?.orderId) {
        throw new Error("Creator storage add-on is not available right now.");
      }

      await new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
        document.body.appendChild(s);
      });

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "StreamVista Cloud X",
        description: "Pay-As-You-Go · +1 TB storage",
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async (resp: any) => {
          stage = "payment_verify";
          const v = await supabase.functions.invoke("verify-storage-topup", {
            body: {
              topupId: data.topupId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (v.error || (v.data as any)?.error) {
            const msg = (v.data as any)?.error
              || (await extractFnError(v.error, "Payment verification failed"));
            toast.error(`Payment verification failed — ${msg}`);
            reportBillingFailure({
              userId: user.id,
              userEmail: user.email,
              dashboard: "creator",
              surface: "creator_storage_topup_card",
              intent: "Creator +1 TB top-up",
              stage: "payment_verify",
              error: new Error(msg),
              extra: { topup_id: data.topupId, razorpay_order_id: resp.razorpay_order_id },
            });
          } else {
            toast.success("+1 TB added to your workspace 🎉");
            if (user?.id) {
              await notify(user.id, "storage_topup_paid", "+1 TB storage added", "Your workspace storage entitlement has been expanded. New uploads can use the additional space immediately.");
            }
            load();
          }
        },
      });
      rzp.on?.("payment.failed", (resp: any) => {
        const msg = resp?.error?.description ?? resp?.error?.reason ?? "Payment failed at gateway";
        toast.error(msg);
        reportBillingFailure({
          userId: user.id,
          userEmail: user.email,
          dashboard: "creator",
          surface: "creator_storage_topup_card",
          intent: "Creator +1 TB top-up",
          stage: "payment_verify",
          error: new Error(msg),
          extra: { topup_id: data.topupId, razorpay_order_id: data.orderId },
        });
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e: any) {
      const msg = e?.message || "Top-up failed";
      toast.error(msg, { id: t });
      reportBillingFailure({
        userId: user.id,
        userEmail: user.email,
        dashboard: "creator",
        surface: "creator_storage_topup_card",
        intent: "Creator +1 TB top-up",
        stage,
        error: e,
      });
    } finally {
      setToppingUp(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="glass rounded-2xl p-5 grid place-items-center h-32">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  // Resolve real total quota from entitlement RPC (included + paid + admin bonus).
  const [entitlement, setEntitlement] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (supabase as any).rpc("get_workspace_storage_entitlement", { _user_id: user.id })
      .then(({ data }: any) => { if (!cancelled && data) setEntitlement(data); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const totalGb = Number(entitlement?.total_storage_gb ?? FREE_STORAGE_GB);
  const paidGb = Number(entitlement?.paid_storage_gb ?? 0);
  const bonusGb = Number(entitlement?.admin_bonus_storage_gb ?? 0);
  const testingGb = Number(entitlement?.testing_override_gb ?? 0);
  const testingOn = Boolean(entitlement?.testing_mode_enabled) && testingGb > 0;
  const planCode = String(entitlement?.plan_code ?? "creator_basic");
  const includedGb = Number(entitlement?.included_storage_gb ?? 0);
  const isCreator = paidGb > 0 || planCode !== "creator_basic";
  const storageQuotaMb = totalGb * MB_PER_GB;
  const storageUsedMb = Number(profile.storage_used_mb || 0);
  const storagePct = Math.min(100, Math.round((storageUsedMb / storageQuotaMb) * 100));
  const storageFull = storagePct >= 100;

  const bwQuotaMb = FREE_BANDWIDTH_GB * MB_PER_GB;
  const bwUsedMb = Number(profile.bandwidth_used_mb || 0);
  const bwPct = Math.min(100, Math.round((bwUsedMb / bwQuotaMb) * 100));
  const bwOverGb = Math.max(0, (bwUsedMb - bwQuotaMb) / MB_PER_GB);

  const fmt = (mb: number) =>
    mb >= MB_PER_TB ? `${(mb / MB_PER_TB).toFixed(2)} TB`
    : mb >= MB_PER_GB ? `${(mb / MB_PER_GB).toFixed(1)} GB`
    : `${mb.toFixed(0)} MB`;

  const totalQuotaLabel = totalGb >= 1024
    ? `${(totalGb / 1024).toFixed(2)} TB`
    : `${totalGb.toFixed(0)} GB`;
  const planLabel = isCreator
    ? `Creator · ${paidGb > 0 ? `${Math.round(paidGb / 1024)} TB add-on` : "paid plan"}${bonusGb > 0 ? ` + ${bonusGb.toFixed(0)} GB grant` : ""}`
    : `Creator Basic · submission plan${bonusGb > 0 ? ` + ${bonusGb.toFixed(0)} GB grant` : ""}`;


  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent" />
            Storage &amp; Bandwidth
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {planLabel}

          </p>
        </div>
        {isCreator && (
          <span className="text-[10px] font-mono-tech uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-1 rounded">
            <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1" /> Auto top-up
          </span>
        )}
      </div>

      {/* Storage meter */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground inline-flex items-center gap-2">
            Storage
            {testingOn && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
                Testing +{testingGb} GB
              </span>
            )}
          </span>
          <span className="font-mono">
            <b className="text-foreground">{fmt(storageUsedMb)}</b> / {totalQuotaLabel}
          </span>
        </div>
        <div className="h-2 rounded-full bg-border/50 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              storageFull ? "bg-destructive"
              : storagePct > 80 ? "bg-amber-400"
              : "bg-gradient-to-r from-primary to-accent",
            )}
            style={{ width: `${storagePct}%` }}
          />
        </div>
        {testingOn && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Total = {includedGb} GB plan + {paidGb.toFixed(0)} GB paid{bonusGb > 0 ? ` + ${bonusGb.toFixed(0)} GB grant` : ""} + <span className="text-amber-400">{testingGb} GB testing</span>. Testing allowance is internal QA only and is removed when the platform exits testing mode.
          </p>
        )}
        {storageFull && (
          <p className="text-[11px] text-destructive mt-1.5">
            Storage full — uploads paused. {isCreator ? "Request more storage from the Upgrade tab — our team will follow up." : "Request a Creator upgrade for more storage."}
          </p>
        )}
      </div>

      {/* Bandwidth meter (Free plan only) */}
      {!isCreator && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground inline-flex items-center gap-1"><Zap className="w-3 h-3" /> Bandwidth this month</span>
            <span className="font-mono">
              <b className="text-foreground">{fmt(bwUsedMb)}</b> / {FREE_BANDWIDTH_GB} GB
            </span>
          </div>
          <div className="h-2 rounded-full bg-border/50 overflow-hidden">
            <div
              className={cn("h-full transition-all", bwPct >= 100 ? "bg-destructive" : "bg-gradient-to-r from-accent to-primary")}
              style={{ width: `${bwPct}%` }}
            />
          </div>
          {bwOverGb > 0 && (
            <p className="text-[11px] text-amber-400 mt-1.5">
              Overage: <b>{bwOverGb.toFixed(1)} GB</b> · ₹{(bwOverGb * FREE_BANDWIDTH_OVERAGE_INR_PER_GB).toFixed(0)} billable
            </p>
          )}
        </div>
      )}

      {/* Creator billing is founder-assisted — route to upgrade request form, not self-serve checkout. */}
      <a
        href="/dashboard/content?section=upgrade"
        className={cn(
          "w-full h-11 leading-[44px] text-center rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
          storageFull
            ? "bg-gradient-primary text-primary-foreground glow-primary"
            : "border border-accent/40 text-accent hover:bg-accent/10",
        )}
      >
        <ArrowUpRight className="w-4 h-4" />
        {isCreator ? "Request more storage" : "Request a Creator upgrade"}
      </a>
    </div>
  );
}
