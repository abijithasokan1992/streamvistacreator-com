import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowUpRight, Cloud, Database, Loader2,
  RefreshCw, ShieldCheck, Snowflake, ShoppingCart, Sparkles, UploadCloud,
  Receipt, Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import { useLiveStudioSku } from "@/components/shared/useLiveStudioSku";
import RoleDashboardShell from "./RoleDashboardShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

type AllocRow = { id: string; allocated_gb: number; used_gb: number; source: string };

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
  }, [user?.id, bump]); // eslint-disable-line react-hooks/exhaustive-deps

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

/* ============================================================
 * STATUS BANNER — single authoritative block for Home tab
 * replaces: StudioPlanStrip + inline status card + OneClickBuyCard
 * ============================================================ */
function StudioStatusBanner({ rows, onGoVault, onPurchased }: {
  rows: AllocRow[];
  onGoVault: () => void;
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
  const availGb = Math.max(0, totalGb - usedGbTotal);

  const gstMul = liveSku ? 1 + (liveSku.gst_percent ?? 18) / 100 : 1;
  const priceLabel = liveSku
    ? `₹${Math.round((liveSku.sell_price_per_tb_paise / 100) * gstMul)}/mo`
    : "";

  const statusTone: "ok" | "warn" | "muted" = hasPaidVault ? "ok" : hasTesting ? "warn" : "muted";
  const statusLabel = hasPaidVault ? "Active" : hasTesting ? "Test allowance" : "Not activated";
  const heading = hasPaidVault
    ? "Storage is live."
    : hasTesting
    ? "Test allowance enabled."
    : "Activate your storage.";
  const desc = hasPaidVault
    ? "Upload and manage your footage and masters."
    : hasTesting
    ? "50 GB test allowance active. Buy 1 TB to activate real capacity."
    : "Buy 1 TB to start uploading.";

  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Studio Storage</span>
            <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
          </div>
          <h2 className="font-display text-2xl md:text-3xl mt-1.5 leading-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">{desc}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {hasUsable && (
            <Button onClick={onGoVault} variant={hasPaidVault ? "default" : "outline"} className={hasPaidVault ? "bg-gradient-primary text-primary-foreground glow-primary" : ""}>
              <Cloud className="w-4 h-4 mr-2" /> Open Vault
            </Button>
          )}
          <Button
            onClick={() => setBuyOpen(true)}
            disabled={!liveSku}
            variant={hasPaidVault ? "outline" : "default"}
            className={!hasPaidVault ? "bg-gradient-primary text-primary-foreground glow-primary" : ""}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {hasPaidVault ? "Add 1 TB" : `Buy 1 TB${priceLabel ? ` · ${priceLabel}` : ""}`}
          </Button>
        </div>
      </div>

      {/* Quota numbers — only when storage is usable */}
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
            <p className="font-display text-lg mt-0.5">{availGb.toFixed(1)} GB</p>
          </div>
        </div>
      )}

      {/* Visible error when SKU can't load */}
      {!liveSku && (
        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Storage plans are unavailable right now.
          </p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      <BuyVaultDialog
        product={liveSku}
        open={buyOpen}
        onOpenChange={setBuyOpen}
        onPurchased={() => { setBuyOpen(false); onPurchased(); }}
      />
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
  const hasPaidVault = rows.length > 0;
  const hasTesting = q.testingModeEnabled && q.testingOverrideGb > 0;
  const hasUsable = hasPaidVault || hasTesting;

  const paidGbTotal = rows.reduce((s, r) => s + r.allocated_gb, 0);
  const usedGbTotal = rows.reduce((s, r) => s + r.used_gb, 0);
  const totalGb = paidGbTotal + (hasTesting ? q.testingOverrideGb : 0);

  return (
    <div className="space-y-6">
      {/* 1. Status + CTA — always first */}
      <StudioStatusBanner
        rows={rows}
        onGoVault={onGoVault}
        onPurchased={onPurchased}
      />

      {/* 2. Studio Tools / Quick Actions */}
      <StudioQuickActions
        hasUsable={hasUsable}
        totalGb={totalGb}
        usedGb={usedGbTotal}
        onOpenIngest={onGoVault}
        onOpenBilling={onGoBilling}
        onOpenLibrary={onGoVault}
      />

      {/* 3. Per-class breakdown only when we have paid storage */}
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
 * Shell with tabs
 * ============================================================ */
export default function StudioDashboard() {
  const [tab, setTab] = useState<string>("home");
  const { rows, loading, refresh } = useStudioVaultRows();
  const quota = useStorageQuota();

  const refreshAfterPurchase = () => {
    refresh();
    quota.refresh();
  };

  const profileLink = (
    <Link
      to="/dashboard/studio/profile"
      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5"
    >
      <ShieldCheck className="w-3.5 h-3.5" /> My Studio Profile
    </Link>
  );

  return (
    <RoleDashboardShell expectedRole="studio" title="Studio Storage" headerAction={profileLink}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="home"><Sparkles className="w-3.5 h-3.5 mr-1.5" />Home</TabsTrigger>
          <TabsTrigger value="ingest"><UploadCloud className="w-3.5 h-3.5 mr-1.5" />Ingest</TabsTrigger>
          <TabsTrigger value="buy"><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Plans</TabsTrigger>
          <TabsTrigger value="workspace"><Cloud className="w-3.5 h-3.5 mr-1.5" />Vault</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="w-3.5 h-3.5 mr-1.5" />Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-6">
          <StudioHome
            rows={rows}
            loading={loading}
            onGoBuy={() => setTab("buy")}
            onGoVault={() => setTab("workspace")}
            onGoBilling={() => setTab("billing")}
            onPurchased={refreshAfterPurchase}
          />
        </TabsContent>
        <TabsContent value="ingest" className="mt-6">
          <StudioIngest />
        </TabsContent>
        <TabsContent value="buy" className="mt-6">
          <BuyStorage onPurchased={() => { refreshAfterPurchase(); setTab("home"); }} />
        </TabsContent>
        <TabsContent value="workspace" className="mt-6">
          <VaultWorkspace rows={rows} loading={loading} onGoBuy={() => setTab("buy")} onGoIngest={() => setTab("ingest")} />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <BillingAndServices />
        </TabsContent>
      </Tabs>
    </RoleDashboardShell>
  );
}
