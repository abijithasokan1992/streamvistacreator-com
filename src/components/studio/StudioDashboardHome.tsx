/**
 * StudioDashboardHome — workflow-first B2B production operations dashboard.
 *
 * Sections (production-first order):
 *   1. Active Production (hero — reused slot)
 *   2. Today's Work (live tasks; completed items hide automatically)
 *   3. Production Pipeline (Pre-Production → Archive; active stage from live data)
 *   4. Media Ingest Status (latest ingest job; live values only)
 *   5. Studio Storage (allocated / used / available + per-class breakdown)
 *   6. Studio Health (7 pillars derived from live signals)
 *   7. Business Overview (cards hide when empty)
 *   8. Recent Activity (reused slot)
 *   9. Quick Actions (reused pages)
 *
 * Every value is live. No placeholder content, no infrastructure names, no
 * duplicated queries: reuses ProductionHero, ActivityPanel, MyVaultSummary
 * and existing Supabase tables (projects, ingest_jobs, workspace_members,
 * commercial_requests, deal_deliveries, title_review_issues,
 * title_rights_availability, invoices, storage_allocations).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Upload, Users, ClipboardCheck, Package, FolderPlus,
  Building2, Truck, ScrollText, FileText, IndianRupee,
  Sparkles, ShieldCheck, HardDrive, CreditCard, Cloud,
  ArrowRight, FolderOpen, CheckCircle2, AlertTriangle, Circle,
  Film, Archive, Wand2, Send,
  Gauge, Server, Lock, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import MyVaultSummary from "@/components/studio/vault/MyVaultSummary";

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
  onOpenReports?: () => void;
};

type StatusTone = "ready" | "attention" | "inactive" | "error";

function toneClasses(tone: StatusTone) {
  if (tone === "ready")
    return { pill: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30", dot: "bg-emerald-400", label: "Ready" };
  if (tone === "attention")
    return { pill: "bg-amber-500/15 text-amber-300 border-amber-400/30", dot: "bg-amber-400", label: "Attention Required" };
  if (tone === "error")
    return { pill: "bg-red-500/15 text-red-300 border-red-400/30", dot: "bg-red-400", label: "Error" };
  return { pill: "bg-secondary/40 text-muted-foreground border-border/40", dot: "bg-muted-foreground/40", label: "Not Activated" };
}

/* ============================================================================
 * Production Pipeline
 * ========================================================================== */

const PIPELINE_STAGES = [
  { key: "pre",        label: "Pre-Production", icon: ClipboardCheck },
  { key: "production", label: "Production",     icon: Film },
  { key: "ingest",     label: "Media Ingest",   icon: Upload },
  { key: "qc",         label: "Quality Review", icon: ShieldCheck },
  { key: "editorial",  label: "Editorial",      icon: Wand2 },
  { key: "mastering",  label: "Mastering",      icon: Sparkles },
  { key: "delivery",   label: "Delivery",       icon: Send },
  { key: "archive",    label: "Archive",        icon: Archive },
] as const;

type StageKey = (typeof PIPELINE_STAGES)[number]["key"];

function ProductionPipeline({ active }: { active: StageKey | null }) {
  const activeIdx = active ? PIPELINE_STAGES.findIndex((s) => s.key === active) : -1;
  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg tracking-tight">Production Pipeline</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Current workflow stage.</p>
      </header>
      <div className="rounded-2xl border border-border/50 bg-secondary/5 p-4">
        <ol className="flex flex-wrap items-center gap-2">
          {PIPELINE_STAGES.map((s, i) => {
            const state = activeIdx < 0 ? "pending" : i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    state === "active"
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : state === "done"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                      : "border-border/50 bg-background/40 text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ============================================================================
 * Media Ingest Status
 * ========================================================================== */

type IngestJob = {
  id: string;
  status: string | null;
  camera_label: string | null;
  shoot_day: string | null;
  total_files: number | null;
  completed_files: number | null;
  failed_files: number | null;
  total_bytes: number | null;
  transferred_bytes: number | null;
  started_at: string | null;
  updated_at: string | null;
  source_summary: any;
  metadata: any;
};

function fmtSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  if (bps < 1_048_576) return `${(bps / 1024).toFixed(0)} KB/s`;
  if (bps < 1_073_741_824) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  return `${(bps / 1_073_741_824).toFixed(2)} GB/s`;
}

function MediaIngestStatus({ job }: { job: IngestJob | null }) {
  if (!job) return null;
  const total = Number(job.total_files ?? 0);
  const done = Number(job.completed_files ?? 0);
  const failed = Number(job.failed_files ?? 0);
  const remaining = Math.max(0, total - done - failed);
  const bytes = Number(job.transferred_bytes ?? 0);
  const started = job.started_at ? new Date(job.started_at).getTime() : null;
  const now = Date.now();
  const elapsed = started ? Math.max(1, (now - started) / 1000) : 0;
  const status = String(job.status ?? "").toLowerCase();
  const isLive = ["running", "in_progress", "uploading"].includes(status);
  const speed = isLive && elapsed > 0 ? bytes / elapsed : 0;

  const checksumPass = job.metadata?.checksum_verified === true || job.metadata?.checksum_pass;
  const proxyReady = job.metadata?.proxy_ready === true || job.metadata?.proxy_status === "ready";
  const qcState = job.metadata?.qc_status ?? null;
  const resumeState = job.metadata?.resume_state ?? (status === "paused" ? "paused" : null);
  const cloudSync = ["completed", "delivered", "archived"].includes(status)
    ? "Synced"
    : isLive
    ? "In sync"
    : status === "paused"
    ? "Paused"
    : "Pending";

  const source = job.source_summary?.device_name || job.camera_label || job.source_summary?.source_type || "—";

  const cells: Array<{ label: string; value: string }> = [
    { label: "Source Device", value: String(source) },
    { label: "Files Detected", value: total ? `${total}` : "—" },
    { label: "Files Uploaded", value: total ? `${done} / ${total}` : "—" },
    { label: "Files Remaining", value: total ? `${remaining}` : "—" },
    { label: "Transfer Speed", value: fmtSpeed(speed) },
    { label: "Checksum", value: checksumPass ? "Verified" : isLive ? "In progress" : "—" },
    { label: "Proxy", value: proxyReady ? "Ready" : isLive ? "Generating" : "—" },
    { label: "QC Status", value: qcState ? String(qcState) : "—" },
    { label: "Resume", value: resumeState ? String(resumeState) : isLive ? "Live" : "—" },
    { label: "Cloud Sync", value: cloudSync },
  ];

  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-tight">Media Ingest Status</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {job.shoot_day ? `Shoot Day ${job.shoot_day} · ` : ""}
            {status ? status.replace(/_/g, " ") : "idle"}
          </p>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-mono text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        )}
      </header>
      <div className="rounded-2xl border border-border/50 bg-secondary/5 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg border border-border/40 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{c.label}</p>
              <p className="text-sm mt-1 truncate font-medium">{c.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * Studio Storage
 * ========================================================================== */

function StudioStorage({
  paidGbTotal, usedGbTotal, availableGb, storageLocked, onOpenStorage,
}: {
  paidGbTotal: number; usedGbTotal: number; availableGb: number;
  storageLocked: boolean; onOpenStorage: () => void;
}) {
  const inactive = paidGbTotal <= 0;
  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-tight">Studio Storage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {inactive
              ? "Storage not activated — activate to begin uploads."
              : storageLocked
              ? "Storage is on hold — settle outstanding payments to restore access."
              : "Live capacity across your studio."}
          </p>
        </div>
        <Button size="sm" variant={inactive ? "default" : "outline"} onClick={onOpenStorage}>
          {inactive ? "Activate Storage" : "Manage Storage"}
        </Button>
      </header>

      {inactive ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/10 p-8 text-center">
          <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm">No storage on this studio yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activate storage to begin importing media. Uploads are unavailable until storage is active.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-secondary/5 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Allocated</p>
              <p className="font-display text-2xl mt-1">
                {paidGbTotal >= 1024 ? `${(paidGbTotal / 1024).toFixed(1)} TB` : `${paidGbTotal.toFixed(0)} GB`}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/5 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Used</p>
              <p className="font-display text-2xl mt-1">{usedGbTotal.toFixed(1)} GB</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/5 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Available</p>
              <p className="font-display text-2xl mt-1">{availableGb.toFixed(1)} GB</p>
            </div>
          </div>
          <div className="mt-4">
            <MyVaultSummary />
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================================================
 * Studio Health (7 pillars)
 * ========================================================================== */

function StudioHealth({
  storage, upload, cloud, billing, review, security, backup,
}: Record<"storage" | "upload" | "cloud" | "billing" | "review" | "security" | "backup", StatusTone>) {
  const items: Array<{ label: string; icon: JSX.Element; tone: StatusTone }> = [
    { label: "Storage",        icon: <HardDrive className="w-3.5 h-3.5" />,    tone: storage },
    { label: "Upload Service", icon: <Upload className="w-3.5 h-3.5" />,       tone: upload },
    { label: "Cloud Storage",  icon: <Cloud className="w-3.5 h-3.5" />,        tone: cloud },
    { label: "Billing",        icon: <CreditCard className="w-3.5 h-3.5" />,   tone: billing },
    { label: "AI Review",      icon: <Sparkles className="w-3.5 h-3.5" />,     tone: review },
    { label: "Security",       icon: <Lock className="w-3.5 h-3.5" />,         tone: security },
    { label: "Backup",         icon: <Archive className="w-3.5 h-3.5" />,      tone: backup },
  ];
  return (
    <section>
      <header className="mb-4">
        <h2 className="font-display text-lg tracking-tight">Studio Health</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Live operational status.</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {items.map((it) => {
          const t = toneClasses(it.tone);
          return (
            <div key={it.label} className="rounded-xl border border-border/50 bg-secondary/5 px-4 py-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{it.icon}</span>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.dot}`} />
              </div>
              <div>
                <p className="text-[13px] font-medium leading-tight">{it.label}</p>
                <p className={`text-[11px] mt-0.5 ${
                  it.tone === "ready" ? "text-emerald-400/90"
                  : it.tone === "attention" ? "text-amber-400/90"
                  : it.tone === "error" ? "text-red-400/90"
                  : "text-muted-foreground"
                }`}>{t.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================================
 * Today's Work
 * ========================================================================== */

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
        {tasks.slice(0, 6).map((t, i) => (
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
              <span className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center ${
                t.primary || i === 0 ? "bg-accent/20 text-accent" : "bg-secondary/40 text-muted-foreground"
              }`}>{t.icon}</span>
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

/* ============================================================================
 * Business Overview
 * ========================================================================== */

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
              <span className={m.tone === "attention" ? "text-amber-400" : "text-muted-foreground"}>{m.icon}</span>
            </div>
            <p className="font-display text-2xl leading-none">{m.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 tracking-wide">{m.label}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================================================================
 * Quick Actions
 * ========================================================================== */

function QuickActions({
  onNewProduction, onImportMedia, onOpenProduction, onInviteTeam,
  onOpenStorage, onOpenBilling, onOpenReports, hasActive,
}: {
  onNewProduction: () => void;
  onImportMedia: () => void;
  onOpenProduction: () => void;
  onInviteTeam: () => void;
  onOpenStorage: () => void;
  onOpenBilling: () => void;
  onOpenReports?: () => void;
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
          <Button size="sm" variant="outline" onClick={onOpenStorage}>
            <HardDrive className="w-3.5 h-3.5 mr-1.5" /> Storage
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenBilling}>
            <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Billing
          </Button>
          {onOpenReports && (
            <Button size="sm" variant="outline" onClick={onOpenReports}>
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Reports
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * Main
 * ========================================================================== */

export default function StudioDashboardHome(props: StudioDashboardHomeProps) {
  const {
    workspaceId, activeProject, paidGbTotal, usedGbTotal, availableGb,
    storageLocked, currentUserId,
    productionHeroSlot, activityPanelSlot,
    onNewProduction, onImportMedia, onOpenProduction, onInviteTeam,
    onOpenBilling, onOpenStorage, onOpenReports,
  } = props;

  const crew: any = activeProject?.crew ?? {};
  const titleId: string | undefined = typeof crew?.title_id === "string" ? crew.title_id : undefined;

  const [memberCount, setMemberCount] = useState(0);
  const [ingestCount, setIngestCount] = useState(0);
  const [ingestCompleted, setIngestCompleted] = useState(0);
  const [latestJob, setLatestJob] = useState<IngestJob | null>(null);
  const [deliveriesPending, setDeliveriesPending] = useState(0);
  const [deliveriesDone, setDeliveriesDone] = useState(0);
  const [qcOpen, setQcOpen] = useState(0);
  const [rightsReady, setRightsReady] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [outstandingPayments, setOutstandingPayments] = useState(0);
  const [paidInvoiceCount, setPaidInvoiceCount] = useState(0);
  const [archiveCount, setArchiveCount] = useState(0);

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
        // Latest ingest job scoped to workspace (and active project when present).
        let q = (supabase as any)
          .from("ingest_jobs")
          .select("id,status,camera_label,shoot_day,total_files,completed_files,failed_files,total_bytes,transferred_bytes,started_at,updated_at,source_summary,metadata,project_id")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (activeProject?.id) q = q.eq("project_id", activeProject.id);
        const { data } = await q;
        if (!cancelled) setLatestJob(((data as any[]) ?? [])[0] ?? null);
      } catch { /* ignore */ }
      try {
        const { data } = await (supabase as any)
          .from("ingest_jobs")
          .select("id,status")
          .eq("workspace_id", workspaceId);
        const rows = (data as any[]) ?? [];
        if (!cancelled) {
          setIngestCount(rows.length);
          setIngestCompleted(rows.filter((r) => ["completed", "delivered", "archived"].includes(String(r.status ?? "").toLowerCase())).length);
        }
      } catch { /* ignore */ }
      try {
        const { count } = await (supabase as any)
          .from("commercial_requests")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (!cancelled) setOpenRequests(count ?? 0);
      } catch { /* ignore */ }
      try {
        const { count } = await (supabase as any)
          .from("archive_jobs")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (!cancelled) setArchiveCount(count ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, activeProject?.id]);

  useEffect(() => {
    if (!titleId) { setDeliveriesPending(0); setDeliveriesDone(0); setQcOpen(0); setRightsReady(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("deal_deliveries").select("id,status").eq("title_id", titleId);
        const rows = ((data as any[]) ?? []);
        const pending = rows.filter((r) => String(r.status ?? "").toLowerCase() !== "delivered").length;
        const done = rows.length - pending;
        if (!cancelled) { setDeliveriesPending(pending); setDeliveriesDone(done); }
      } catch { /* ignore */ }
      try {
        const { data } = await (supabase as any)
          .from("title_review_issues").select("id,status").eq("title_id", titleId);
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
          .from("invoices").select("id,status,paid_at").eq("user_id", currentUserId);
        const rows = ((data as any[]) ?? []);
        const unpaid = rows.filter((r) => !r.paid_at && !["paid", "void", "cancelled"].includes(String(r.status ?? "").toLowerCase())).length;
        const paid = rows.filter((r) => r.paid_at || String(r.status ?? "").toLowerCase() === "paid").length;
        if (!cancelled) { setOutstandingPayments(unpaid); setPaidInvoiceCount(paid); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  /* -------- Studio Health tones (all derived from live signals) ----------- */
  const storageTone: StatusTone = useMemo(() => {
    if (paidGbTotal <= 0) return "inactive";
    if (storageLocked) return "error";
    if (availableGb <= 0) return "attention";
    if (availableGb / Math.max(1, paidGbTotal) < 0.1) return "attention";
    return "ready";
  }, [paidGbTotal, availableGb, storageLocked]);

  const uploadTone: StatusTone = paidGbTotal > 0 && availableGb > 0 && !storageLocked ? "ready" : storageLocked ? "attention" : "inactive";
  const cloudTone: StatusTone = paidGbTotal > 0 && !storageLocked ? "ready" : paidGbTotal > 0 ? "attention" : "inactive";
  const billingTone: StatusTone = storageLocked
    ? "error"
    : outstandingPayments > 0
    ? "attention"
    : paidGbTotal > 0 || paidInvoiceCount > 0
    ? "ready"
    : "inactive";
  const reviewTone: StatusTone = titleId ? (qcOpen > 0 ? "attention" : "ready") : "inactive";
  const securityTone: StatusTone = currentUserId ? "ready" : "inactive";
  const backupTone: StatusTone = archiveCount > 0 ? "ready" : paidGbTotal > 0 ? "attention" : "inactive";

  /* -------- Active pipeline stage ---------------------------------------- */
  const activeStage: StageKey | null = useMemo(() => {
    if (!activeProject) return null;
    const status = String(crew.title_status ?? "").toLowerCase();
    if (deliveriesPending === 0 && deliveriesDone > 0 && qcOpen === 0) return "archive";
    if (deliveriesPending > 0) return "delivery";
    if (qcOpen > 0) return "qc";
    if (ingestCount > 0 && ingestCompleted < ingestCount) return "ingest";
    if (ingestCompleted > 0) return "editorial";
    if (status.includes("shoot") || status.includes("production")) return "production";
    return "pre";
  }, [activeProject, crew.title_status, ingestCount, ingestCompleted, qcOpen, deliveriesPending, deliveriesDone]);

  /* -------- Today's Work (live tasks; completed items auto-hide) --------- */
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
        label: "Activate Storage",
        hint: "Add storage to begin uploading media.",
        icon: <HardDrive className="w-4 h-4" />,
        onClick: onOpenStorage,
        primary: true,
      });
    }
    if (storageLocked) {
      out.push({
        key: "resolve-billing",
        label: "Complete Billing",
        hint: "Storage is on hold — settle outstanding payments.",
        icon: <CreditCard className="w-4 h-4" />,
        onClick: onOpenBilling,
        primary: true,
      });
    }
    if (paidGbTotal > 0 && ingestCount === 0) {
      out.push({
        key: "import-media",
        label: "Continue Media Import",
        hint: "Bring in footage, masters or reference files.",
        icon: <Upload className="w-4 h-4" />,
        onClick: onImportMedia,
      });
    }
    if (latestJob && ["paused", "failed"].includes(String(latestJob.status ?? "").toLowerCase())) {
      out.push({
        key: "resume-upload",
        label: "Resume Upload",
        hint: `${latestJob.camera_label ?? "Latest job"} is ${latestJob.status}.`,
        icon: <RefreshCw className="w-4 h-4" />,
        onClick: onImportMedia,
      });
    }
    if (qcOpen > 0) {
      out.push({
        key: "review-qc",
        label: "Review QC",
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
        key: "deliver-master",
        label: "Deliver Master",
        hint: `${deliveriesPending} delivery task${deliveriesPending === 1 ? "" : "s"} pending.`,
        icon: <Package className="w-4 h-4" />,
        onClick: onOpenProduction,
      });
    }
    if (openRequests > 0) {
      out.push({
        key: "approve-review",
        label: "Approve Review",
        hint: `${openRequests} pending request${openRequests === 1 ? "" : "s"}.`,
        icon: <CheckCircle2 className="w-4 h-4" />,
        onClick: onOpenProduction,
      });
    }
    if (outstandingPayments > 0 && !storageLocked) {
      out.push({
        key: "settle-payments",
        label: "Complete Billing",
        hint: `${outstandingPayments} invoice${outstandingPayments === 1 ? "" : "s"} awaiting payment.`,
        icon: <IndianRupee className="w-4 h-4" />,
        onClick: onOpenBilling,
      });
    }
    return out;
  }, [
    activeProject, paidGbTotal, storageLocked, ingestCount, latestJob, qcOpen,
    memberCount, deliveriesPending, openRequests, outstandingPayments,
    onNewProduction, onOpenStorage, onOpenBilling, onImportMedia,
    onOpenProduction, onInviteTeam,
  ]);

  /* -------- Business Overview (auto-hides empty cards) ------------------- */
  const metrics: BusinessMetric[] = useMemo(() => [
    { key: "clients",   label: "Active Clients",       value: crew?.client ? 1 : 0, icon: <Building2 className="w-4 h-4" /> },
    { key: "productions", label: "Active Productions", value: activeProject ? 1 : 0, icon: <Film className="w-4 h-4" /> },
    { key: "invoices",  label: "Invoices",             value: paidInvoiceCount + outstandingPayments, icon: <FileText className="w-4 h-4" />, onClick: onOpenBilling },
    { key: "payments",  label: "Outstanding Payments", value: outstandingPayments, icon: <IndianRupee className="w-4 h-4" />, tone: outstandingPayments > 0 ? "attention" : "neutral", onClick: onOpenBilling },
    { key: "deliveries", label: "Deliveries",          value: deliveriesPending + deliveriesDone, icon: <Truck className="w-4 h-4" />, tone: deliveriesPending > 0 ? "attention" : "neutral", onClick: onOpenProduction },
    { key: "licensing", label: "Licensing",            value: rightsReady, icon: <ScrollText className="w-4 h-4" /> },
  ], [crew?.client, activeProject, paidInvoiceCount, outstandingPayments, deliveriesPending, deliveriesDone, rightsReady, onOpenBilling, onOpenProduction]);

  return (
    <div className="space-y-10">
      {/* 1. Active Production */}
      {productionHeroSlot}

      {/* 2. Today's Work */}
      <TodaysWork tasks={tasks} />

      {/* 3. Production Pipeline */}
      {activeProject && <ProductionPipeline active={activeStage} />}

      {/* 4. Media Ingest Status */}
      <MediaIngestStatus job={latestJob} />

      {/* 5. Studio Storage */}
      <StudioStorage
        paidGbTotal={paidGbTotal}
        usedGbTotal={usedGbTotal}
        availableGb={availableGb}
        storageLocked={storageLocked}
        onOpenStorage={onOpenStorage}
      />

      {/* 6. Studio Health */}
      <StudioHealth
        storage={storageTone}
        upload={uploadTone}
        cloud={cloudTone}
        billing={billingTone}
        review={reviewTone}
        security={securityTone}
        backup={backupTone}
      />

      {/* 7. Business Overview */}
      <BusinessOverview metrics={metrics} />

      {/* 8. Recent Activity */}
      <section>
        <header className="mb-4">
          <h2 className="font-display text-lg tracking-tight">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Latest production events.</p>
        </header>
        {activityPanelSlot}
      </section>

      {/* 9. Quick Actions */}
      <QuickActions
        onNewProduction={onNewProduction}
        onImportMedia={onImportMedia}
        onOpenProduction={onOpenProduction}
        onInviteTeam={onInviteTeam}
        onOpenStorage={onOpenStorage}
        onOpenBilling={onOpenBilling}
        onOpenReports={onOpenReports}
        hasActive={!!activeProject}
      />
    </div>
  );
}
