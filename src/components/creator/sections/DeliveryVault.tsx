import { Database, HardDrive, Archive } from "lucide-react";
import VaultPlanCards from "@/components/studio/vault/VaultPlanCards";
import MyVaultSummary from "@/components/studio/vault/MyVaultSummary";
import Buy1TBCard from "@/components/shared/Buy1TBCard";

/**
 * Creator Delivery Vault
 * ---------------------------------------------------------------
 * UI / positioning surface only. Reuses Studio vault components.
 * No new entitlement engine — the underlying storage pool remains
 * the existing one served by get_workspace_storage_entitlement.
 *
 * Purpose: give Creators a dedicated home for master delivery
 * files, archive copies and paid storage expansion — clearly
 * distinct from the day-to-day Workspace (titles / posters /
 * trailers / review prep).
 */
export default function DeliveryVaultSection() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-2xl border border-border/40 bg-secondary/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-accent mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <h2 className="font-display text-lg">My Library</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              A dedicated home for delivery masters, archive copies and paid storage expansion. Day-to-day title prep (metadata, posters, trailers, review files) stays in the Workspace.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 sm:mt-5">
          <Tile icon={HardDrive} title="Delivery-ready masters" body="DCPs, ProRes, broadcast-grade deliverables." />
          <Tile icon={Database} title="Catalog copies" body="Working copies of titles in active rotation." />
          <Tile icon={Archive} title="Long-term archive" body="Cold storage for finished titles." />
        </div>
      </div>

      {/* One-click 1 TB purchase — primary commercial CTA */}
      <Buy1TBCard
        headline="1 TB Library Storage"
        subline="Recurring storage for masters, delivery files, archive copies and buyer-facing materials."
      />

      <section className="space-y-3">
        <h3 className="font-display text-base">Your library</h3>
        <MyVaultSummary />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-base">All storage plans</h3>
          <p className="text-xs text-muted-foreground">Self-serve checkout</p>
        </div>
        <VaultPlanCards />
      </section>
    </div>
  );
}

function Tile({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-3">
      <Icon className="w-4 h-4 text-accent mb-1.5" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
    </div>
  );
}
