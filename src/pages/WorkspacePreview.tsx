import { useState } from "react";
import {
  LayoutGrid, Film, Layers, Shield, Globe2, ShoppingBag,
  HardDrive, Cog, LineChart, Settings, LifeBuoy, Sparkles,
} from "lucide-react";
import {
  WorkspaceShell, WorkspaceNav, FilterBar, AssetCard, DetailsPanel,
  ActivityTimeline, type AssetCardData, type DetailsSection,
} from "@/components/px";
import { LEXICON } from "@/lib/px/lexicon";
import { useAuth } from "@/hooks/useAuth";

/**
 * StreamVista Workspace Preview — Phase 1 shell demonstration.
 *
 * Renders the OS-grade workspace shell with the shared primitives so
 * you can see the new experience before we migrate existing pages.
 *
 * Uses only demo data — reads no backend, mutates nothing.
 */

const NAV_GROUPS = [
  {
    id: "primary",
    label: "Work",
    items: [
      { id: "workspace",    label: LEXICON.workspace,    icon: LayoutGrid },
      { id: "productions",  label: LEXICON.productions,  icon: Film },
      { id: "media",        label: LEXICON.media,        icon: Layers },
      { id: "collections",  label: LEXICON.collections,  icon: Layers },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    items: [
      { id: "rights",       label: LEXICON.rights,       icon: Shield },
      { id: "distribution", label: LEXICON.distribution, icon: Globe2 },
      { id: "marketplace",  label: LEXICON.marketplace,  icon: ShoppingBag },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { id: "storage",      label: LEXICON.storage,      icon: HardDrive },
      { id: "operations",   label: LEXICON.operations,   icon: Cog },
      { id: "reports",      label: LEXICON.reports,      icon: LineChart },
    ],
  },
  {
    id: "system",
    items: [
      { id: "settings",     label: LEXICON.settings,     icon: Settings },
      { id: "support",      label: LEXICON.support,      icon: LifeBuoy },
    ],
  },
];

const FACETS = [
  { id: "type-feature",   label: "Feature Film" },
  { id: "type-episodic",  label: "Episodic" },
  { id: "res-4k",         label: "Resolution", value: "4K" },
  { id: "hdr",            label: "HDR" },
  { id: "codec-prores",   label: "Codec", value: "ProRes 422" },
  { id: "rights-ww",      label: "Rights", value: "Worldwide" },
  { id: "qc-passed",      label: "QC", value: "Passed" },
];

const ASSETS: AssetCardData[] = [
  { id: "a1", title: "Aurora — Feature Master v3",     identifier: "SV-PRD-00214", kind: LEXICON.master,      owner: "Northlight Films",     storage: "1.24 TB · OCI Object Storage",     rights: "Worldwide · 2024–2029", quality: "4K · HDR10 · ProRes 422", status: "ready"      },
  { id: "a2", title: "Monsoon Diaries — Ep 04 Proxy",  identifier: "SV-EP-00817",  kind: LEXICON.proxyMedia,  owner: "Backlot Studio",       storage: "12.4 GB · Proxy tier",             rights: "India · 3-year",         quality: "1080p · H.264",           status: "processing" },
  { id: "a3", title: "Solar Tide — Trailer Deliverable", identifier: "SV-DLV-01109", kind: LEXICON.deliverable, owner: "Aperture Collective",  storage: "3.8 GB · Delivery bucket",         rights: "N. America",             quality: "2K · H.265",              status: "warning"    },
  { id: "a4", title: "Silent Harbor — Camera Rolls A", identifier: "SV-RAW-04421", kind: LEXICON.rawMedia,    owner: "Northlight Films",     storage: "842 GB · Cold archive",            rights: "Not licensed",           quality: "6K · RAW",                status: "locked"     },
  { id: "a5", title: "Nine Bridges — Final Master",    identifier: "SV-PRD-00190", kind: LEXICON.master,      owner: "Ridgeline Pictures",   storage: "2.1 TB · OCI Object Storage",      rights: "Worldwide · Perpetual",  quality: "4K · Dolby Vision",       status: "approved"   },
  { id: "a6", title: "River's Edge — QC Report Pack",  identifier: "SV-QC-02201",  kind: "QC Package",         owner: "Backlot Studio",       storage: "48 MB · Documents",                rights: "Internal",               quality: "PDF · CSV",               status: "failed"     },
];

const TIMELINE = [
  { id: "e1", when: "12 min ago",  actor: "Priya Menon",   title: "Approved delivery",              description: "Aurora — Feature Master v3 → NBCU" },
  { id: "e2", when: "1 hr ago",    actor: "Ingest Engine", title: "Proxy generation completed",     description: "Monsoon Diaries — Episode 04" },
  { id: "e3", when: "3 hr ago",    actor: "QC Reviewer",   title: "Warning raised",                 description: "Solar Tide trailer · loudness -14 LUFS" },
  { id: "e4", when: "Yesterday",   actor: "Rights Engine", title: "Territory added",                description: "Nine Bridges · Latin America" },
];

export default function WorkspacePreview() {
  const { user, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState("workspace");
  const [activeFilters, setActiveFilters] = useState<string[]>(["res-4k", "qc-passed"]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>("a1");
  const [detailsTab, setDetailsTab] = useState("overview");

  const currentAsset = ASSETS.find((a) => a.id === selectedAsset) ?? null;

  const detailsSections: DetailsSection[] = currentAsset ? [
    { id: "overview", label: "Overview", content: (
      <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-xs">
        <dt className="text-muted-foreground">Identifier</dt><dd className="font-mono-tech">{currentAsset.identifier}</dd>
        <dt className="text-muted-foreground">Kind</dt><dd>{currentAsset.kind}</dd>
        <dt className="text-muted-foreground">Owner</dt><dd>{currentAsset.owner}</dd>
        <dt className="text-muted-foreground">Storage</dt><dd>{currentAsset.storage}</dd>
        <dt className="text-muted-foreground">Rights</dt><dd>{currentAsset.rights}</dd>
        <dt className="text-muted-foreground">Quality</dt><dd className="font-mono-tech">{currentAsset.quality}</dd>
      </dl>
    )},
    { id: "metadata", label: "Metadata", content: <p className="text-xs text-muted-foreground">Metadata editor renders here in Phase 2.</p> },
    { id: "assets",   label: "Assets",   content: <p className="text-xs text-muted-foreground">Linked assets list renders here in Phase 2.</p> },
    { id: "versions", label: "Versions", content: <p className="text-xs text-muted-foreground">Version history renders here in Phase 2.</p> },
    { id: "rights",   label: "Rights",   content: <p className="text-xs text-muted-foreground">Rights matrix renders here in Phase 2.</p> },
    { id: "qc",       label: "QC",       content: <p className="text-xs text-muted-foreground">Quality control checks render here in Phase 2.</p> },
    { id: "activity", label: "Activity", content: <ActivityTimeline events={TIMELINE} /> },
  ] : [];

  const displayName =
    (user?.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined
    ?? user?.email?.split("@")[0]
    ?? undefined;

  return (
    <WorkspaceShell
      workspaceLabel="Creator Workspace"
      workspaceIdentifier="Preview"
      accountName={displayName}
      onSignOut={user ? signOut : undefined}
      notificationsCount={3}
      leftRail={
        <WorkspaceNav
          groups={NAV_GROUPS}
          activeId={activeNav}
          ariaLabel="Creator workspace sections"
        />
      }
      header={
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono-tech uppercase tracking-[0.18em] text-muted-foreground">
              {LEXICON.workspace} · {LEXICON.productions}
            </p>
            <h1 className="font-display text-xl md:text-2xl font-semibold mt-0.5">
              Active {LEXICON.productions}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs rounded-md border border-border/60 px-3 py-1.5 text-muted-foreground hover:text-foreground">
              Saved views
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs rounded-md bg-accent text-accent-foreground px-3 py-1.5 font-semibold">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              {LEXICON.createProduction}
            </button>
          </div>
        </div>
      }
      filters={
        <FilterBar
          facets={FACETS}
          active={activeFilters}
          onToggle={(id) =>
            setActiveFilters((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onClearAll={() => setActiveFilters([])}
        />
      }
      rightRail={
        currentAsset ? (
          <DetailsPanel
            open
            title={currentAsset.title}
            subtitle={`${currentAsset.kind} · ${currentAsset.identifier}`}
            status={currentAsset.status}
            sections={detailsSections}
            activeSection={detailsTab}
            onSelectSection={setDetailsTab}
            onClose={() => setSelectedAsset(null)}
          />
        ) : (
          <div className="p-6 text-xs text-muted-foreground">
            Select an asset to view details.
          </div>
        )
      }
      onSearch={(q) => console.info("[UniversalSearch]", q)}
    >
      <section aria-labelledby="explorer-heading">
        <h2 id="explorer-heading" className="sr-only">Content Explorer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ASSETS.map((a) => (
            <AssetCard
              key={a.id}
              asset={{ ...a, selected: a.id === selectedAsset }}
              onSelect={(id) => setSelectedAsset((prev) => (prev === id ? null : id))}
              onOpen={(id) => { setSelectedAsset(id); setDetailsTab("overview"); }}
              onAction={(id) => console.info("action", id)}
            />
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
