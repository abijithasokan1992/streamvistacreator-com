import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Cloud, Database, HardDrive, Loader2,
  Snowflake, Sparkles, Wrench, Receipt, ShoppingCart, ShieldCheck, UploadCloud,
  Clapperboard, Activity, ListChecks, Plus, CheckCircle2, AlertTriangle, RefreshCw,
  Zap, Server, CreditCard, Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import RoleDashboardShell from "./RoleDashboardShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import VaultPlanCards from "@/components/studio/vault/VaultPlanCards";
import MyVaultSummary from "@/components/studio/vault/MyVaultSummary";
import VaultBillingPanel from "@/components/studio/vault/VaultBillingPanel";
import BuyVaultDialog from "@/components/studio/vault/BuyVaultDialog";
import StudioRequestService from "@/components/studio/StudioRequestService";
import StudioRequestPlanChange from "@/components/studio/StudioRequestPlanChange";
import ManualInvoicesList from "@/components/billing/ManualInvoicesList";
import HardDiskIntakeDialog from "@/components/studio/HardDiskIntakeDialog";
import StudioIngest from "@/components/studio/ingest/StudioIngest";
import StudioQuickActions from "@/components/studio/StudioQuickActions";
import StudioPlanStrip from "@/components/studio/StudioPlanStrip";
import ProductionHero from "@/components/studio/ProductionHero";
import IngestMediaDialog, { runIngestValidation } from "@/components/studio/IngestMediaDialog";
import ProductionMediaWorkspace from "@/components/studio/ProductionMediaWorkspace";
import type { VaultProduct } from "@/lib/studioVault";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

type AllocRow = { id: string; allocated_gb: number; used_gb: number; source: string };

function useLiveStudioSku() {
  const [product, setProduct] = useState<VaultProduct | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("studio_vault_products_public" as any)
        .select("*")
        .eq("visible", true)
        .eq("self_serve_enabled", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        const p = data as unknown as VaultProduct;
        setProduct({
          ...p,
          default_tb_options: Array.isArray(p.default_tb_options) ? p.default_tb_options : [1],
          billing_modes: Array.isArray(p.billing_modes) ? p.billing_modes : ["monthly"],
          features: Array.isArray(p.features) ? p.features : [],
        });
      }
    })();
  }, []);
  return product;
}

function OneClickBuyCard({
  product, hasPaid, onPurchased,
}: { product: VaultProduct | null; hasPaid: boolean; onPurchased: () => void }) {
  const [open, setOpen] = useState(false);
  if (!product) return null;
  const gstMul = 1 + (product.gst_percent ?? 18) / 100;
  const totalRupees = Math.round((product.sell_price_per_tb_paise / 100) * gstMul);
  const baseRupees = Math.round(product.sell_price_per_tb_paise / 100);
  return (
    <section className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-secondary/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">One-click</span>
          <h3 className="font-display text-2xl mt-1.5">
            {hasPaid ? "Add 1 TB" : "Start with 1 TB"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Recurring vault storage for uploads, masters and archives.
          </p>
          <p className="text-sm mt-3">
            <span className="font-display text-2xl">₹{totalRupees}</span>
            <span className="text-muted-foreground"> / month</span>
            <span className="text-xs text-muted-foreground ml-2">(incl. {product.gst_percent}% GST)</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Activates right after payment.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="lg"
            onClick={() => setOpen(true)}
            className="bg-gradient-primary text-primary-foreground glow-primary"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {hasPaid ? "Add 1 TB" : "Buy 1 TB"}
          </Button>
          <Link to="/contact" className="text-[11px] text-muted-foreground hover:text-accent">
            Need more? Contact us →
          </Link>
        </div>
      </div>
      <BuyVaultDialog
        product={product}
        open={open}
        onOpenChange={setOpen}
        onPurchased={() => { setOpen(false); onPurchased(); }}
      />
    </section>
  );
}

function useStudioVaultRows() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AllocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bump, setBump] = useState(0);
  const refresh = () => setBump((b) => b + 1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("storage_allocations")
        .select("id,allocated_gb,used_gb,source")
        .eq("user_id", user.id)
        .like("source", "studio_vault%");
      setRows((data as AllocRow[]) ?? []);
      setLoading(false);
    })();
  }, [user?.id, bump]);

  return { rows, loading, refresh };
}

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
      : "bg-secondary/30 text-muted-foreground border-border/50";
  return <span className={`text-[10px] uppercase tracking-widest font-mono border rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}

/* Compact System Status — read-only badges. No diagnostics panel. */
function SystemStatusStrip({
  storageReady, billingActive, storageLocked,
}: { storageReady: boolean; billingActive: boolean; storageLocked: boolean }) {
  const items: Array<{ label: string; ok: boolean; icon: JSX.Element }> = [
    { label: "Storage Ready", ok: storageReady, icon: <Database className="w-3 h-3" /> },
    { label: "Upload Engine", ok: true, icon: <UploadCloud className="w-3 h-3" /> },
    { label: "OCI Connected", ok: true, icon: <Cloud className="w-3 h-3" /> },
    { label: "Billing Active", ok: billingActive && !storageLocked, icon: <CreditCard className="w-3 h-3" /> },
    { label: "Proxy Ready", ok: true, icon: <Film className="w-3 h-3" /> },
  ];
  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-accent" />
        <h3 className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">System Status</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.label}
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono border rounded-full px-2.5 py-1 ${
              it.ok
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-400/30"
                : "bg-amber-500/10 text-amber-300 border-amber-400/30"
            }`}
          >
            {it.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {it.icon}
            {it.label}
          </span>
        ))}
      </div>
    </section>
  );
}



/* ============================================================
 * 1) STUDIO HOME — status-first, one primary CTA
 * ============================================================ */
function StudioHome({ rows, loading, onGoBuy, onGoVault, onGoBilling, onPurchased }: {
  rows: AllocRow[]; loading: boolean;
  onGoBuy: () => void; onGoVault: () => void; onGoBilling: () => void;
  onPurchased: () => void;
}) {
  const q = useStorageQuota();
  const liveSku = useLiveStudioSku();
  const [buyOpen, setBuyOpen] = useState(false);
  const hasPaidVault = rows.length > 0;
  const hasTesting = q.testingModeEnabled && q.testingOverrideGb > 0;
  const hasUsable = hasPaidVault || hasTesting;

  const paidGbTotal = rows.reduce((s, r) => s + r.allocated_gb, 0);
  const usedGbTotal = rows.reduce((s, r) => s + r.used_gb, 0);
  const totalGb = paidGbTotal + (hasTesting ? q.testingOverrideGb : 0);

  // Direct paid CTA — opens the existing BuyVaultDialog with the live 1 TB SKU.
  // Removes the previous "Browse plans" dead-end which only switched tabs.
  const openBuy = () => {
    if (!liveSku) {
      // Surface a meaningful message instead of silently doing nothing.
      // (toast import lives in shared scope of BuyVaultDialog; keep this local UX minimal)
      return;
    }
    setBuyOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Plan & quota visibility — top of Studio Home */}
      <StudioPlanStrip
        hasPaidVault={hasPaidVault}
        hasTesting={hasTesting}
        totalGb={totalGb}
        usedGb={usedGbTotal}
        onUpgrade={hasPaidVault ? onGoBilling : openBuy}
      />

      {/* Studio Tools / Quick Actions */}
      <StudioQuickActions
        hasUsable={hasUsable}
        totalGb={totalGb}
        usedGb={usedGbTotal}
        onOpenIngest={onGoVault}
        onOpenBilling={onGoBilling}
        onOpenLibrary={onGoVault}
      />

      {/* Status card */}
      <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Studio Storage</span>
              {hasPaidVault && <StatusPill tone="ok">Active</StatusPill>}
              {!hasPaidVault && hasTesting && <StatusPill tone="warn">Testing allowance</StatusPill>}
              {!hasUsable && <StatusPill tone="muted">Not activated</StatusPill>}
            </div>
            <h2 className="font-display text-2xl md:text-3xl mt-1.5 leading-tight">
              {hasPaidVault
                ? "Storage is live."
                : hasTesting
                ? "Testing storage active."
                : "Activate your storage."}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              {hasPaidVault
                ? "Upload and manage your footage and masters."
                : hasTesting
                ? "50 GB test allowance. Buy 1 TB to go live."
                : "Buy 1 TB to start uploading."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasUsable && (
              <Button onClick={onGoVault} variant={hasPaidVault ? "default" : "outline"} className={hasPaidVault ? "bg-gradient-primary text-primary-foreground glow-primary" : ""}>
                <Cloud className="w-4 h-4 mr-2" /> Open Storage
              </Button>
            )}
            <Button
              onClick={openBuy}
              disabled={!liveSku}
              className="bg-gradient-primary text-primary-foreground glow-primary"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {hasPaidVault ? "Add 1 TB" : "Buy 1 TB"}
            </Button>
          </div>
        </div>

        {/* Quota summary numbers */}
        {hasUsable && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Allocated</p>
              <p className="font-display text-lg mt-0.5">
                {totalGb >= 1024 ? `${(totalGb / 1024).toFixed(1)} TB` : `${totalGb.toFixed(0)} GB`}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Used</p>
              <p className="font-display text-lg mt-0.5">{usedGbTotal.toFixed(2)} GB</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Available</p>
              <p className="font-display text-lg mt-0.5">{Math.max(0, totalGb - usedGbTotal).toFixed(1)} GB</p>
            </div>
          </div>
        )}

        {hasTesting && !hasPaidVault && (
          <p className="text-[11px] text-muted-foreground mt-3">
            <ShieldCheck className="w-3 h-3 inline mr-1 text-amber-300" />
            {q.testingOverrideGb} GB test allowance. Buy 1 TB to activate real capacity.
          </p>
        )}

        {!liveSku && (
          <p className="text-[11px] text-amber-300 mt-3">
            Storage unavailable right now. Try refreshing.
          </p>
        )}
      </section>

      {/* Shared BuyVaultDialog — single source of truth for Studio checkout. */}
      <BuyVaultDialog
        product={liveSku}
        open={buyOpen}
        onOpenChange={setBuyOpen}
        onPurchased={() => { setBuyOpen(false); onPurchased(); }}
      />

      {/* Detailed one-click purchase card removed — the inline "Buy 1 TB" button in the
          status header above opens the same BuyVaultDialog with the same SKU. */}

      {/* Per-class breakdown only when we have paid storage */}
      {!loading && rows.length > 0 && <MyVaultSummary />}
    </div>
  );
}

/* ============================================================
 * 2) BUY STORAGE
 * ============================================================ */
function BuyStorage({ onPurchased }: { onPurchased: () => void }) {
  const payg = useCreatorPaygPrice();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl">1 TB Storage</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {payg.totalLabel}/month. Recurring storage for masters and archives.
        </p>
      </header>
      <VaultPlanCards onPurchased={onPurchased} />
    </div>
  );
}

/* ============================================================
 * 3) VAULT WORKSPACE — real working actions
 * ============================================================ */
function VaultWorkspace({ rows, loading, onGoBuy, onGoIngest }: { rows: AllocRow[]; loading: boolean; onGoBuy: () => void; onGoIngest: () => void; }) {
  const q = useStorageQuota();
  const hasPaid = rows.length > 0;
  const hasTesting = q.testingModeEnabled && q.testingOverrideGb > 0;
  const hasUsable = hasPaid || hasTesting;

  if (loading) {
    return <div className="rounded-2xl border border-border/40 p-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;
  }

  if (!hasUsable) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/10 p-10 text-center">
        <Database className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold">No storage yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Buy storage to start uploading.
        </p>
        <div className="mt-4">
          <Button onClick={onGoBuy} className="bg-gradient-primary text-primary-foreground glow-primary">
            <ShoppingCart className="w-4 h-4 mr-2" /> Buy Storage
          </Button>
        </div>
      </div>
    );
  }

  const tiles: Array<{ label: string; desc: string; icon: JSX.Element; onClick?: () => void; to?: string }> = [
    { label: "Upload", desc: "From browser", to: "/vault", icon: <ArrowUpRight className="w-4 h-4" /> },
    { label: "Camera-to-Cloud", desc: "Live from set", onClick: onGoIngest, icon: <Cloud className="w-4 h-4" /> },
    { label: "Archive Intake", desc: "Master bundle", onClick: onGoIngest, icon: <Snowflake className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((a) => {
          const inner = (
            <>
              <span className="flex items-center gap-2 text-accent">{a.icon}<span className="font-medium text-foreground">{a.label}</span></span>
              <span className="text-xs text-muted-foreground">{a.desc}</span>
            </>
          );
          return a.to ? (
            <Link key={a.label} to={a.to} className="rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors p-4 flex flex-col gap-1.5">{inner}</Link>
          ) : (
            <button key={a.label} onClick={a.onClick} className="text-left rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors p-4 flex flex-col gap-1.5">{inner}</button>
          );
        })}
        <HardDiskIntakeDialog />
      </section>


      {/* Compact services panel — no clutter */}
      <section className="rounded-xl border border-border/40 bg-secondary/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-accent" /> Storage Services</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Proxies, QC, restore, delivery and archive — founder-assisted.
            </p>
          </div>
          <StudioRequestService />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 text-[11px] text-muted-foreground">
          {["Proxies", "QC", "Restore", "Delivery", "Archive"].map((s) => (
            <span key={s} className="rounded-full border border-border/50 px-2 py-0.5">{s}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
 * 4) BILLING & SERVICES
 * ============================================================ */
function BillingAndServices() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Billing</h2>
            <p className="text-xs text-muted-foreground">Purchases, receipts and pending checkouts.</p>
          </div>
        </div>
        <VaultBillingPanel />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Services & plan requests</h2>
            <p className="text-xs text-muted-foreground">Founder-assisted. We scope, price and activate.</p>
          </div>
          <div className="flex gap-2">
            <StudioRequestService />
            <StudioRequestPlanChange />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2"><Receipt className="w-4 h-4 text-accent" /> Invoices</h2>
          <p className="text-xs text-muted-foreground">Issued by the StreamVista team.</p>
        </div>
        <ManualInvoicesList surface="studio" />
      </section>
    </div>
  );
}

/* ============================================================
 * Production Control Center — 4 tabs, no wizard gates
 * ============================================================ */

const CONTENT_TYPES = [
  "Feature Film", "Series", "Documentary", "Short Film",
  "Commercial", "Music Video", "Animation", "Other",
] as const;

const TITLE_STATUSES = [
  "Pre-Production", "Production", "Post-Production", "Delivery", "Archived",
] as const;

const DEFAULT_FOLDERS = [
  "RAW", "Proxy", "Audio", "Documents", "Reports",
  "LUTs", "Stills", "Masters", "Deliverables", "Archive",
] as const;

function generateTitleNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TTL-${yyyy}${mm}${dd}-${rand}`;
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  if (n < 1099511627776) return `${(n / 1073741824).toFixed(2)} GB`;
  return `${(n / 1099511627776).toFixed(2)} TB`;
}

/* ============================================================
 * Active Production — cross-tab synchronization
 * ============================================================ */
const ACTIVE_PROJECT_KEY = "sv:active-project";
function activeProjKey(wsId: string | null) {
  return wsId ? `${ACTIVE_PROJECT_KEY}:${wsId}` : ACTIVE_PROJECT_KEY;
}

type ActiveProject = { id: string; name: string; crew?: any } | null;

function useActiveProject(workspaceId: string | null) {
  const [projectId, setProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !workspaceId) return null;
    return localStorage.getItem(activeProjKey(workspaceId));
  });
  const [project, setProject] = useState<ActiveProject>(null);

  // Reload persisted selection when workspace changes.
  useEffect(() => {
    if (!workspaceId) { setProjectIdState(null); return; }
    try {
      const v = localStorage.getItem(activeProjKey(workspaceId));
      setProjectIdState(v);
    } catch { setProjectIdState(null); }
  }, [workspaceId]);

  // Hydrate the active project record (name + crew metadata for inheritance).
  useEffect(() => {
    if (!projectId) { setProject(null); return; }
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name,crew")
        .eq("id", projectId)
        .maybeSingle();
      setProject((data as any) ?? null);
    })();
  }, [projectId]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setProjectIdState(id);
    try {
      if (!workspaceId) return;
      if (id) localStorage.setItem(activeProjKey(workspaceId), id);
      else localStorage.removeItem(activeProjKey(workspaceId));
    } catch {}
  }, [workspaceId]);

  return { activeProjectId: projectId, activeProject: project, setActiveProjectId };
}

/* ============================================================
 * 5) PRODUCTION PANEL — active workspace + title list
 * ============================================================ */
function ProductionPanel({
  activeProjectId, onSetActive,
}: {
  activeProjectId: string | null;
  onSetActive: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const { activeId, workspaces, canWriteActive } = useWorkspaces();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; created_at: string; crew?: any; user_id?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [contentType, setContentType] = useState<string>("Feature Film");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("Pre-Production");

  const refresh = useCallback(async () => {
    if (!activeId) { setProjects([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id,name,created_at,crew,user_id")
      .eq("workspace_id", activeId)
      .order("created_at", { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-select the newest non-archived Production as Active when none is set.
  // Keeps Upload / Activity / Storage tabs meaningful without manual pinning,
  // and prevents an archived title from silently becoming the workspace context.
  useEffect(() => {
    if (!loading && projects.length > 0 && !activeProjectId) {
      const firstLive = projects.find(
        (p) => String(p.crew?.title_status ?? "").toLowerCase() !== "archived",
      );
      if (firstLive) onSetActive(firstLive.id);
    }
  }, [loading, projects, activeProjectId, onSetActive]);

  const canSubmit = !!activeId && !!user && !!name.trim() && !!company.trim() && !!contentType && !!startDate && !!status;

  const handleCreate = async () => {
    if (!canSubmit || !activeId || !user) return;
    if (!canWriteActive) { toast.error("You only have viewer access to this workspace"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("projects").insert({
        workspace_id: activeId,
        user_id: user.id,
        name: name.trim(),
        crew: {
          title_number: generateTitleNumber(),
          content_type: contentType,
          production_company: company.trim(),
          start_date: startDate,
          title_status: status,
          folders: DEFAULT_FOLDERS,
          members: [],
        } as any,
      }).select("id").single();
      if (error) throw error;
      toast.success("Title created");
      setName(""); setCompany(""); setShowForm(false);
      await refresh();
      if (data?.id) onSetActive(data.id);
    } catch (e) {
      toast.error((e as Error).message || "Failed to create Title");
    } finally {
      setSubmitting(false);
    }
  };

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Workspace</span>
        </div>
        <h2 className="font-display text-xl mt-1.5">{activeWs?.name ?? "No workspace selected"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {activeWs ? `${projects.length} production${projects.length === 1 ? "" : "s"} in this workspace.` : "Select a workspace to begin."}
        </p>
      </section>

      <section className="rounded-2xl border border-border/50 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-accent" /> Productions
          </h3>
          {activeId && (
            <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Production
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="p-4 mb-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="p-name">Title Name</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Untitled Feature 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TITLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="p-company">Production Company</Label>
                <Input id="p-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northlight Pictures Pvt. Ltd." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-start">Start Date</Label>
                <Input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                Create Production
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No productions yet. Create one to begin.</p>
        ) : (
          <ProductionGroups
            projects={projects}
            currentUserId={user?.id ?? null}
            activeProjectId={activeProjectId}
            onSetActive={onSetActive}
          />
        )}
      </section>
    </div>
  );
}

/* ---- Grouped list: My Productions / Partner Productions / Archived --------
 * Active Production is workspace context and stays surfaced by the hero card
 * above the tabs — it's not repeated here. Grouping rules reuse the existing
 * project record without new columns:
 *   • My Productions      = created by the current user (projects.user_id)
 *   • Partner Productions = created by another workspace member
 *   • Archived            = crew.title_status === "Archived"
 * A production classified as Archived never appears in My/Partner.
 */
type ProjectRow = { id: string; name: string; created_at: string; crew?: any; user_id?: string };

function ProductionGroups({
  projects, currentUserId, activeProjectId, onSetActive,
}: {
  projects: ProjectRow[];
  currentUserId: string | null;
  activeProjectId: string | null;
  onSetActive: (id: string) => void;
}) {
  const { mine, partner, archived } = useMemo(() => {
    const mine: ProjectRow[] = [];
    const partner: ProjectRow[] = [];
    const archived: ProjectRow[] = [];
    for (const p of projects) {
      const isArchived = String(p.crew?.title_status ?? "").toLowerCase() === "archived";
      if (isArchived) { archived.push(p); continue; }
      if (currentUserId && p.user_id === currentUserId) mine.push(p);
      else partner.push(p);
    }
    return { mine, partner, archived };
  }, [projects, currentUserId]);

  return (
    <div className="space-y-6">
      <ProductionGroup title="My Productions" tone="accent" items={mine} activeProjectId={activeProjectId} onSetActive={onSetActive} emptyHint="Productions you create appear here." />
      <ProductionGroup title="Partner Productions" tone="muted" items={partner} activeProjectId={activeProjectId} onSetActive={onSetActive} emptyHint="Productions shared into this workspace by teammates appear here." />
      <ProductionGroup title="Archived Productions" tone="muted" items={archived} activeProjectId={activeProjectId} onSetActive={onSetActive} emptyHint="Set a production's status to Archived to move it here." dim />
    </div>
  );
}

function ProductionGroup({
  title, items, activeProjectId, onSetActive, emptyHint, tone, dim,
}: {
  title: string;
  items: ProjectRow[];
  activeProjectId: string | null;
  onSetActive: (id: string) => void;
  emptyHint: string;
  tone: "accent" | "muted";
  dim?: boolean;
}) {
  const toneCls = tone === "accent"
    ? "bg-accent/10 text-accent border-accent/30"
    : "bg-secondary/40 text-muted-foreground border-border/50";
  return (
    <div className={dim ? "opacity-80" : ""}>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">{title}</h4>
        <span className={`text-[10px] font-mono border rounded-full px-2 py-0.5 ${toneCls}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-1">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const isActive = p.id === activeProjectId;
            return (
              <div key={p.id} className={`flex items-center justify-between py-2 border-b border-border/30 last:border-0 ${isActive ? "bg-accent/5 rounded-md px-2" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2 truncate">
                    <span className="truncate">{p.name}</span>
                    {isActive && <StatusPill tone="ok">Active</StatusPill>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.crew?.content_type ?? "Production"} · {p.crew?.title_status ?? "Active"}
                    {p.crew?.title_number && <> · <span className="font-mono">{p.crew.title_number}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  {!isActive && (
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onSetActive(p.id)}>
                      Set active
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 6) ACTIVITY PANEL — recent ingest queue
 * ============================================================ */
type JobRow = {
  id: string;
  job_mode: string;
  status: string;
  destination_type: string;
  total_bytes: number;
  transferred_bytes: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  created_at: string;
  source_summary: any;
};

function ActivityPanel({ activeProjectId, activeProjectName }: { activeProjectId: string | null; activeProjectName?: string | null }) {
  const { activeId } = useWorkspaces();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"active" | "all">(activeProjectId ? "active" : "all");

  // Follow the Active Production automatically — if the user pins one, scope
  // to it; if they clear it, fall back to workspace-wide activity.
  useEffect(() => {
    setScope(activeProjectId ? "active" : "all");
  }, [activeProjectId]);

  const refresh = useCallback(async () => {
    if (!activeId) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("ingest_jobs")
      .select("id,job_mode,status,destination_type,total_bytes,transferred_bytes,total_files,completed_files,failed_files,created_at,source_summary,project_id")
      .eq("workspace_id", activeId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (scope === "active" && activeProjectId) q = q.eq("project_id", activeProjectId);
    const { data } = await q;
    setJobs((data as JobRow[]) ?? []);
    setLoading(false);
  }, [activeId, scope, activeProjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/50 p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-accent" /> Recent Ingest Activity
            </h3>
            {activeProjectId && activeProjectName && (
              <span className="text-[10px] uppercase tracking-widest font-mono border rounded-full px-2 py-0.5 bg-accent/10 text-accent border-accent/30">
                {scope === "active" ? `Scoped · ${activeProjectName}` : "All workspace jobs"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeProjectId && (
              <Button variant="ghost" size="sm" onClick={() => setScope(scope === "active" ? "all" : "active")} className="text-xs h-8">
                {scope === "active" ? "Show all" : "Scope to Active"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading || !activeId}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {scope === "active" && activeProjectName
              ? `No ingest jobs yet for “${activeProjectName}”.`
              : "No ingest jobs yet for this workspace."}
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => {
              const pct = j.total_bytes > 0 ? Math.min(100, Math.round((j.transferred_bytes / j.total_bytes) * 100)) : 0;
              const tone =
                j.status === "completed" ? "text-emerald-300" :
                j.status === "failed" ? "text-destructive" :
                j.status === "paused" ? "text-amber-300" :
                j.status === "uploading" || j.status === "verifying" || j.status === "retrying" ? "text-accent" :
                "text-muted-foreground";
              const Icon = j.status === "completed" ? CheckCircle2 : j.status === "failed" ? AlertTriangle : ListChecks;
              return (
                <div key={j.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />
                      <span className="font-medium truncate">{j.source_summary?.root_label ?? "(unnamed source)"}</span>
                      <span className="text-[10px] uppercase border border-border/50 rounded-full px-1.5 py-0.5">{j.job_mode.replace(/_/g, " ")}</span>
                      <span className="text-[10px] uppercase border border-border/50 rounded-full px-1.5 py-0.5">{j.destination_type === "archive_vault" ? "Archive" : "Working"}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {j.completed_files}/{j.total_files} files · {fmtBytes(j.transferred_bytes)} / {fmtBytes(j.total_bytes)}
                      {j.failed_files > 0 && <> · <span className="text-destructive">{j.failed_files} failed</span></>}
                      {" · "}{new Date(j.created_at).toLocaleString()}
                    </p>
                    {j.total_bytes > 0 && (
                      <div className="w-full bg-secondary/30 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div className="bg-accent h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
 * 7) STORAGE PANEL — quota + buy + vault summary
 * ============================================================ */
function StoragePanel({ rows, loading, onGoBuy, onPurchased }: {
  rows: AllocRow[]; loading: boolean;
  onGoBuy: () => void; onPurchased: () => void;
}) {
  const q = useStorageQuota();
  const hasPaid = rows.length > 0;
  const hasTesting = q.testingModeEnabled && q.testingOverrideGb > 0;
  const hasUsable = hasPaid || hasTesting;

  const paidGbTotal = rows.reduce((s, r) => s + r.allocated_gb, 0);
  const usedGbTotal = rows.reduce((s, r) => s + r.used_gb, 0);
  const totalGb = paidGbTotal + (hasTesting ? q.testingOverrideGb : 0);

  return (
    <div className="space-y-6">
      {/* Quota status card */}
      <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Studio Storage</span>
              {hasPaid && <StatusPill tone="ok">Active</StatusPill>}
              {!hasPaid && hasTesting && <StatusPill tone="warn">Testing allowance</StatusPill>}
              {!hasUsable && <StatusPill tone="muted">Not activated</StatusPill>}
            </div>
            <h2 className="font-display text-2xl md:text-3xl mt-1.5 leading-tight">
              {hasPaid ? "Storage is live." : hasTesting ? "Testing storage active." : "Activate your storage."}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              {hasPaid ? "Upload and manage your footage and masters." : hasTesting ? `${q.testingOverrideGb} GB test allowance. Buy 1 TB to go live.` : "Buy 1 TB to start uploading."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onGoBuy} className="bg-gradient-primary text-primary-foreground glow-primary">
              <ShoppingCart className="w-4 h-4 mr-2" />
              {hasPaid ? "Add 1 TB" : "Buy 1 TB"}
            </Button>
          </div>
        </div>
        {hasUsable && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Allocated</p>
              <p className="font-display text-lg mt-0.5">
                {totalGb >= 1024 ? `${(totalGb / 1024).toFixed(1)} TB` : `${totalGb.toFixed(0)} GB`}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Used</p>
              <p className="font-display text-lg mt-0.5">{usedGbTotal.toFixed(2)} GB</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Available</p>
              <p className="font-display text-lg mt-0.5">{Math.max(0, totalGb - usedGbTotal).toFixed(1)} GB</p>
            </div>
          </div>
        )}
      </section>

      {/* Vault summary for paid users */}
      {!loading && rows.length > 0 && <MyVaultSummary />}

      {/* Purchase options */}
      <BuyStorage onPurchased={onPurchased} />
    </div>
  );
}

/* ============================================================
 * Shell with tabs
 * ============================================================ */
export default function StudioDashboard() {
  const [tab, setTab] = useState<string>("productions");
  const { rows, loading, refresh } = useStudioVaultRows();
  const quota = useStorageQuota();
  const { activeId: workspaceId, canWriteActive } = useWorkspaces();
  const { activeProjectId, activeProject, setActiveProjectId } = useActiveProject(workspaceId);

  // Production Workspace — single primary entry points.
  const [ingestOpen, setIngestOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [resumeIngestAfterBuy, setResumeIngestAfterBuy] = useState(false);
  // Open Production opens the logical media view in a Sheet; Switch/Edit/New
  // stay inline in the Productions tab.
  const [sheet, setSheet] = useState<null | "open_production">(null);
  const [productionsFormOpen, setProductionsFormOpen] = useState(false);
  const liveSku = useLiveStudioSku();

  const refreshAfterPurchase = () => {
    refresh();
    quota.refresh();
  };

  const subtitle = useMemo(
    () => "Active Production · System Status · Storage · Recent Activity.",
    [],
  );

  // Inherit metadata from the Active Production's `crew` JSONB so Upload
  // pre-fills without asking the DIT to retype known values.
  const ingestDefaults = useMemo(() => {
    const c = activeProject?.crew ?? {};
    const cameraBrandGuess: string | undefined =
      typeof c.camera_system === "string" ? String(c.camera_system).split(/\s+/)[0] : undefined;
    return {
      cameraBrand: cameraBrandGuess || c.camera_brand || undefined,
      unit: c.default_unit || c.unit || undefined,
    };
  }, [activeProject?.crew]);

  const paidGbTotal = useMemo(() => rows.reduce((s, r) => s + r.allocated_gb, 0), [rows]);
  const usedGbTotal = useMemo(() => rows.reduce((s, r) => s + r.used_gb, 0), [rows]);
  const bonusGb = quota.testingModeEnabled ? quota.testingOverrideGb : 0;
  const totalGb = paidGbTotal + bonusGb;
  const availableGb = Math.max(0, totalGb - usedGbTotal);

  // Automatic Validation Gate — one primary CTA drives every ingest path.
  const startIngest = useCallback(() => {
    const v = runIngestValidation({
      workspaceId,
      activeProjectId,
      canWrite: canWriteActive,
      totalGb,
      usedGb: usedGbTotal,
      storageLocked: quota.locked,
    });
    if (v.ok === true) { setIngestOpen(true); return; }
    const fail = v;
    // Fail with a clear action — never a raw technical error.
    if (fail.cta === "buy_storage") {
      toast.error(fail.message, {
        action: liveSku ? { label: "Buy Storage", onClick: () => { setResumeIngestAfterBuy(true); setBuyOpen(true); } } : undefined,
      });
    } else if (fail.cta === "choose_production") {
      toast.error(fail.message, { action: { label: "Choose", onClick: () => setTab("production") } });
    } else {
      toast.error(fail.message);
    }
  }, [workspaceId, activeProjectId, canWriteActive, totalGb, usedGbTotal, quota.locked, liveSku]);

  const handlePurchased = useCallback(() => {
    setBuyOpen(false);
    refreshAfterPurchase();
    if (resumeIngestAfterBuy) {
      setResumeIngestAfterBuy(false);
      // Give the entitlement refresh a tick before re-validating.
      setTimeout(() => setIngestOpen(true), 400);
      toast.success("Storage activated — resuming ingest.");
    }
  }, [resumeIngestAfterBuy]);



  return (
    <RoleDashboardShell expectedRole="studio" title="Production Control Center" subtitle={subtitle}>
      <div className="mb-4 flex justify-end">
        <Link
          to="/dashboard/studio/profile"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> My Studio Profile
        </Link>
      </div>

      {/* Production Control Center — executive overview.
          Primary: Ingest Media (opens Ingest Workspace) / Open Production (Sheet).
          Secondary: New / Edit / Switch Production → jump to the Productions tab. */}
      <div className="mb-6">
        <ProductionHero
          workspaceId={workspaceId ?? null}
          activeProject={activeProject}
          totalGb={totalGb}
          usedGb={usedGbTotal}
          onIngest={startIngest}
          onOpenLibrary={() => setSheet("open_production")}
          onNew={() => { setProductionsFormOpen(true); setTab("productions"); }}
          onEdit={() => { setProductionsFormOpen(false); setTab("productions"); }}
          onSwitch={() => { setProductionsFormOpen(false); setTab("productions"); }}
        />
      </div>

      {/* System Health — compact read-only badges. */}
      <div className="mb-6">
        <SystemStatusStrip
          storageReady={totalGb > 0 && availableGb > 0}
          billingActive={paidGbTotal > 0 || (quota.testingModeEnabled && quota.testingOverrideGb > 0)}
          storageLocked={!!quota.locked}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="productions"><Clapperboard className="w-3.5 h-3.5 mr-1.5" />Productions</TabsTrigger>
          <TabsTrigger value="storage"><Database className="w-3.5 h-3.5 mr-1.5" />Storage</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="w-3.5 h-3.5 mr-1.5" />Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="productions" className="mt-6">
          <ProductionPanel
            activeProjectId={activeProjectId}
            onSetActive={setActiveProjectId}
            initialFormOpen={productionsFormOpen}
            onFormClose={() => setProductionsFormOpen(false)}
          />
        </TabsContent>
        <TabsContent value="storage" className="mt-6">
          <StoragePanel rows={rows} loading={loading} onGoBuy={() => setTab("storage")} onPurchased={refreshAfterPurchase} />
        </TabsContent>
        <TabsContent value="activity" className="mt-6">
          <ActivityPanel activeProjectId={activeProjectId} activeProjectName={activeProject?.name ?? null} />
        </TabsContent>
      </Tabs>

      {/* Ingest Workspace — reuses <StudioIngest/> for all sources & pipeline stages. */}
      <IngestMediaDialog
        open={ingestOpen}
        onOpenChange={setIngestOpen}
        activeProjectId={activeProjectId ?? undefined}
        ingestDefaults={ingestDefaults}
      />

      {/* Open Production — logical media view (Shoot Day → Unit → Camera → Card → Clips). */}
      <Sheet open={sheet === "open_production"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Open Production</SheetTitle>
            <SheetDescription>
              {activeProject?.name ?? "Active production"} — logical media view.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ProductionMediaWorkspace
              workspaceId={workspaceId ?? null}
              activeProjectId={activeProjectId}
              activeProjectName={activeProject?.name ?? null}
            />
          </div>
        </SheetContent>
      </Sheet>



      {/* Storage-insufficient remediation — reuses existing BuyVaultDialog and
          resumes ingest automatically once entitlement refreshes. */}
      <BuyVaultDialog
        product={liveSku}
        open={buyOpen}
        onOpenChange={(o) => { setBuyOpen(o); if (!o) setResumeIngestAfterBuy(false); }}
        onPurchased={handlePurchased}
      />
    </RoleDashboardShell>
  );
}
