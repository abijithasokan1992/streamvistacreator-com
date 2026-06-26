import { useMemo } from "react";
import { Lock, Sparkles, Globe2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type TitleMetadata,
  type RightStatus,
  type TerritoryStatus,
  type EngagementMode,
  RIGHTS_CATALOG,
  TERRITORY_CATALOG,
  RIGHT_STATUS_LABEL,
  TERRITORY_STATUS_LABEL,
  PREMIUM_PLAN_TIERS,
} from "@/lib/creator/titleSchema";

type Props = {
  meta: TitleMetadata;
  setMeta: (m: TitleMetadata) => void;
  readOnly: boolean;
  /** Free creators see a reduced commercial surface (no premium rights matrix, no min-deal, no territory grid beyond Worldwide). */
  isFree?: boolean;
};

const RIGHT_STATUS_OPTIONS: RightStatus[] = [
  "none", "available", "sold", "not_available", "discuss", "premium_required",
];
const TERRITORY_STATUS_OPTIONS: TerritoryStatus[] = [
  "none", "available", "sold", "blocked", "discuss",
];

export function RightsAvailabilityPanel({ meta, setMeta, readOnly, isFree = false }: Props) {
  const c = meta.commercial;
  const isPremium = !isFree && c.engagement_mode === "upgrade_premium";
  const isFreePath = isFree || c.engagement_mode === "free_listing" || c.engagement_mode === "go_free";

  const update = (patch: Partial<TitleMetadata["commercial"]>) =>
    setMeta({ ...meta, commercial: { ...c, ...patch } });

  const setRight = (key: string, status: RightStatus) =>
    update({ rights: { ...c.rights, [key]: status } });
  const setTerritory = (key: string, status: TerritoryStatus) =>
    update({ territories: { ...c.territories, [key]: status } });

  const counts = useMemo(() => {
    const rAvail = Object.values(c.rights).filter((v) => v === "available").length;
    const tAvail = Object.values(c.territories).filter((v) => v === "available").length;
    return { rAvail, tAvail };
  }, [c.rights, c.territories]);

  return (
    <section className="rounded-lg border border-border/40 bg-card/30 p-4 sm:p-5 space-y-6">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          Rights Availability & Distribution Preferences
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
          Tell StreamVista what's commercially available for licensing, who has already
          bought what, and where the title can be sold. Submission does not guarantee
          listing — your title is reviewed for QC and legal clearance before it goes
          to buyers, investors or distributors.
        </p>
      </header>

      {/* 1. Engagement mode — hidden for free creators (single fixed path). */}
      {!isFree && (
        <div className="space-y-2">
          <SectionLabel>How should StreamVista handle this title commercially?</SectionLabel>
          <div className="grid sm:grid-cols-3 gap-2">
            <EngagementCard
              active={c.engagement_mode === "free_listing"}
              disabled={readOnly}
              onClick={() => update({ engagement_mode: "free_listing" })}
              title="Free Listing / Revenue Share"
              body="Default for free creators. After QC & legal review, your title may be listed on the StreamVista marketplace for buyer discovery on a non-exclusive revenue share."
              tag="Free"
            />
            <EngagementCard
              active={c.engagement_mode === "go_free"}
              disabled={readOnly}
              onClick={() => update({ engagement_mode: "go_free" })}
              title="Go with Free"
              body="Stay on the free path and accept its scope. No managed premium rights-sales support."
              tag="Free"
            />
            <EngagementCard
              active={c.engagement_mode === "upgrade_premium"}
              disabled={readOnly}
              onClick={() => update({ engagement_mode: "upgrade_premium" })}
              title="Upgrade for Premium Rights Sales"
              body="Unlock managed rights sales: dubbing, remake, in-flight, channel/territory blocking, bespoke campaigns."
              tag="Premium"
              premium
            />
          </div>

          {isPremium && (
            <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3 mt-2">
              <div className="text-[11px] uppercase tracking-wider text-amber-300 mb-2 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Premium Rights-Sales Plans
              </div>
              <div className="flex flex-wrap gap-2">
                {PREMIUM_PLAN_TIERS.map((p) => (
                  <span key={p.value} className="text-xs rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-100">
                    {p.label}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Plan selection & invoicing is handled by Storage & Billing after submission.
                You can keep editing rights below — premium-only rights will be actively pursued under your selected plan.
              </p>
            </div>
          )}

          {isFreePath && (
            <p className="text-[11px] text-muted-foreground inline-flex items-start gap-1.5 mt-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Free path defaults: non-exclusive, revenue share, worldwide, with core digital rights available. Specialist managed-sales rights (dubbing, remake, in-flight, cruise, channel/territory blocking) are marked as premium services.
            </p>
          )}
        </div>
      )}

      {/* 2. Rights availability matrix */}
      <div className="space-y-3">
        <SectionLabel>
          Rights availability <span className="text-muted-foreground font-normal">· {counts.rAvail} marked available</span>
        </SectionLabel>

        <RightsGroup
          title="Core rights"
          subtitle="Included in free listing scope"
          items={RIGHTS_CATALOG.filter((r) => r.group === "core")}
          rights={c.rights}
          onChange={setRight}
          readOnly={readOnly}
        />

        <RightsGroup
          title="Premium / managed rights"
          subtitle={isPremium
            ? "Actively pursued under your premium plan"
            : "Available as a premium service — upgrade to have StreamVista actively sell these"}
          items={RIGHTS_CATALOG.filter((r) => r.group === "premium")}
          rights={c.rights}
          onChange={setRight}
          readOnly={readOnly}
          locked={!isPremium}
        />
      </div>

      {/* 3. Territories */}
      <div className="space-y-3">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5" /> Territory availability
          </span>
          <span className="text-muted-foreground font-normal"> · {counts.tAvail} marked available</span>
        </SectionLabel>
        <div className="grid sm:grid-cols-2 gap-2">
          {TERRITORY_CATALOG.map((t) => {
            const status = (c.territories[t.key] as TerritoryStatus) ?? "none";
            const lockedAdvanced = !isPremium && t.key !== "worldwide" && t.key !== "india";
            return (
              <div key={t.key} className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2">
                <span className="text-xs flex-1 truncate">{t.label}</span>
                <select
                  disabled={readOnly}
                  value={status}
                  onChange={(e) => setTerritory(t.key, e.target.value as TerritoryStatus)}
                  className="text-[11px] bg-background border border-border/40 rounded px-2 py-1 disabled:opacity-60"
                >
                  {TERRITORY_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{TERRITORY_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                {lockedAdvanced && status === "blocked" && (
                  <span className="text-[10px] inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-300 px-1.5 py-0.5">
                    <Lock className="w-2.5 h-2.5" /> Premium
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {!isPremium && (
          <p className="text-[11px] text-muted-foreground">
            Territory blocking / carve-outs are actively managed only on premium plans. Free creators can still mark territories as available, sold or reserved for discussion.
          </p>
        )}
      </div>

      {/* 4. Exclusivity & deal preference */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Exclusivity</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {(["non_exclusive", "exclusive"] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={readOnly}
                onClick={() => update({ exclusivity: v })}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border transition",
                  c.exclusivity === v
                    ? "bg-accent/20 border-accent/50 text-foreground"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/30",
                  readOnly && "opacity-60",
                )}
              >
                {v === "non_exclusive" ? "Non-exclusive" : "Exclusive"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Deal model</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {([
              { v: "revenue_share", l: "Revenue Share" },
              { v: "mg", l: "Minimum Guarantee" },
              { v: "outright", l: "Outright Sale" },
              { v: "open", l: "Open to Discussion" },
            ] as const).map(({ v, l }) => (
              <button
                key={v}
                type="button"
                disabled={readOnly}
                onClick={() => update({ deal_model: v })}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border transition",
                  c.deal_model === v
                    ? "bg-accent/20 border-accent/50 text-foreground"
                    : "border-border/40 text-muted-foreground hover:bg-secondary/30",
                  readOnly && "opacity-60",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Minimum expected deal value (optional)</SectionLabel>
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={c.min_deal_value ?? ""}
            onChange={(e) =>
              update({ min_deal_value: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="e.g. 500000"
            className="w-full bg-background border border-border/40 rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
          />
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={c.open_to_investors}
              onChange={(e) => update({ open_to_investors: e.target.checked })}
              className="accent-accent"
            />
            Open to investor discussions
          </label>
        </div>
      </div>

      {/* 5. Notes */}
      <div>
        <SectionLabel>Commercial notes (optional)</SectionLabel>
        <textarea
          rows={3}
          disabled={readOnly}
          value={c.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Anything StreamVista should know — prior deals, blocked windows, contacts already in play…"
          className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm disabled:opacity-60"
        />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
        Submission does not guarantee marketplace listing. After you submit, StreamVista's
        team reviews the title for QC and legal clearance. Only approved titles are surfaced
        to buyers, investors and distributors based on the rights and territories you've
        marked as available.
      </p>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </div>
  );
}

function EngagementCard({
  active, disabled, onClick, title, body, tag, premium,
}: {
  active: boolean; disabled: boolean; onClick: () => void;
  title: string; body: string; tag: string; premium?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border p-3 transition relative",
        active
          ? premium
            ? "border-amber-400/60 bg-amber-400/5 ring-1 ring-amber-400/30"
            : "border-accent/60 bg-accent/10 ring-1 ring-accent/30"
          : "border-border/40 hover:border-border/70 bg-background/50",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{title}</span>
        <span className={cn(
          "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
          premium ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/10 text-emerald-300",
        )}>{tag}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
    </button>
  );
}

function RightsGroup({
  title, subtitle, items, rights, onChange, readOnly, locked,
}: {
  title: string;
  subtitle: string;
  items: typeof RIGHTS_CATALOG;
  rights: Record<string, RightStatus>;
  onChange: (key: string, s: RightStatus) => void;
  readOnly: boolean;
  locked?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/40 p-3 bg-background/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5">
            {title}
            {locked && <Lock className="w-3 h-3 text-amber-300" />}
          </div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((r) => {
          const status = (rights[r.key] as RightStatus) ?? "none";
          // For premium-locked rights, force premium_required if user marks available
          const effectiveOptions = locked
            ? (["none", "premium_required", "sold", "not_available", "discuss"] as RightStatus[])
            : RIGHT_STATUS_OPTIONS;
          return (
            <div key={r.key} className="flex items-center gap-2 rounded border border-border/30 px-2.5 py-1.5">
              <span className="text-xs flex-1 truncate">{r.label}</span>
              <select
                disabled={readOnly}
                value={effectiveOptions.includes(status) ? status : "none"}
                onChange={(e) => onChange(r.key, e.target.value as RightStatus)}
                className="text-[11px] bg-background border border-border/40 rounded px-2 py-1 disabled:opacity-60"
              >
                {effectiveOptions.map((s) => (
                  <option key={s} value={s}>{RIGHT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RightsAvailabilityPanel;
