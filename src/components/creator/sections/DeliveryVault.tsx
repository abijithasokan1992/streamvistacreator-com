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
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-accent mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h2 className="font-display text-lg">Delivery Vault</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Use this area for larger delivery masters, archive copies and paid
              storage expansion. Your day-to-day title prep (metadata, posters,
              trailers, review files) lives in the Workspace.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <Tile icon={HardDrive} title="Delivery-ready masters" body="DCPs, ProRes, broadcast-grade deliverables." />
          <Tile icon={Database} title="Catalog copies" body="Working copies of titles in active rotation." />
          <Tile icon={Archive} title="Long-term archive" body="Cold storage for finished, infrequently accessed titles." />
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-base">Your vault</h3>
        <MyVaultSummary />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-base">Expand storage</h3>
          <p className="text-xs text-muted-foreground">Paid plans · self-serve</p>
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
