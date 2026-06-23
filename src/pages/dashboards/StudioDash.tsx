import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Cloud, Database, HardDrive, Loader2,
  Snowflake, Sparkles, Wrench, Receipt, ShoppingCart, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStorageQuota } from "@/hooks/useStorageQuota";
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
import type { VaultProduct } from "@/lib/studioVault";

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
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">One-click purchase</span>
          <h3 className="font-display text-2xl mt-1.5">
            {hasPaid ? "Add another 1 TB Studio Storage" : "Start with 1 TB Studio Storage"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            Secure recurring vault storage for studio uploads, working media, masters and archive copies.
          </p>
          <p className="text-sm mt-3">
            <span className="font-display text-2xl">₹{totalRupees}</span>
            <span className="text-muted-foreground"> / month</span>
            <span className="text-xs text-muted-foreground ml-2">(₹{baseRupees} + {product.gst_percent}% GST)</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Billed monthly. Storage activates immediately after successful payment.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="lg"
            onClick={() => setOpen(true)}
            className="bg-gradient-primary text-primary-foreground glow-primary"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {hasPaid ? "Buy another 1 TB" : "Buy 1 TB Now"}
          </Button>
          <Link to="/contact" className="text-[11px] text-muted-foreground hover:text-accent">
            Need a larger setup? Contact StreamVista →
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
  const hasPaidVault = rows.length > 0;
  const hasTesting = q.testingModeEnabled && q.testingOverrideGb > 0;
  const hasUsable = hasPaidVault || hasTesting;

  const paidGbTotal = rows.reduce((s, r) => s + r.allocated_gb, 0);
  const usedGbTotal = rows.reduce((s, r) => s + r.used_gb, 0);
  const totalGb = paidGbTotal + (hasTesting ? q.testingOverrideGb : 0);

  return (
    <div className="space-y-6">
      {/* Status card */}
      <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Studio Vault</span>
              {hasPaidVault && <StatusPill tone="ok">Active</StatusPill>}
              {!hasPaidVault && hasTesting && <StatusPill tone="warn">Testing allowance</StatusPill>}
              {!hasUsable && <StatusPill tone="muted">Not activated</StatusPill>}
            </div>
            <h2 className="font-display text-2xl md:text-3xl mt-1.5 leading-tight">
              {hasPaidVault
                ? "Your studio vault is live."
                : hasTesting
                ? "Testing vault is live — 50 GB internal allowance."
                : "Activate your studio vault."}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              {hasPaidVault
                ? "Upload, browse and manage your studio's footage and masters from one place."
                : hasTesting
                ? "Use the temporary 50 GB allowance to test uploads and the vault workspace. Purchase a vault class to activate real storage."
                : "Pick a vault storage class to start uploading. Or request a founder-assisted plan if you need scoping help."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasUsable ? (
              <>
                <Button onClick={onGoVault} className="bg-gradient-primary text-primary-foreground glow-primary">
                  <Cloud className="w-4 h-4 mr-2" /> Open Vault
                </Button>
                <Button variant="outline" onClick={onGoBuy}>
                  <ShoppingCart className="w-4 h-4 mr-2" /> {hasPaidVault ? "Buy more storage" : "Browse plans"}
                </Button>
              </>
            ) : null}
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
            Includes a {q.testingOverrideGb} GB testing allowance — internal QA only. Buy paid storage below to activate real vault capacity.
          </p>
        )}
      </section>

      {/* One-click purchase — primary commercial CTA, surfaced before per-class breakdown */}
      <OneClickBuyCard product={liveSku} hasPaid={hasPaidVault} onPurchased={onPurchased} />

      {/* Per-class breakdown only when we have paid storage */}
      {!loading && rows.length > 0 && <MyVaultSummary />}
    </div>
  );
}

/* ============================================================
 * 2) BUY STORAGE
 * ============================================================ */
function BuyStorage({ onPurchased }: { onPurchased: () => void }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl">Choose a storage class</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Buy by the TB. Active for live productions, Library for completed titles and Archive for long-term preservation.
        </p>
      </header>
      <VaultPlanCards onPurchased={onPurchased} />
    </div>
  );
}

/* ============================================================
 * 3) VAULT WORKSPACE — real working actions
 * ============================================================ */
function VaultWorkspace({ rows, loading, onGoBuy }: { rows: AllocRow[]; loading: boolean; onGoBuy: () => void; }) {
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
        <h3 className="font-semibold">No active storage</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Activate vault storage before you can upload, ingest or snapshot. Pick a class on the Buy Storage tab.
        </p>
        <div className="mt-4">
          <Button onClick={onGoBuy} className="bg-gradient-primary text-primary-foreground glow-primary">
            <ShoppingCart className="w-4 h-4 mr-2" /> Choose storage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Upload to Vault", desc: "Browser upload now", to: "/vault", icon: <ArrowUpRight className="w-4 h-4" /> },
          { label: "Camera-to-Cloud", desc: "Live ingest from set", to: "/studio", icon: <Cloud className="w-4 h-4" /> },
          { label: "Hard-disk Import", desc: "Record physical intake", to: "/studio", icon: <Database className="w-4 h-4" /> },
          { label: "Archive Snapshot", desc: "Create archive copy", to: "/master-archive", icon: <Snowflake className="w-4 h-4" /> },
        ].map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors p-4 flex flex-col gap-1.5"
          >
            <span className="flex items-center gap-2 text-accent">{a.icon}<span className="font-medium text-foreground">{a.label}</span></span>
            <span className="text-xs text-muted-foreground">{a.desc}</span>
          </Link>
        ))}
      </section>

      {/* Compact services panel — no clutter */}
      <section className="rounded-xl border border-border/40 bg-secondary/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-accent" /> Vault Services</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Proxy generation, QC review, restore, delivery prep and archive handling. Available as founder-assisted services — we scope and price before any paid work begins.
            </p>
          </div>
          <StudioRequestService />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 text-[11px] text-muted-foreground">
          {["Proxy generation", "QC review", "Restore", "Delivery prep", "Archive handling"].map((s) => (
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
            <h2 className="font-display text-xl">Vault billing</h2>
            <p className="text-xs text-muted-foreground">Active storage purchases, recurring blocks, receipts, and incomplete checkout recovery.</p>
          </div>
        </div>
        <VaultBillingPanel />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Studio services & plan requests</h2>
            <p className="text-xs text-muted-foreground">Workflow, SLAs, archive posture and team access changes are founder-assisted. Submit a request and our team scopes, prices and activates.</p>
          </div>
          <div className="flex gap-2">
            <StudioRequestService />
            <StudioRequestPlanChange />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2"><Receipt className="w-4 h-4 text-accent" /> Founder-issued invoices</h2>
          <p className="text-xs text-muted-foreground">Invoices for services and custom plans issued by the StreamVista team.</p>
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

  const subtitle = useMemo(
    () => "Home, storage, vault workspace and billing — all in one console.",
    [],
  );

  return (
    <RoleDashboardShell expectedRole="studio" title="Studio Vault" subtitle={subtitle}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="home"><Sparkles className="w-3.5 h-3.5 mr-1.5" />Home</TabsTrigger>
          <TabsTrigger value="buy"><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Buy Storage</TabsTrigger>
          <TabsTrigger value="workspace"><Cloud className="w-3.5 h-3.5 mr-1.5" />Vault Workspace</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="w-3.5 h-3.5 mr-1.5" />Billing & Services</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-6">
          <StudioHome
            rows={rows}
            loading={loading}
            onGoBuy={() => setTab("buy")}
            onGoVault={() => setTab("workspace")}
            onGoBilling={() => setTab("billing")}
            onPurchased={refresh}
          />
        </TabsContent>
        <TabsContent value="buy" className="mt-6">
          <BuyStorage onPurchased={() => { refresh(); setTab("home"); }} />
        </TabsContent>
        <TabsContent value="workspace" className="mt-6">
          <VaultWorkspace rows={rows} loading={loading} onGoBuy={() => setTab("buy")} />
        </TabsContent>
        <TabsContent value="billing" className="mt-6">
          <BillingAndServices />
        </TabsContent>
      </Tabs>
    </RoleDashboardShell>
  );
}
