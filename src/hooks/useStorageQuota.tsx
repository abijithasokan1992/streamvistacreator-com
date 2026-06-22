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
 * Storage entitlement & hard-stop (Part 11E)
 * ──────────────────────────────────────────
 * Source of truth is the `get_workspace_storage_entitlement` RPC which returns
 *   included_storage_gb + paid_storage_gb + admin_bonus_storage_gb → total_storage_gb
 * Creator Basic ships with 5 GB included. Buying a 1 TB add-on or receiving an
 * admin grant grows `total_storage_gb` and the same warning/urgent/hard-stop
 * thresholds apply to every plan — there is no separate "creator means infinite".
 */

const MB_PER_GB = 1024;
const FREE_LIMIT_MB = FREE_STORAGE_GB * MB_PER_GB;
export const FREE_WARN_MB = 4 * MB_PER_GB; // 80% of 5 GB — kept exported for legacy callers

type Quota = {
  loading: boolean;
  /** True when the workspace is on the Creator Basic submission plan. */
  isBasic: boolean;
  /** Legacy alias — `isCreator` historically meant "has paid storage". */
  isCreator: boolean;
  planCode: string;
  usedMb: number;
  limitMb: number;
  totalGb: number;
  includedGb: number;
  paidGb: number;
  bonusGb: number;
  addonBlocks: number;
  percent: number;
  warning: boolean;
  urgent: boolean;
  locked: boolean;
  /** Returns false when over the hard-stop and opens the upgrade overlay. */
  checkOrPaywall: () => boolean;
  /** Force-open the upgrade overlay (for the warning banner CTA). */
  openPaywall: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Quota | null>(null);

export function useStorageQuota(): Quota {
  const v = useContext(Ctx);
  if (!v) {
    return {
      loading: false, isBasic: true, isCreator: false, planCode: "creator_basic",
      usedMb: 0, limitMb: FREE_LIMIT_MB,
      totalGb: FREE_STORAGE_GB, includedGb: FREE_STORAGE_GB, paidGb: 0, bonusGb: 0, addonBlocks: 0,
      percent: 0, warning: false, urgent: false, locked: false,
      checkOrPaywall: () => true, openPaywall: () => {}, refresh: async () => {},
    };
  }
  return v;
}

export function StorageQuotaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ent, setEnt] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_workspace_storage_entitlement", { _user_id: user.id });
    setLoading(false);
    if (!error && data) setEnt(data);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const planCode = String(ent?.plan_code || "creator_basic");
  const includedGb = Number(ent?.included_storage_gb ?? FREE_STORAGE_GB);
  const paidGb = Number(ent?.paid_storage_gb ?? 0);
  const bonusGb = Number(ent?.admin_bonus_storage_gb ?? 0);
  const totalGb = Number(ent?.total_storage_gb ?? includedGb + paidGb + bonusGb);
  const addonBlocks = Number(ent?.storage_addon_blocks ?? 0);
  const usedBytes = Number(ent?.used_bytes ?? 0);
  const usedMb = Math.round(usedBytes / (1024 * 1024));
  const limitMb = Math.max(1, totalGb * MB_PER_GB);
  const percent = Math.min(100, Math.round((usedMb / limitMb) * 100));
  const warnPct = Number(ent?.warning_threshold_pct ?? 80);
  const urgentPct = Number(ent?.urgent_threshold_pct ?? 95);
  const hardPct = Number(ent?.hard_stop_threshold_pct ?? 100);
  const warning = percent >= warnPct && percent < urgentPct;
  const urgent = percent >= urgentPct && percent < hardPct;
  const locked = percent >= hardPct;
  const isBasic = planCode === "creator_basic" && paidGb <= 0;
  const isCreator = !isBasic;

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
    loading, isBasic, isCreator, planCode,
    usedMb, limitMb, totalGb, includedGb, paidGb, bonusGb, addonBlocks,
    percent, warning, urgent, locked,
    checkOrPaywall, openPaywall, refresh,
  }), [loading, isBasic, isCreator, planCode, usedMb, limitMb, totalGb, includedGb, paidGb, bonusGb, addonBlocks, percent, warning, urgent, locked, checkOrPaywall, openPaywall, refresh]);


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
