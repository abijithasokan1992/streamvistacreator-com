import { useEffect, useState } from "react";
import { HardDrive, Zap, Sparkles, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  PAYG_TB_INR,
  FREE_STORAGE_GB,
  FREE_BANDWIDTH_GB,
  FREE_BANDWIDTH_OVERAGE_INR_PER_GB,
} from "@/components/streamvista/plans";
import { cn } from "@/lib/utils";

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
    try {
      const { data, error } = await supabase.functions.invoke("create-storage-topup", {
        body: { tb: 1 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Load Razorpay checkout
      await new Promise<void>((resolve) => {
        if ((window as any).Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve();
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
          const v = await supabase.functions.invoke("verify-storage-topup", {
            body: {
              topupId: data.topupId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (v.error || (v.data as any)?.error) {
            toast.error("Payment verification failed");
          } else {
            toast.success("+1 TB added to your workspace 🎉");
            load();
          }
        },
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Top-up failed", { id: t });
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

  const isCreator = profile.plan_tier === "creator";
  const storageQuotaMb = isCreator
    ? (1 + Number(profile.topup_tb || 0)) * MB_PER_TB
    : FREE_STORAGE_GB * MB_PER_GB;
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

  const totalQuotaLabel = isCreator
    ? `${(storageQuotaMb / MB_PER_TB).toFixed(0)} TB`
    : `${FREE_STORAGE_GB} GB`;

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent" />
            Storage &amp; Bandwidth
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isCreator ? "Creator · Pay-As-You-Go" : "Basic Free Plan"}
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
          <span className="text-muted-foreground">Storage</span>
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
