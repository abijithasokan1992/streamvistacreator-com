import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldAlert, Sparkles, ArrowUpRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PAYG_TB_INR, FREE_STORAGE_GB } from "@/components/streamvista/plans";

/**
 * Fair Usage & Soft-Lock
 * ──────────────────────
 *  Free users: 50 GB hard cap. Warning at 45 GB. Past the cap all upload
 *  surfaces (Vault, Camera-to-Cloud, Master Archive, etc.) call
 *  `checkOrPaywall()` which either allows the upload or opens the
 *  conversion overlay wired to the existing Razorpay top-up flow.
 *
 *  Creator users have no soft-lock (their meter lives in StorageUsageCard
 *  with auto top-up at the same Razorpay endpoint).
 */

const MB_PER_GB = 1024;
const FREE_LIMIT_MB = FREE_STORAGE_GB * MB_PER_GB;
export const FREE_WARN_MB = 45 * MB_PER_GB;

type Quota = {
  loading: boolean;
  isCreator: boolean;
  usedMb: number;
  limitMb: number;
  percent: number;
  warning: boolean;
  locked: boolean;
  /** Free user has hit the 50 GB cap → uploads are soft-locked. */
  checkOrPaywall: () => boolean;
  /** Force-open the upgrade overlay (for the warning banner CTA). */
  openPaywall: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Quota | null>(null);

export function useStorageQuota(): Quota {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback so components rendered outside the provider don't crash.
    return {
      loading: false, isCreator: true, usedMb: 0, limitMb: FREE_LIMIT_MB,
      percent: 0, warning: false, locked: false,
      checkOrPaywall: () => true, openPaywall: () => {}, refresh: async () => {},
    };
  }
  return v;
}

export function StorageQuotaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(true);
  const [usedMb, setUsedMb] = useState(0);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("plan_tier,storage_used_mb")
      .eq("user_id", user.id)
      .maybeSingle();
    setLoading(false);
    if (data) {
      setIsCreator(data.plan_tier === "creator");
      setUsedMb(Number(data.storage_used_mb || 0));
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const limitMb = isCreator ? Number.MAX_SAFE_INTEGER : FREE_LIMIT_MB;
  const percent = isCreator ? 0 : Math.min(100, Math.round((usedMb / FREE_LIMIT_MB) * 100));
  const warning = !isCreator && usedMb >= FREE_WARN_MB && usedMb < FREE_LIMIT_MB;
  const locked = !isCreator && usedMb >= FREE_LIMIT_MB;

  const openPaywall = useCallback(() => setOpen(true), []);

  const checkOrPaywall = useCallback(() => {
    if (locked) { setOpen(true); return false; }
    return true;
  }, [locked]);

  const upgrade = useCallback(async () => {
    if (!user) { toast.error("Sign in to upgrade"); return; }
    setPaying(true);
    const t = toast.loading("Opening Razorpay…");
    try {
      assertLiveCheckoutHost();
      const { data, error } = await supabase.functions.invoke("create-storage-topup", { body: { tb: 1 } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

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
        name: "StreamVista Creator Plan",
        description: "1 TB cinema-grade storage · auto top-up",
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
          if (v.error || (v.data as any)?.error) toast.error("Payment verification failed");
          else {
            toast.success("Creator Plan activated — uploads unlocked 🎉");
            setOpen(false);
            refresh();
          }
        },
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Could not start upgrade", { id: t });
    } finally {
      setPaying(false);
    }
  }, [user, refresh]);

  const value = useMemo<Quota>(() => ({
    loading, isCreator, usedMb, limitMb, percent, warning, locked,
    checkOrPaywall, openPaywall, refresh,
  }), [loading, isCreator, usedMb, limitMb, percent, warning, locked, checkOrPaywall, openPaywall, refresh]);

  return (
    <Ctx.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-accent/40 bg-gradient-to-br from-background via-background to-primary/10">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 grid place-items-center mb-2 ring-1 ring-destructive/30">
              <Lock className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center font-display text-xl">
              Storage Limit Reached
            </DialogTitle>
            <DialogDescription className="text-center">
              You've used <b className="text-foreground">{(usedMb / MB_PER_GB).toFixed(1)} GB</b> of your{" "}
              <b className="text-foreground">{FREE_STORAGE_GB} GB</b> free quota. Upgrade to keep uploading —
              your existing files stay viewable and downloadable.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 my-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Creator Plan
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold">₹{PAYG_TB_INR}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="text-xs text-muted-foreground mt-3 space-y-1.5">
              <li>• <b className="text-foreground">1 TB</b> cinema-grade storage (20× your current cap)</li>
              <li>• Pay-As-You-Go — next TB auto-unlocks at ₹{PAYG_TB_INR}</li>
              <li>• Frame-accurate review · Camera-to-cloud ingest</li>
              <li>• Cancel anytime · no commitments</li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={upgrade} disabled={paying} size="lg" className="w-full bg-gradient-primary text-primary-foreground glow-primary">
              {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Upgrade · pay ₹{PAYG_TB_INR}
            </Button>
            <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Not now — I'll free up space
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/** Inline alert banner — drop into the dashboard so users see the 45 GB warning. */
export function StorageWarningBanner() {
  const q = useStorageQuota();
  if (q.loading || q.isCreator) return null;
  if (!q.warning && !q.locked) return null;
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 text-sm ${
      q.locked
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-amber-400/40 bg-amber-400/10 text-amber-500"
    }`}>
      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold">
          {q.locked
            ? `Storage full — uploads paused (${(q.usedMb / MB_PER_GB).toFixed(1)} / ${FREE_STORAGE_GB} GB)`
            : `You're at ${(q.usedMb / MB_PER_GB).toFixed(1)} GB of ${FREE_STORAGE_GB} GB — upgrade soon to keep uploading.`}
        </div>
        <button onClick={q.openPaywall} className="underline underline-offset-2 hover:opacity-80 mt-1 text-xs">
          Upgrade to Creator · ₹{PAYG_TB_INR} / month →
        </button>
      </div>
    </div>
  );
}
