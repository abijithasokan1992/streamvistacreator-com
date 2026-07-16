import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldAlert, Sparkles, ArrowUpRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FREE_STORAGE_GB } from "@/components/streamvista/plans";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

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
  /**
   * True only after the entitlement RPC returned real data. When false
   * (loading, failed, or missing user), `locked` is forced to false and
   * `checkOrPaywall()` is permissive — never hard-block on an unknown quota.
   */
  known: boolean;
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
  testingOverrideGb: number;
  testingModeEnabled: boolean;
  testingRoleKey: string;
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
      loading: false, known: false, isBasic: true, isCreator: false, planCode: "creator_basic",
      usedMb: 0, limitMb: FREE_LIMIT_MB,
      totalGb: FREE_STORAGE_GB, includedGb: FREE_STORAGE_GB, paidGb: 0, bonusGb: 0,
      testingOverrideGb: 0, testingModeEnabled: false, testingRoleKey: "creator",
      addonBlocks: 0,
      percent: 0, warning: false, urgent: false, locked: false,
      checkOrPaywall: () => true, openPaywall: () => {}, refresh: async () => {},
    };

  }
  return v;
}

export function StorageQuotaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const payg = useCreatorPaygPrice();
  const paygLabel = payg.totalLabel;
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
  const testingOverrideGb = Number(ent?.testing_override_gb ?? 0);
  const testingModeEnabled = Boolean(ent?.testing_mode_enabled ?? false);
  const testingRoleKey = String(ent?.testing_role_key ?? "creator");
  const totalGb = Number(ent?.total_storage_gb ?? includedGb + paidGb + bonusGb + testingOverrideGb);
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
  const known = !loading && ent !== null;
  // When quota is unknown (loading or RPC failed), never hard-block uploads.
  const locked = known && percent >= hardPct;
  const isBasic = planCode === "creator_basic" && paidGb <= 0 && testingOverrideGb <= 0;
  const isCreator = !isBasic;

  const openPaywall = useCallback(() => setOpen(true), []);

  const checkOrPaywall = useCallback(() => {
    if (locked) { setOpen(true); return false; }
    return true;
  }, [locked]);


  const upgrade = useCallback(async () => {
    if (!user) { toast.error("Sign in to upgrade"); return; }
    setPaying(true);
    // Delegates to the global checkout helper. Refreshes the session,
    // forwards workspace/user context to the webhook, and opens Razorpay.
    const { initializeCheckout } = await import("@/lib/payments/initializeCheckout");
    try {
      await initializeCheckout({
        purpose: "storage_topup",
        payload: { tb: 1 },
        label: "StreamVista Creator Plan",
        description: "1 TB cinema-grade storage · auto top-up",
        prefill: { email: user.email ?? undefined },
        metadata: {
          user_id: user.id,
          payment_purpose: "creator_plan_upgrade",
          tier: "1TB",
        },
        onSuccess: () => {
          toast.success("Creator Plan activated — uploads unlocked 🎉");
          setOpen(false);
          refresh();
        },
      });
    } finally {
      setPaying(false);
    }
  }, [user, refresh]);

  const value = useMemo<Quota>(() => ({
    loading, known, isBasic, isCreator, planCode,
    usedMb, limitMb, totalGb, includedGb, paidGb, bonusGb,
    testingOverrideGb, testingModeEnabled, testingRoleKey,
    addonBlocks,
    percent, warning, urgent, locked,
    checkOrPaywall, openPaywall, refresh,
  }), [loading, known, isBasic, isCreator, planCode, usedMb, limitMb, totalGb, includedGb, paidGb, bonusGb, testingOverrideGb, testingModeEnabled, testingRoleKey, addonBlocks, percent, warning, urgent, locked, checkOrPaywall, openPaywall, refresh]);



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
              <span className="font-display text-3xl font-bold">{paygLabel}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="text-xs text-muted-foreground mt-3 space-y-1.5">
              <li>• <b className="text-foreground">1 TB</b> cinema-grade storage (20× your current cap)</li>
              <li>• Pay-As-You-Go — next TB auto-unlocks at {paygLabel}</li>
              <li>• Frame-accurate review · Camera-to-cloud ingest</li>
              <li>• Cancel anytime · no commitments</li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={upgrade} disabled={paying} size="lg" className="w-full bg-gradient-primary text-primary-foreground glow-primary">
              {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Upgrade · pay {paygLabel}
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

/** Inline alert banner — surfaces warning / urgent / hard-stop based on real entitlement. */
export function StorageWarningBanner() {
  const q = useStorageQuota();
  const payg = useCreatorPaygPrice();
  if (q.loading) return null;
  if (!q.warning && !q.urgent && !q.locked) return null;
  const usedGb = (q.usedMb / MB_PER_GB).toFixed(1);
  const totalGb = q.totalGb.toFixed(0);
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 text-sm ${
      q.locked
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : q.urgent
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : "border-amber-400/40 bg-amber-400/10 text-amber-500"
    }`}>
      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold">
          {q.locked
            ? `Storage full — uploads paused (${usedGb} / ${totalGb} GB)`
            : q.urgent
            ? `Urgent — ${q.percent}% of ${totalGb} GB used. Add 1 TB to keep uploading.`
            : `You're at ${usedGb} GB of ${totalGb} GB (${q.percent}%). Plan ahead — add 1 TB before you hit the cap.`}
        </div>
        <button onClick={q.openPaywall} className="underline underline-offset-2 hover:opacity-80 mt-1 text-xs">
          Add 1 TB storage · {payg.totalLabel} / month →
        </button>
      </div>
    </div>
  );
}
