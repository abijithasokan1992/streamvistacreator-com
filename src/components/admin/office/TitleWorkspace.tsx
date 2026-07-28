/**
 * TitleWorkspace — enterprise-grade content-ops surface for one title.
 *
 * Replaces the small TitleInspectionDrawer. Every tab binds to data that
 * already exists behind current RLS — no schema changes, no invented data.
 *
 * Reuse-first: QC/Legal, Buyer Mapping, Marketplace and Deals tabs mount
 * the existing admin consoles as-is; new tabs only add read-only views
 * over tables the app already queries elsewhere.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Info,
  Film,
  ImageIcon,
  ShieldCheck,
  Scale,
  Landmark,
  Users,
  Store,
  Handshake,
  FileText,
  Wallet,
  History,
  CheckCircle2,
  RotateCcw,
  Rocket,
  Search,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { OFFICE } from "@/lib/admin/labels";

// Reused, unchanged consoles
import QCLegalValidationSurface from "@/components/admin/QCLegalValidationSurface";
import TitleCommercialOpsConsole from "@/components/admin/TitleCommercialOpsConsole";
import DealOperationsConsole from "@/components/admin/DealOperationsConsole";

/* ------------------------------ Types ------------------------------ */

type TitleRow = {
  id: string;
  title: string | null;
  synopsis: string | null;
  language: string | null;
  genre: string | null;
  duration_minutes: number | null;
  status: string | null;
  qc_status: string | null;
  legal_clearance: string | null;
  owner_user_id: string;
  workspace_id: string | null;
  metadata: Record<string, unknown> | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  category: string;
  is_primary: boolean;
  upload_id: string;
};

type Upload = {
  id: string;
  file_name: string;
  mime_type: string | null;
  par_url: string | null;
};

type RightRow = {
  id: string;
  right_category: string;
  territory: string;
  language: string;
  exclusivity: string;
  status: string;
  term_start: string | null;
  term_end: string | null;
  notes: string | null;
};

type RevenueLine = {
  id: string;
  occurred_on: string;
  territory: string | null;
  channel: string | null;
  units: number | null;
  gross_amount_paise: number | null;
  net_amount_paise: number | null;
  currency: string | null;
};

type HistoryEntry = {
  kind: string;
  occurred_at: string;
  actor_email: string | null;
  from_status: string | null;
  to_status: string | null;
  action: string | null;
  note: string | null;
};

type TabId =
  | "overview"
  | "metadata"
  | "media"
  | "qc"
  | "legal"
  | "rights"
  | "buyers"
  | "marketplace"
  | "deals"
  | "documents"
  | "revenue"
  | "audit";

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview",    label: "Overview",        icon: Info },
  { id: "metadata",    label: "Metadata",        icon: FileText },
  { id: "media",       label: "Artwork & Media", icon: ImageIcon },
  { id: "qc",          label: "Technical QC",    icon: ShieldCheck },
  { id: "legal",       label: "Legal",           icon: Scale },
  { id: "rights",      label: "Rights",          icon: Landmark },
  { id: "buyers",      label: "Buyer Mapping",   icon: Users },
  { id: "marketplace", label: "Marketplace",     icon: Store },
  { id: "deals",       label: "Deals",           icon: Handshake },
  { id: "documents",   label: "Documents",       icon: FileText },
  { id: "revenue",     label: "Revenue",         icon: Wallet },
  { id: "audit",       label: "Audit Timeline",  icon: History },
];

/* ------------------------------ Shell ------------------------------ */

export function TitleWorkspace({
  titleId,
  open,
  onOpenChange,
  canDecide = false,
}: {
  titleId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canDecide?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState<TitleRow | null>(null);
  const [assets, setAssets] = useState<Array<AssetRow & { upload: Upload | null }>>([]);
  const [acting, setActing] = useState<null | "approve" | "sendback" | "ready">(null);
  const [reason, setReason] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Load core title + assets whenever the sheet opens.
  useEffect(() => {
    if (!open || !titleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: t }, { data: a }] = await Promise.all([
          supabase
            .from("content_titles")
            .select(
              "id,title,synopsis,language,genre,duration_minutes,status,qc_status,legal_clearance,owner_user_id,workspace_id,metadata,submitted_at,approved_at,published_at,created_at,updated_at",
            )
            .eq("id", titleId)
            .maybeSingle(),
          supabase
            .from("title_assets")
            .select("id,category,is_primary,upload_id")
            .eq("title_id", titleId)
            .order("is_primary", { ascending: false }),
        ]);
        if (cancelled) return;
        setTitle((t as TitleRow) ?? null);
        const ids = (a ?? []).map((x: any) => x.upload_id).filter(Boolean);
        let uploads: Upload[] = [];
        if (ids.length) {
          const { data: u } = await supabase
            .from("recent_uploads")
            .select("id,file_name,mime_type,par_url")
            .in("id", ids);
          uploads = (u as Upload[]) ?? [];
        }
        setAssets((a ?? []).map((x: any) => ({ ...x, upload: uploads.find((u) => u.id === x.upload_id) ?? null })));
      } catch {
        toast.error("Couldn't load this title.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, titleId]);

  // Keyboard: Esc close, [ ] tab nav, Ctrl/Cmd+K focus search.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.target && ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA")) return;
      if (e.key === "]" || e.key === "[") {
        const idx = TABS.findIndex((t) => t.id === tab);
        const next = e.key === "]" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
        setTab(TABS[next].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tab]);

  const runAction = async (kind: "approve" | "sendback" | "ready") => {
    if (!title) return;
    if (kind === "sendback" && reason.trim().length < 5) {
      toast.error("Add a short reason so the creator knows what to fix.");
      return;
    }
    setActing(kind);
    try {
      const patch: Record<string, any> = {};
      if (kind === "approve") { patch.status = "approved"; patch.approved_at = new Date().toISOString(); }
      if (kind === "sendback") { patch.status = "changes_requested"; }
      if (kind === "ready") { patch.status = "ready_for_distribution"; }
      const { error } = await (supabase.from("content_titles") as any).update(patch).eq("id", title.id);
      if (error) throw error;
      toast.success(kind === "approve" ? "Approved" : kind === "sendback" ? "Sent back to creator" : "Marked ready");
      setTitle((prev) => (prev ? { ...prev, status: patch.status } : prev));
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed. Nothing was saved.");
    } finally {
      setActing(null);
    }
  };

  const poster = assets.find((a) => a.category === "poster") ?? assets.find((a) => (a.upload?.mime_type ?? "").startsWith("image/"));
  const banner = assets.find((a) => a.category === "banner" || a.category === "artwork");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-none sm:w-[95vw] lg:w-[92vw] xl:w-[1400px] p-0 overflow-hidden flex flex-col"
      >
        <WorkspaceHeader
          title={title}
          posterUrl={poster?.upload?.par_url ?? null}
          bannerUrl={banner?.upload?.par_url ?? null}
          onClose={() => onOpenChange(false)}
          searchRef={searchRef}
        />

        <WorkspaceActionBar
          canDecide={canDecide}
          disabled={!title || !!acting}
          acting={acting}
          reason={reason}
          setReason={setReason}
          onApprove={() => runAction("approve")}
          onSendBack={() => runAction("sendback")}
          onMarkReady={() => runAction("ready")}
          onGoTab={setTab}
        />

        <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr]">
          <nav className="border-r border-border/40 bg-secondary/[0.04] overflow-y-auto py-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors border-l-2",
                    active
                      ? "bg-background text-foreground border-primary font-medium"
                      : "border-transparent text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
            <div className="px-4 pt-4 text-[10px] uppercase tracking-wider text-muted-foreground/60">
              [ ] switch tabs · ⌘K search
            </div>
          </nav>

          <div className="overflow-y-auto">
            {loading ? (
              <div className="py-24 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !title ? (
              <EmptyState message="Title not found or no longer visible to your role." />
            ) : (
              <div className="p-6">
                {tab === "overview"    && <OverviewTab title={title} assets={assets} />}
                {tab === "metadata"    && <MetadataTab title={title} />}
                {tab === "media"       && <MediaTab assets={assets} />}
                {tab === "qc"          && <EmbeddedConsole label="Technical QC"><QCLegalValidationSurface initialPanel="qc" /></EmbeddedConsole>}
                {tab === "legal"       && <EmbeddedConsole label="Legal review"><QCLegalValidationSurface initialPanel="legal" /></EmbeddedConsole>}
                {tab === "rights"      && <RightsTab titleId={title.id} />}
                {tab === "buyers"      && <BuyerMappingTab titleId={title.id} titleName={title.title} />}
                {tab === "marketplace" && <EmbeddedConsole label="Marketplace commercial state"><TitleCommercialOpsConsole /></EmbeddedConsole>}
                {tab === "deals"       && <EmbeddedConsole label="Deal operations"><DealOperationsConsole /></EmbeddedConsole>}
                {tab === "documents"   && <DocumentsTab assets={assets} />}
                {tab === "revenue"     && <RevenueTab titleId={title.id} />}
                {tab === "audit"       && <AuditTab titleId={title.id} />}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TitleWorkspace;

/* ---------------------------- Header ------------------------------- */

function WorkspaceHeader({
  title,
  posterUrl,
  bannerUrl,
  onClose,
  searchRef,
}: {
  title: TitleRow | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  onClose: () => void;
  searchRef: React.RefObject<HTMLInputElement>;
}) {
  const original = (title?.metadata as any)?.original_title as string | undefined;
  const creator = (title?.metadata as any)?.creator_name as string | undefined;
  const production = (title?.metadata as any)?.production_company as string | undefined;
  const commercial = (title?.metadata as any)?.commercial_status as string | undefined;
  const distribution = (title?.metadata as any)?.distribution_status as string | undefined;
  const rights = (title?.metadata as any)?.rights_availability as string | undefined;
  const revenue = (title?.metadata as any)?.revenue_status as string | undefined;

  return (
    <div className="relative border-b border-border/40 bg-card">
      {bannerUrl ? (
        <div
          className="absolute inset-0 opacity-[0.12] bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerUrl})` }}
          aria-hidden
        />
      ) : null}
      <div className="relative flex items-start gap-4 p-4 md:p-5">
        <div className="w-16 h-24 md:w-20 md:h-28 rounded-md overflow-hidden bg-secondary/40 border border-border/40 shrink-0">
          {posterUrl ? (
            <img src={posterUrl} alt="Poster" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">No poster</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl md:text-2xl leading-tight truncate">
                {title?.title ?? "Untitled"}
              </h2>
              {original && (
                <div className="text-xs text-muted-foreground truncate">Original: {original}</div>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                {creator && <span>Creator: <span className="text-foreground">{creator}</span></span>}
                {production && <span>Production: <span className="text-foreground">{production}</span></span>}
                {title?.created_at && <span>Created {new Date(title.created_at).toLocaleDateString()}</span>}
                {title?.updated_at && <span>Updated {new Date(title.updated_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative hidden md:block">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  placeholder="Search this title (⌘K)"
                  className="h-8 pl-7 pr-2 rounded-md bg-background border border-border/60 text-xs w-56"
                  onKeyDown={(e) => e.key === "Escape" && (e.currentTarget as HTMLInputElement).blur()}
                />
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 grid place-items-center rounded-md hover:bg-secondary/40 text-muted-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusPill label="Workflow" value={title?.status} tone="primary" />
            <StatusPill label="QC" value={title?.qc_status} />
            <StatusPill label="Legal" value={title?.legal_clearance} />
            {commercial && <StatusPill label="Marketplace" value={commercial} />}
            {distribution && <StatusPill label="Distribution" value={distribution} />}
            {rights && <StatusPill label="Rights" value={rights} />}
            {revenue && <StatusPill label="Revenue" value={revenue} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value?: string | null; tone?: "primary" }) {
  const v = value ?? "—";
  const toneCls =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : /pass|approved|ready|available|published|paid|delivered/i.test(v)
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : /fail|reject|blocked|sold/i.test(v)
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : /pending|review|draft|hold/i.test(v)
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : "bg-secondary/50 text-muted-foreground border-border/50";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", toneCls)}>
      <span className="uppercase tracking-wider opacity-70">{label}</span>
      <span>{v}</span>
    </span>
  );
}

/* --------------------------- Action bar --------------------------- */

function WorkspaceActionBar({
  canDecide,
  disabled,
  acting,
  reason,
  setReason,
  onApprove,
  onSendBack,
  onMarkReady,
  onGoTab,
}: {
  canDecide: boolean;
  disabled: boolean;
  acting: null | "approve" | "sendback" | "ready";
  reason: string;
  setReason: (v: string) => void;
  onApprove: () => void;
  onSendBack: () => void;
  onMarkReady: () => void;
  onGoTab: (t: TabId) => void;
}) {
  return (
    <div className="border-b border-border/40 bg-background/80 backdrop-blur px-4 md:px-5 py-2.5 flex flex-wrap items-center gap-2">
      {canDecide ? (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required for Send Back)"
            className="h-9 px-3 rounded-md border border-border/60 bg-background text-xs flex-1 min-w-[180px] max-w-md"
          />
          <ActBtn onClick={onApprove} tone="success" disabled={disabled}>
            {acting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {OFFICE.approve}
          </ActBtn>
          <ActBtn onClick={onSendBack} tone="ghost" disabled={disabled}>
            {acting === "sendback" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} {OFFICE.sendBack}
          </ActBtn>
          <ActBtn onClick={onMarkReady} tone="primary" disabled={disabled}>
            {acting === "ready" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} {OFFICE.markReady}
          </ActBtn>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Read-only view. Contact an admin to take a decision.</span>
      )}
      <div className="ml-auto flex flex-wrap gap-1.5">
        <ShortcutBtn onClick={() => onGoTab("qc")}>Pass QC</ShortcutBtn>
        <ShortcutBtn onClick={() => onGoTab("legal")}>Pass Legal</ShortcutBtn>
        <ShortcutBtn onClick={() => onGoTab("marketplace")}>Publish to Marketplace</ShortcutBtn>
        <ShortcutBtn onClick={() => onGoTab("deals")}>Create Buyer Deal</ShortcutBtn>
      </div>
    </div>
  );
}

function ActBtn({
  onClick, children, tone, disabled,
}: { onClick: () => void; children: React.ReactNode; tone: "success" | "ghost" | "primary"; disabled?: boolean }) {
  const cls =
    tone === "success" ? "bg-emerald-600 text-white hover:bg-emerald-700"
    : tone === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
    : "border border-border text-foreground hover:bg-secondary/50";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm disabled:opacity-60", cls)}
    >
      {children}
    </button>
  );
}

function ShortcutBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
    >
      {children}
    </button>
  );
}

/* ------------------------------ Tabs ------------------------------ */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md text-center text-sm text-muted-foreground py-16">{message}</div>
  );
}

function OverviewTab({ title, assets }: { title: TitleRow; assets: Array<AssetRow & { upload: Upload | null }> }) {
  const md = (title.metadata ?? {}) as any;
  const hasPoster = assets.some((a) => a.category === "poster");
  const hasTrailer = assets.some((a) => a.category === "trailer");
  const hasMaster = assets.some((a) => a.category === "feature_film");
  const warnings: string[] = [];
  if (!hasPoster) warnings.push("Poster missing");
  if (!hasTrailer) warnings.push("Trailer missing");
  if (!hasMaster) warnings.push("Master delivery missing");
  if (!title.synopsis) warnings.push("Synopsis missing");

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title="Summary" className="md:col-span-2">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
          <Field label="Runtime" value={title.duration_minutes ? `${title.duration_minutes} min` : null} />
          <Field label="Language" value={title.language} />
          <Field label="Genre" value={title.genre} />
          <Field label="Year" value={md.release_year ?? null} />
          <Field label="Country" value={md.country ?? null} />
          <Field label="Creator" value={md.creator_name ?? null} />
          <Field label="Production" value={md.production_company ?? null} />
          <Field label="Submitted" value={title.submitted_at ? new Date(title.submitted_at).toLocaleDateString() : null} />
          <Field label="Approved" value={title.approved_at ? new Date(title.approved_at).toLocaleDateString() : null} />
        </dl>
        {title.synopsis && (
          <p className="mt-4 text-sm text-muted-foreground line-clamp-6">{title.synopsis}</p>
        )}
      </Card>

      <Card title="Health">
        {warnings.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">No gaps detected in submitted materials.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {warnings.map((w) => (
              <li key={w} className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {w}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {Array.isArray(md.cast) && md.cast.length > 0 && (
        <Card title="Cast" className="md:col-span-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {md.cast.map((c: any, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-secondary/40">{typeof c === "string" ? c : c?.name ?? ""}</span>
            ))}
          </div>
        </Card>
      )}

      {Array.isArray(md.crew) && md.crew.length > 0 && (
        <Card title="Crew">
          <ul className="text-xs space-y-1">
            {md.crew.slice(0, 12).map((c: any, i: number) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted-foreground truncate">{c?.role ?? "—"}</span>
                <span className="truncate">{typeof c === "string" ? c : c?.name ?? ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MetadataTab({ title }: { title: TitleRow }) {
  const md = (title.metadata ?? {}) as Record<string, unknown>;
  const rows: Array<[string, unknown]> = [
    ["Title", title.title],
    ["Synopsis", title.synopsis],
    ["Language", title.language],
    ["Genre", title.genre],
    ["Duration (min)", title.duration_minutes],
    ["Status", title.status],
    ["QC status", title.qc_status],
    ["Legal clearance", title.legal_clearance],
    ...Object.entries(md).map<[string, unknown]>(([k, v]) => [k, v]),
  ];
  return (
    <Card title="All metadata (read-only)">
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border/30 py-1.5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
            <span className="text-right truncate max-w-[60%]">
              {v == null || v === "" ? <span className="text-muted-foreground">—</span> : typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Inline editing is a Phase 2 deliverable — writes will go through the existing lock-aware update path.
      </p>
    </Card>
  );
}

function MediaTab({ assets }: { assets: Array<AssetRow & { upload: Upload | null }> }) {
  const isVideo = (mime?: string | null) => (mime ?? "").startsWith("video/");
  const isImage = (mime?: string | null) => (mime ?? "").startsWith("image/");
  const preview = assets.find((a) => a.category === "trailer" && isVideo(a.upload?.mime_type))
    ?? assets.find((a) => a.category === "feature_film" && isVideo(a.upload?.mime_type))
    ?? assets.find((a) => isVideo(a.upload?.mime_type));
  const artworks = assets.filter((a) => a.category === "poster" || a.category === "artwork" || a.category === "banner" || isImage(a.upload?.mime_type));
  const subs = assets.filter((a) => a.category === "subtitle" || a.category === "closed_caption");
  const audio = assets.filter((a) => a.category === "audio_track" || a.category === "dub");
  const masters = assets.filter((a) => a.category === "feature_film" || a.category === "master");

  return (
    <div className="space-y-6">
      <Card title="Preview">
        {preview?.upload?.par_url ? (
          <video controls src={preview.upload.par_url} className="w-full rounded-lg border border-border/40 bg-black max-h-[60vh]" />
        ) : (
          <EmptyState message="No trailer or master available for preview." />
        )}
      </Card>

      <Card title="Artwork & gallery">
        {artworks.length === 0 ? (
          <EmptyState message="No poster, banner or gallery images uploaded." />
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {artworks.map((a) => (
              <a
                key={a.id}
                href={a.upload?.par_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block aspect-[2/3] rounded-md overflow-hidden border border-border/40 bg-secondary/20"
              >
                {a.upload?.par_url ? (
                  <img src={a.upload.par_url} alt={a.category} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">{a.category}</div>
                )}
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <FileList title="Master delivery" items={masters} />
        <FileList title="Subtitles" items={subs} />
        <FileList title="Audio tracks" items={audio} />
      </div>
    </div>
  );
}

function FileList({ title, items }: { title: string; items: Array<AssetRow & { upload: Upload | null }> }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None on file.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-sm rounded-md border border-border/40 px-3 py-1.5">
              <span className="truncate">{f.upload?.file_name ?? f.category}</span>
              {f.upload?.par_url ? (
                <a href={f.upload.par_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DocumentsTab({ assets }: { assets: Array<AssetRow & { upload: Upload | null }> }) {
  const docs = assets.filter((a) =>
    a.category === "censor_certificate" ||
    a.category === "ownership_documents" ||
    a.category === "legal" ||
    a.category === "contract" ||
    (a.upload?.mime_type ?? "").includes("pdf"),
  );
  return (
    <Card title="Contracts, certificates & delivery documents">
      {docs.length === 0 ? (
        <EmptyState message="No contracts or certificates on file." />
      ) : (
        <ul className="divide-y divide-border/40">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{d.upload?.file_name ?? d.category}</div>
                <div className="text-[11px] text-muted-foreground">{d.category}</div>
              </div>
              {d.upload?.par_url ? (
                <a href={d.upload.par_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RightsTab({ titleId }: { titleId: string }) {
  const [rows, setRows] = useState<RightRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("title_rights_availability")
        .select("id,right_category,territory,language,exclusivity,status,term_start,term_end,notes")
        .eq("title_id", titleId)
        .order("right_category", { ascending: true });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows((data as RightRow[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [titleId]);
  if (err) return <EmptyState message={`Rights unavailable: ${err}`} />;
  if (!rows) return <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <EmptyState message="No rights records have been added for this title yet." />;
  return (
    <Card title="Rights availability">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider">
            <tr className="border-b border-border/40">
              <Th>Category</Th><Th>Territory</Th><Th>Language</Th><Th>Exclusivity</Th><Th>Status</Th><Th>Term</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/20">
                <Td>{r.right_category}</Td>
                <Td>{r.territory}</Td>
                <Td>{r.language}</Td>
                <Td>{r.exclusivity}</Td>
                <Td><StatusPill label="" value={r.status} /></Td>
                <Td className="text-xs text-muted-foreground">
                  {r.term_start ? new Date(r.term_start).toLocaleDateString() : "—"} → {r.term_end ? new Date(r.term_end).toLocaleDateString() : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BuyerMappingTab({ titleId, titleName }: { titleId: string; titleName: string | null }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("partner_title_matches")
        .select("id,partner_id,match_score,match_reason,status,created_at,updated_at")
        .eq("title_id", titleId)
        .order("match_score", { ascending: false });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [titleId]);
  return (
    <div className="space-y-4">
      <Card title={`Buyers mapped to ${titleName ?? "this title"}`}>
        {err ? (
          <EmptyState message={`Buyer matches unavailable: ${err}`} />
        ) : !rows ? (
          <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <EmptyState message="No buyers mapped yet. Use the Buyer Mapping room to assign partners." />
        ) : (
          <ul className="divide-y divide-border/40 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{r.partner_id}</div>
                  <div className="text-[11px] text-muted-foreground">{r.match_reason ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs tabular-nums">{Math.round((r.match_score ?? 0) * 100)}%</span>
                  <StatusPill label="" value={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Bulk actions and auto-suggestions are Phase 2 deliverables. Existing Buyer Mapping room remains authoritative for assignments.
      </p>
    </div>
  );
}

function RevenueTab({ titleId }: { titleId: string }) {
  const [rows, setRows] = useState<RevenueLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("revenue_lines")
        .select("id,occurred_on,territory,channel,units,gross_amount_paise,net_amount_paise,currency")
        .eq("title_id", titleId)
        .order("occurred_on", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows((data as RevenueLine[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [titleId]);
  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      gross: list.reduce((s, r) => s + (r.gross_amount_paise ?? 0), 0),
      net: list.reduce((s, r) => s + (r.net_amount_paise ?? 0), 0),
      count: list.length,
    };
  }, [rows]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Statements" value={totals.count.toString()} />
        <MiniStat label="Gross (₹)" value={(totals.gross / 100).toLocaleString("en-IN")} />
        <MiniStat label="Net (₹)" value={(totals.net / 100).toLocaleString("en-IN")} />
      </div>
      <Card title="Revenue lines">
        {err ? (
          <EmptyState message={`Revenue unavailable: ${err}`} />
        ) : !rows ? (
          <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <EmptyState message="No revenue lines have been imported for this title yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                <tr className="border-b border-border/40">
                  <Th>Date</Th><Th>Territory</Th><Th>Channel</Th><Th>Units</Th><Th>Gross</Th><Th>Net</Th><Th>Ccy</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <Td>{new Date(r.occurred_on).toLocaleDateString()}</Td>
                    <Td>{r.territory ?? "—"}</Td>
                    <Td>{r.channel ?? "—"}</Td>
                    <Td className="tabular-nums">{r.units ?? 0}</Td>
                    <Td className="tabular-nums">{((r.gross_amount_paise ?? 0) / 100).toLocaleString("en-IN")}</Td>
                    <Td className="tabular-nums">{((r.net_amount_paise ?? 0) / 100).toLocaleString("en-IN")}</Td>
                    <Td>{r.currency ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditTab({ titleId }: { titleId: string }) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("admin_title_history", { _title_id: titleId });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows((data as HistoryEntry[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [titleId]);
  if (err) return <EmptyState message={`Timeline unavailable: ${err}`} />;
  if (!rows) return <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <EmptyState message="No lifecycle events recorded for this title yet." />;
  return (
    <Card title="Lifecycle timeline">
      <ol className="relative border-l border-border/40 pl-4 space-y-4">
        {rows.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
            <div className="text-xs text-muted-foreground">
              {new Date(e.occurred_at).toLocaleString()} · <span className="uppercase tracking-wider">{e.kind}</span>
              {e.actor_email && <> · {e.actor_email}</>}
            </div>
            <div className="text-sm mt-0.5">
              {e.action ? <span className="font-medium">{e.action}</span> : null}
              {e.from_status && e.to_status ? (
                <span> · <code className="text-xs">{e.from_status}</code> → <code className="text-xs">{e.to_status}</code></span>
              ) : null}
            </div>
            {e.note && <p className="text-xs text-muted-foreground mt-1">{e.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------------------------- Primitives ---------------------------- */

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border/50 bg-card p-4 md:p-5", className)}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value == null || value === "" ? <span className="text-muted-foreground">—</span> : value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium py-2 pr-3">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("py-2 pr-3 align-top", className)}>{children}</td>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmbeddedConsole({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reusing the shared {label} console</div>
      <div className="rounded-xl border border-border/50 bg-card p-2 md:p-3">{children}</div>
    </div>
  );
}
