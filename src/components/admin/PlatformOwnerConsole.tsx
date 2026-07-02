import { Crown, Scale, ShieldCheck, FileCheck2, Archive, Database, History, Flag, Cpu, Settings2, Users2, Building2, BookLock, Layers, Lock, Eye, Droplets, KeySquare } from "lucide-react";
import AiMcpControlCenter from "@/components/admin/AiMcpControlCenter";
import OracleOciStorageCard from "@/components/admin/OracleOciStorageCard";
import UsersAndCredentials from "@/components/admin/UsersAndCredentials";

/**
 * Super-Admin-only console. Reuses existing admin components where they already
 * exist and renders future-ready placeholder cards for governance modules that
 * are not yet wired to data — clearly labelled so nothing misleads operators.
 */
export default function PlatformOwnerConsole() {
  return (
    <div className="space-y-10">
      <div className="flex items-start gap-4 pb-2 border-b border-border/40">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
          <Crown className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Platform Owner Console</h2>
          <p className="text-sm text-muted-foreground">
            Root-level governance. Visible only to <span className="text-foreground">super_admin</span>.
          </p>
        </div>
      </div>

      {/* Overview */}
      <Section title="Platform Overview" icon={<Layers className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Role" value="SUPER_ADMIN" />
          <Stat label="Access" value="GLOBAL" />
          <Stat label="System Rank" value="PLATFORM OWNER" />
        </div>
      </Section>

      {/* User & Org governance */}
      <Section title="User Governance" icon={<Users2 className="w-4 h-4" />}>
        <UsersAndCredentials />
      </Section>

      <Section title="Organization Governance" icon={<Building2 className="w-4 h-4" />}>
        <Placeholder note="Multi-org / workspace governance UI lands here. Backend org tables are not yet provisioned." />
      </Section>

      {/* Review queues */}
      <div className="grid lg:grid-cols-3 gap-4">
        <QueueCard
          title="Legal Review Queue"
          icon={<Scale className="w-4 h-4" />}
          statuses={["Pending", "Approved", "Rejected"]}
        />
        <QueueCard
          title="QC Review Queue"
          icon={<FileCheck2 className="w-4 h-4" />}
          statuses={["Pending", "Passed", "Failed"]}
        />
        <QueueCard
          title="Security Review Queue"
          icon={<ShieldCheck className="w-4 h-4" />}
          statuses={["Pending", "Approved", "Restricted"]}
        />
      </div>

      {/* Rights */}
      <Section title="Rights Registry" icon={<BookLock className="w-4 h-4" />}>
        <Placeholder note="Title-level rights, territories, windows and chain-of-title records." />
      </Section>

      {/* Storage governance */}
      <Section title="Storage Governance" icon={<Database className="w-4 h-4" />}>
        <OracleOciStorageCard />
        <div className="grid lg:grid-cols-3 gap-4">
          <TierCard tier="OCI Standard" desc="Hot tier · sub-ms reads · live delivery." />
          <TierCard tier="OCI Infrequent Access" desc="Warm tier · ~30 day retrieval economics." />
          <TierCard tier="OCI Archive" desc="Cold tier · hours-scale restore · lowest cost." />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <MiniCard title="Archive Policies" note="Define what auto-tiers to Archive and after how long." />
          <MiniCard title="Restore Requests" note="Track and approve cold-tier restores." />
          <MiniCard title="Storage Lifecycle Jobs" note="Scheduled migrations across tiers." />
        </div>
      </Section>

      <Section title="Archive Management" icon={<Archive className="w-4 h-4" />}>
        <Placeholder note="Long-term archive inventory, integrity scrubs, and retention holds." />
      </Section>

      {/* Content security */}
      <Section title="Content Security" icon={<Lock className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniCard title="DRM Management" note="Widevine / FairPlay / PlayReady key policies." icon={<KeySquare className="w-4 h-4" />} />
          <MiniCard title="Watermark Policies" note="Forensic + visible watermark rules per title/buyer." icon={<Droplets className="w-4 h-4" />} />
          <MiniCard title="Screening Policies" note="Allowed devices, geo windows, screening caps." icon={<Eye className="w-4 h-4" />} />
          <MiniCard title="Buyer Access Policies" note="Per-buyer entitlements and review constraints." icon={<ShieldCheck className="w-4 h-4" />} />
        </div>
      </Section>

      {/* Audit + flags */}
      <Section title="Audit Logs" icon={<History className="w-4 h-4" />}>
        <Placeholder note="Cross-system audit feed (auth, RLS, payments, AI). The AI/MCP control centre below shows live AI audit." />
      </Section>

      <Section title="Feature Flags" icon={<Flag className="w-4 h-4" />}>
        <Placeholder note="Global feature flag registry. Toggle experimental modules per env/org." />
      </Section>

      <Section title="AI Control Center" icon={<Cpu className="w-4 h-4" />}>
        <AiMcpControlCenter />
      </Section>

      <Section title="System Configuration" icon={<Settings2 className="w-4 h-4" />}>
        <Placeholder note="Cross-cutting platform settings (domains, branding, free-tier, etc.) live in the Business & Ops department tab." />
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
        <span className="w-7 h-7 rounded-lg bg-secondary/60 grid place-items-center text-accent">{icon}</span>
        <span className="font-display text-lg">{title}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-2">{value}</div>
    </div>
  );
}

function Placeholder({ note }: { note: string }) {
  return (
    <div className="glass rounded-2xl p-5 border border-dashed border-border/60">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Coming soon</div>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function MiniCard({ title, note, icon }: { title: string; note: string; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function TierCard({ tier, desc }: { tier: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Storage Tier</div>
      <div className="font-display text-lg font-bold mt-1">{tier}</div>
      <p className="text-xs text-muted-foreground mt-2">{desc}</p>
    </div>
  );
}

function QueueCard({ title, icon, statuses }: { title: string; icon: React.ReactNode; statuses: string[] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <span
            key={s}
            className="text-[11px] px-2 py-1 rounded-full bg-secondary/60 border border-border/60 text-muted-foreground"
          >
            {s} · 0
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">No items yet — queue wiring pending.</p>
    </div>
  );
}
