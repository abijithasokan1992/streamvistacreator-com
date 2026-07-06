/**
 * StudioDashboardHome — workflow-first B2B operations dashboard.
 *
 * Renders the six sections requested by the Studio brief on top of the
 * existing live-data contracts. No new tables, no new APIs, no duplicated
 * logic — reuses ProductionHero and ActivityPanel via slots and pulls the
 * remaining signals from tables already used elsewhere in the app.
 *
 * Answers in ≤5s:
 *   1. What production am I working on?   → Active Production hero
 *   2. What should I do next?             → Today's Work (dynamic)
 *   3. Is my studio ready to work?        → Studio Status (5 pillars)
 *   4. What business requires attention?  → Business Overview
 *
 * All copy uses business language — no infrastructure names, no cloud
 * providers, no database or API terms.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, AlertTriangle, Circle,
  Upload, Users, ClipboardCheck, Package, FolderPlus,
  Building2, Truck, ScrollText, FileText, IndianRupee,
  Sparkles, ShieldCheck, HardDrive, CreditCard, Cloud,
  ArrowRight, Clapperboard, FolderOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getProductionNumber } from "@/lib/productionNumber";

type ActiveProject = { id: string; name: string; crew?: any } | null;

type StudioDashboardHomeProps = {
  workspaceId: string | null;
  activeProject: ActiveProject;
  paidGbTotal: number;
  usedGbTotal: number;
  availableGb: number;
  storageLocked: boolean;
  currentUserId: string | null;
  productionHeroSlot: React.ReactNode;
  activityPanelSlot: React.ReactNode;
  onNewProduction: () => void;
  onImportMedia: () => void;
  onOpenProduction: () => void;
  onInviteTeam: () => void;
  onOpenBilling: () => void;
  onOpenStorage: () => void;
};

type StatusTone = "ready" | "attention" | "inactive";

function StatusDot({ tone }: { tone: StatusTone }) {
  const cls =
    tone === "ready"
      ? "bg-emerald-400 shadow-[0_0_0_3px_hsl(var(--emerald-500)/0.15)]"
      : tone === "attention"
      ? "bg-amber-400 shadow-[0_0_0_3px_hsl(var(--amber-500)/0.15)]"
      : "bg-muted-foreground/40";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

function statusLabel(tone: StatusTone) {
  return tone === "ready" ? "Ready" : tone === "attention" ? "Attention Required" : "Not Activated";
}

/* ------------------------------ Studio Status ------------------------------ */

function StudioStatus({
  storage, upload, billing, review, cloud,
}: {
  storage: StatusTone; upload: StatusTone; billing: StatusTone;
  review: StatusTone; cloud: StatusTone;
}) {
  const items: Array<{ label: string; icon: JSX.Element; tone: StatusTone }> = [
    { label: "Storage",        icon: <HardDrive className="w-3.5 h-3.5" />,    tone: storage },
    { label: "Upload Service", icon: <Upload className="w-3.5 h-3.5" />,       tone: upload },
    { label: "Billing",        icon: <CreditCard className="w-3.5 h-3.5" />,   tone: billing },
    { label: "AI Review",      icon: <Sparkles className="w-3.5 h-3.5" />,     tone: review },
    { label: "Cloud Status",   icon: <Cloud className="w-3.5 h-3.5" />,        tone: cloud },
  ];
  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg tracking-tight">Studio Status</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Is your studio ready to work?</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-border/50 bg-secondary/5 px-4 py-3.5 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{it.icon}</span>
              <StatusDot tone={it.tone} />
            </div>
            <div>
              <p className="text-[13px] font-medium leading-tight">{it.label}</p>
              <p
                className={`text-[11px] mt-0.5 ${
                  it.tone === "ready"
                    ? "text-emerald-400/90"
                    : it.tone === "attention"
                    ? "text-amber-400/90"
                    : "text-muted-foreground"
                }`}
              >
                {statusLabel(it.tone)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Today's Work ------------------------------ */

type TaskAction = {
  key: string;
  label: string;
  hint: string;
  icon: JSX.Element;
  onClick: () => void;
  primary?: boolean;
};

function TodaysWork({ tasks }: { tasks: TaskAction[] }) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg tracking-tight">Today's Work</h2>
          <p className="text-xs text-muted-foreground mt-0.5">What should you do next?</p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
          {tasks.length} action{tasks.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="grid gap-2.5">
        {tasks.slice(0, 5).map((t, i) => (
          <button
            key={t.key}
            onClick={t.onClick}
            className={`group text-left rounded-xl border transition-all px-4 py-3.5 flex items-center justify-between gap-4 ${
              t.primary || i === 0
                ? "border-accent/40 bg-accent/5 hover:bg-accent/10"
                : "border-border/50 bg-secondary/5 hover:bg-secondary/10"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center ${
                  t.primary || i === 0 ? "bg-accent/20 text-accent" : "bg-secondary/40 text-muted-foreground"
                }`}
              >
                {t.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{t.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.hint}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- Business Overview ---------------------------- */

type BusinessMetric = {
  key: string;
  label: string;
  value: number;
  icon: JSX.Element;
  tone?: "neutral" | "attention";
  onClick?: () => void;
};

function BusinessOverview({ metrics }: { metrics: BusinessMetric[] }) {
  const visible = metrics.filter((m) => m.value > 0);
  if (visible.length === 0) return null;
  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg tracking-tight">Business Overview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">What requires your attention?</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {visible.map((m) => (
          <button
            key={m.key}
            onClick={m.onClick}
            disabled={!m.onClick}
            className={`text-left rounded-xl border border-border/50 bg-secondary/5 px-4 py-4 transition-colors ${
              m.onClick ? "hover:bg-secondary/10 cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`${m.tone === "attention" ? "text-amber-400" : "text-muted-foreground"}`}>
                {m.icon}
              </span>
            </div>
            <p className="font-display text-2xl leading-none">{m.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 tracking-wide">{m.label}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Quick Actions ------------------------------ */

function QuickActions({
  onNewProduction, onImportMedia, onOpenProduction, onInviteTeam, hasActive,
}: {
  onNewProduction: () => void;
  onImportMedia: () => void;
  onOpenProduction: () => void;
  onInviteTeam: () => void;
  hasActive: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base tracking-tight">Quick Actions</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Jump straight to what you need.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onNewProduction}>
            <FolderPlus className="w-3.5 h-3.5 mr-1.5" /> New Production
          </Button>
          <Button size="sm" variant="outline" onClick={onImportMedia} disabled={!hasActive}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Import Media
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenProduction} disabled={!hasActive}>
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Open Production
          </Button>
          <Button size="sm" variant="outline" onClick={onInviteTeam}>
            <Users className="w-3.5 h-3.5 mr-1.5" /> Invite Team
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * Main component
 * ========================================================================== */

export default function StudioDashboardHome(props: StudioDashboardHomeProps) {
  const {
    workspaceId, activeProject, paidGbTotal, usedGbTotal, availableGb,
    storageLocked, currentUserId,
    productionHeroSlot, activityPanelSlot,
    onNewProduction, onImportMedia, onOpenProduction, onInviteTeam,
    onOpenBilling, onOpenStorage,
  } = props;

  const crew: any = activeProject?.crew ?? {};
  const titleId: string | undefined = typeof crew?.title_id === "string" ? crew.title_id : undefined;

  // ---- Live signals (best-effort, silent-fail so an empty section hides) ----
  const [memberCount, setMemberCount] = useState<number>(0);
  const [ingestCount, setIngestCount] = useState<number>(0);
  const [deliveriesPending, setDeliveriesPending] = useState<number>(0);
  const [qcOpen, setQcOpen] = useState<number>(0);
  const [rightsReady, setRightsReady] = useState<number>(0);
  const [openRequests, setOpenRequests] = useState<number>(0);
  const [outstandingPayments, setOutstandingPayments] = useState<number>(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await (supabase as any)
          .from("workspace_members")
          .select("user_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (!cancelled) setMemberCount(count ?? 0);
      } catch { /* ignore */ }
      try {
        const { count } = await (supabase as any)
          .from("ingest_jobs")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (!cancelled) setIngestCount(count ?? 0);
      } catch { /* ignore */ }
      try {
        const { count } = await (supabase as any)
          .from("commercial_requests")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (!cancelled) setOpenRequests(count ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    if (!titleId) {
      setDeliveriesPending(0); setQcOpen(0); setRightsReady(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("deal_deliveries")
          .select("id,status")
          .eq("title_id", titleId);
        const pending = ((data as any[]) ?? []).filter(
          (r) => String(r.status ?? "").toLowerCase() !== "delivered",
        ).length;
        if (!cancelled) setDeliveriesPending(pending);
      } catch { /* ignore */ }
      try {
        const { data } = await (supabase as any)
          .from("title_review_issues")
          .select("id,status")
          .eq("title_id", titleId);
        const open = ((data as any[]) ?? []).filter(
          (r) => !["resolved", "closed", "waived"].includes(String(r.status ?? "").toLowerCase()),
        ).length;
        if (!cancelled) setQcOpen(open);
      } catch { /* ignore */ }
      try {
        const { count } = await (supabase as any)
          .from("title_rights_availability")
          .select("id", { count: "exact", head: true })
          .eq("title_id", titleId);
        if (!cancelled) setRightsReady(count ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [titleId]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("invoices")
          .select("id,status,paid_at")
          .eq("user_id", currentUserId);
        const unpaid = ((data as any[]) ?? []).filter(
          (r) => !r.paid_at && !["paid", "void", "cancelled"].includes(String(r.status ?? "").toLowerCase()),
        ).length;
        if (!cancelled) setOutstandingPayments(unpaid);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  // ---- Studio Status derivation (business language, no infra terms) ---------
  const storageTone: StatusTone = useMemo(() => {
    if (paidGbTotal <= 0) return "inactive";
    if (storageLocked || availableGb <= 0) return "attention";
    if (paidGbTotal > 0 && availableGb / Math.max(1, paidGbTotal) < 0.1) return "attention";
    return "ready";
  }, [paidGbTotal, availableGb, storageLocked]);

  const uploadTone: StatusTone = paidGbTotal > 0 && availableGb > 0 && !storageLocked ? "ready" : "inactive";
  const billingTone: StatusTone = storageLocked
    ? "attention"
    : outstandingPayments > 0
    ? "attention"
    : paidGbTotal > 0
    ? "ready"
    : "inactive";
  const reviewTone: StatusTone = titleId ? "ready" : "inactive";
  const cloudTone: StatusTone =
    storageTone === "attention" || billingTone === "attention" ? "attention" : "ready";

  // ---- Today's Work (dynamic, up to 5) --------------------------------------
  const tasks: TaskAction[] = useMemo(() => {
    const out: TaskAction[] = [];
    if (!activeProject) {
      out.push({
        key: "create-production",
        label: "Create your first production",
        hint: "Every workflow starts here.",
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: onNewProduction,
        primary: true,
      });
      return out;
    }
    if (paidGbTotal <= 0) {
      out.push({
        key: "activate-storage",
        label: "Activate storage",
        hint: "Add storage to begin uploading media.",
        icon: <HardDrive className="w-4 h-4" />,
        onClick: onOpenStorage,
        primary: true,
      });
    }
    if (paidGbTotal > 0 && ingestCount === 0) {
      out.push({
        key: "import-media",
        label: "Import Media",
        hint: "Bring in footage, masters or reference files.",
        icon: <Upload className="w-4 h-4" />,
        onClick: onImportMedia,
        primary: true,
      });
    }
    if (ingestCount > 0) {
      out.push({
        key: "review-files",
        label: "Review Files",
        hint: "Open the production workspace to review imports.",
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: onOpenProduction,
      });
    }
    if (qcOpen > 0) {
      out.push({
        key: "quality-review",
        label: "Complete Quality Review",
        hint: `${qcOpen} open issue${qcOpen === 1 ? "" : "s"} awaiting resolution.`,
        icon: <ClipboardCheck className="w-4 h-4" />,
        onClick: onOpenProduction,
      });
    }
    if (memberCount <= 1) {
      out.push({
        key: "invite-team",
        label: "Invite Team",
        hint: "Bring collaborators into this production.",
        icon: <Users className="w-4 h-4" />,
        onClick: onInviteTeam,
      });
    }
    if (deliveriesPending > 0) {
      out.push({
        key: "prepare-delivery",
        label: "Prepare Delivery",
        hint: `${deliveriesPending} delivery task${deliveriesPending === 1 ? "" : "s"} pending.`,
        icon: <Package className="w-4 h-4" />,
        onClick: onOpenProduction,
      });
    }
    if (outstandingPayments > 0) {
      out.push({
        key: "settle-billing",
        label: "Settle Outstanding Payments",
        hint: `${outstandingPayments} invoice${outstandingPayments === 1 ? "" : "s"} awaiting payment.`,
        icon: <IndianRupee className="w-4 h-4" />,
        onClick: onOpenBilling,
      });
    }
    return out;
  }, [
    activeProject, paidGbTotal, ingestCount, qcOpen, memberCount,
    deliveriesPending, outstandingPayments,
    onNewProduction, onOpenStorage, onImportMedia, onOpenProduction,
    onInviteTeam, onOpenBilling,
  ]);

  // ---- Business Overview metrics -------------------------------------------
  const metrics: BusinessMetric[] = useMemo(() => [
    {
      key: "partners",
      label: "Active Partners",
      value: Math.max(0, memberCount - 1),
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      key: "deliveries",
      label: "Deliveries Pending",
      value: deliveriesPending,
      icon: <Truck className="w-4 h-4" />,
      tone: deliveriesPending > 0 ? "attention" : "neutral",
      onClick: onOpenProduction,
    },
    {
      key: "rights",
      label: "Rights Ready",
      value: rightsReady,
      icon: <ScrollText className="w-4 h-4" />,
    },
    {
      key: "requests",
      label: "Open Requests",
      value: openRequests,
      icon: <FileText className="w-4 h-4" />,
      tone: openRequests > 0 ? "attention" : "neutral",
    },
    {
      key: "payments",
      label: "Outstanding Payments",
      value: outstandingPayments,
      icon: <IndianRupee className="w-4 h-4" />,
      tone: outstandingPayments > 0 ? "attention" : "neutral",
      onClick: onOpenBilling,
    },
  ], [memberCount, deliveriesPending, rightsReady, openRequests, outstandingPayments, onOpenProduction, onOpenBilling]);

  return (
    <div className="space-y-10">
      {/* 1. Active Production (hero) */}
      {productionHeroSlot}

      {/* 2. Today's Work */}
      <TodaysWork tasks={tasks} />

      {/* 3. Studio Status */}
      <StudioStatus
        storage={storageTone}
        upload={uploadTone}
        billing={billingTone}
        review={reviewTone}
        cloud={cloudTone}
      />

      {/* 4. Business Overview */}
      <BusinessOverview metrics={metrics} />

      {/* 5. Recent Activity */}
      <section>
        <header className="mb-4">
          <h2 className="font-display text-lg tracking-tight">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Latest production activity.</p>
        </header>
        {activityPanelSlot}
      </section>

      {/* 6. Quick Actions */}
      <QuickActions
        onNewProduction={onNewProduction}
        onImportMedia={onImportMedia}
        onOpenProduction={onOpenProduction}
        onInviteTeam={onInviteTeam}
        hasActive={!!activeProject}
      />
    </div>
  );
}
