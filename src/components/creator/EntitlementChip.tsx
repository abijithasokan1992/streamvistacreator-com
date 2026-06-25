import { useEffect, useState } from "react";
import { Crown, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Entitlement = {
  planName: string;
  allocatedGb: number;
  usedGb: number;
  remainingGb: number;
  pct: number;
};

const FREE_TIER_GB = 5;

/**
 * Reads canonical entitlement (plan_assignments + storage_allocations + invoices/topups).
 * Falls back to legacy user_profiles fields when no canonical rows exist (new accounts
 * that have not yet purchased a top-up). Storage used is computed from recent_uploads.
 */
export default function EntitlementChip() {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [pa, alloc, prof, uploads] = await Promise.all([
        (supabase as any).from("plan_assignments")
          .select("status, plan:plans(name, storage_gb)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle(),
        (supabase as any).from("storage_allocations")
          .select("allocated_gb, used_gb, source")
          .eq("user_id", user.id),
        (supabase as any).from("user_profiles")
          .select("plan_tier, topup_tb")
          .eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("recent_uploads")
          .select("file_size, status")
          .eq("user_id", user.id),
      ]);

      // Plan name: canonical assignment first, then legacy plan_tier, then "Free".
      const planName: string =
        pa.data?.plan?.name ||
        (prof.data?.plan_tier
          ? prof.data.plan_tier === "free" ? "Basic Free" : `Plan: ${prof.data.plan_tier}`
          : "Basic Free");

      // Allocated GB: sum canonical allocations, else baseline from plan, else legacy + free tier.
      const allocRows: any[] = alloc.data ?? [];
      const canonAllocated = allocRows.reduce((s, a) => s + Number(a.allocated_gb || 0), 0);
      const planBaseline = Number(pa.data?.plan?.storage_gb || 0);
      const legacyTopupGb = Number(prof.data?.topup_tb || 0) * 1024;
      const allocatedGb =
        canonAllocated > 0 ? canonAllocated + planBaseline
        : planBaseline > 0 ? planBaseline
        : FREE_TIER_GB + legacyTopupGb;

      // Used GB: derive from verified uploads (recent_uploads.file_size).
      const usedBytes = (uploads.data ?? [])
        .filter((u: any) => u.status !== "failed")
        .reduce((s: number, u: any) => s + Number(u.file_size || 0), 0);
      const usedGb = +(usedBytes / 1024 / 1024 / 1024).toFixed(2);

      const remainingGb = Math.max(0, +(allocatedGb - usedGb).toFixed(2));
      const pct = allocatedGb > 0 ? Math.min(100, Math.round((usedGb / allocatedGb) * 100)) : 0;

      if (!cancelled) setEnt({ planName, allocatedGb, usedGb, remainingGb, pct });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!ent) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 bg-secondary/20 text-xs text-muted-foreground">
        Loading entitlement…
      </div>
    );
  }

  const toneClass =
    ent.pct >= 95 ? "border-rose-500/40" :
    ent.pct >= 80 ? "border-amber-500/40" :
    "border-border/40";

  const fmtGb = (n: number) =>
    n >= 1024 ? `${(n / 1024).toFixed(1)} TB` : `${n.toFixed(n < 10 ? 2 : 0)} GB`;

  return (
    <div
      className={`hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full border ${toneClass} bg-secondary/20`}
      title={`${ent.usedGb} GB used of ${ent.allocatedGb} GB`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Crown className="w-3.5 h-3.5 text-accent" />
        <span className="font-semibold">{ent.planName}</span>
      </span>
      <span className="w-px h-4 bg-border/60" />
      <span className="inline-flex items-center gap-1.5 text-xs">
        <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-mono">
          {fmtGb(ent.usedGb)} / {fmtGb(ent.allocatedGb)}
        </span>
        <span className={`font-mono ${ent.pct >= 80 ? "text-amber-400" : "text-muted-foreground"}`}>
          · {ent.pct}%
        </span>
      </span>
    </div>
  );
}
