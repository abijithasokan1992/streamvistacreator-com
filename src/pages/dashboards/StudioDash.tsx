import { useState } from "react";
import { Database, ShieldCheck, Cloud, ArrowUpRight, FolderPlus, Settings2, Wrench, Snowflake, Sparkles } from "lucide-react";
import RoleDashboardShell from "./RoleDashboardShell";
import VaultPlanCards from "@/components/studio/vault/VaultPlanCards";
import MyVaultSummary from "@/components/studio/vault/MyVaultSummary";
import VaultBillingPanel from "@/components/studio/vault/VaultBillingPanel";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function StudioDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <RoleDashboardShell
      expectedRole="studio"
      title="Studio Vault"
      subtitle="Secure cloud vault for RAW footage, masters, project files, completed titles and archive copies."
    >
      <div className="space-y-10">
        {/* Hero */}
        <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent p-7 md:p-9">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Studio Vault</span>
              <h2 className="font-display text-3xl md:text-4xl mt-2 leading-tight">
                Your studio's off-site cloud vault.
              </h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-xl">
                Production safety, catalog preservation and disaster recovery — in three tiers built for active films,
                finished libraries and long-term archive. Pay only for what you store.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="#plans">
                  <Button className="bg-gradient-primary text-primary-foreground glow-primary">
                    <ArrowUpRight className="w-4 h-4 mr-2" /> Buy Storage
                  </Button>
                </a>
                <Link to="/vault">
                  <Button variant="outline"><Cloud className="w-4 h-4 mr-2" /> Open Vault</Button>
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-1.5"><Sparkles className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" /> Active production storage</div>
                <div className="flex items-start gap-1.5"><Database className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" /> Completed-catalog storage</div>
                <div className="flex items-start gap-1.5"><Snowflake className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" /> Long-term archive copy</div>
                <div className="flex items-start gap-1.5"><ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" /> Encrypted at rest & in transit</div>
                <div className="flex items-start gap-1.5"><FolderPlus className="w-4 h-4 text-accent shrink-0 mt-0.5" /> Per-project organisation</div>
                <div className="flex items-start gap-1.5"><Wrench className="w-4 h-4 text-accent shrink-0 mt-0.5" /> Proxy / QC / delivery ready</div>
              </div>
            </div>
          </div>
        </section>

        {/* My Vault summary */}
        <section key={`my-${refreshKey}`}>
          <MyVaultSummary />
        </section>

        {/* Plan cards / calculator */}
        <section id="plans" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">Buy Storage</p>
              <h2 className="font-display text-2xl mt-1">Choose a storage class</h2>
            </div>
            <p className="text-xs text-muted-foreground hidden md:block">
              Pricing per TB · monthly base · billed in INR
            </p>
          </div>
          <VaultPlanCards onPurchased={refresh} />
        </section>

        {/* Upload / Ingest actions */}
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

        {/* Vault services (reserved space, non-blocking) */}
        <section>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-2">Vault Services</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              "Proxy generation",
              "QC review",
              "Archive copy",
              "Restore request",
              "Delivery prep",
            ].map((s) => (
              <div key={s} className="rounded-xl border border-dashed border-border/40 bg-secondary/5 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Settings2 className="w-4 h-4 text-muted-foreground" /> {s}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Coming soon for vault customers.</p>
              </div>
            ))}
          </div>
        </section>

        {/* Billing */}
        <section key={`bill-${refreshKey}`}>
          <VaultBillingPanel />
        </section>
      </div>
    </RoleDashboardShell>
  );
}
