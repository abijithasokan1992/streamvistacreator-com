import { useEffect, useState } from "react";
import { Building2, HardDrive, Film, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";

type Summary = {
  displayName: string;
  planName: string;
  isFree: boolean;
  allocatedGb: number;
  usedGb: number;
  titleCount: number;
  titleLimit: number | null;
};

const FREE_TIER_GB = 50;

/**
 * Workspace identity + at-a-glance summary card.
 * - Prefers studio_name → display_name → email
 * - Single source for plan + storage + title usage to avoid duplicate labels.
 */
export default function WorkspaceWelcome() {
  const { user } = useAuth();
  const { active } = useWorkspaces();
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [pa, alloc, prof, uploads, titles, tier] = await Promise.all([
        (supabase as any).from("plan_assignments")
          .select("plan:plans(name, storage_gb)").eq("user_id", user.id)
          .eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("storage_allocations").select("allocated_gb").eq("user_id", user.id),
        (supabase as any).from("user_profiles").select("studio_name, display_name, plan_tier").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("recent_uploads").select("file_size, status").eq("user_id", user.id),
        (supabase as any).from("content_titles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id),
        (supabase as any).rpc("creator_free_tier_status"),
      ]);

      const planName: string = pa.data?.plan?.name
        || (prof.data?.plan_tier && prof.data.plan_tier !== "free" ? `Plan: ${prof.data.plan_tier}` : "Creator Basic");
      const tierData = (tier?.data ?? null) as any;
      const isFree = !!tierData?.is_free || (!pa.data && (!prof.data?.plan_tier || prof.data.plan_tier === "free"));

      const canonAllocated = (alloc.data ?? []).reduce((a: number, r: any) => a + Number(r.allocated_gb || 0), 0);
      const planBaseline = Number(pa.data?.plan?.storage_gb || 0);
      const allocatedGb = canonAllocated > 0
        ? canonAllocated + planBaseline
        : planBaseline > 0 ? planBaseline : FREE_TIER_GB;

      const usedBytes = (uploads.data ?? [])
        .filter((u: any) => u.status !== "failed")
        .reduce((a: number, u: any) => a + Number(u.file_size || 0), 0);
      const usedGb = +(usedBytes / 1024 / 1024 / 1024).toFixed(2);

      const displayName = active?.name
        || prof.data?.studio_name
        || prof.data?.display_name
        || user.email
        || "Creator";

      if (!cancelled) setS({
        displayName,
        planName,
        isFree,
        allocatedGb,
        usedGb,
        titleCount: titles.count ?? 0,
        titleLimit: tierData?.max_submissions ?? (isFree ? 1 : null),
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id, active?.id]);

  if (!s) {
    return <div className="rounded-2xl border border-border/40 bg-secondary/5 p-5 h-[120px] animate-pulse" />;
  }

  const pct = s.allocatedGb > 0 ? Math.min(100, Math.round((s.usedGb / s.allocatedGb) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-border/40 bg-gradient-to-br from-secondary/15 to-secondary/5 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl md:text-2xl truncate max-w-[42ch] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground/70 shrink-0" />
            <span>Welcome back, <span className="text-accent">{s.displayName}</span></span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {s.isFree
              ? "You're on Creator Basic — request a plan change any time from Storage & Billing."
              : "Your titles, storage and plan at a glance."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs">
          <Crown className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium">{s.planName}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
        <Stat icon={HardDrive} label="Storage" primary={`${s.usedGb.toFixed(2)} GB`}
          secondary={`of ${s.allocatedGb} GB · ${pct}% used`} tone={pct >= 80 ? "warn" : "default"} />
        <Stat icon={Film} label="Titles" primary={String(s.titleCount)}
          secondary={s.titleLimit ? `of ${s.titleLimit} included` : "no plan cap"} />
        <Stat icon={Crown} label="Plan" primary={s.planName}
          secondary={s.isFree ? "Founder-assisted upgrade" : "Active"} />
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, primary, secondary, tone }:
  { icon: any; label: string; primary: string; secondary?: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={"text-base font-semibold font-display mt-1 truncate " + (tone === "warn" ? "text-amber-300" : "")}>
        {primary}
      </div>
      {secondary && <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{secondary}</div>}
    </div>
  );
}
