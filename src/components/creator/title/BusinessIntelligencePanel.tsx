import { BarChart3, TrendingUp } from "lucide-react";
import {
  type TitleMetadata,
  ROI_ESTIMATE_OPTIONS,
  ROI_ESTIMATE_LABEL,
  SUBLICENSABLE_OPTIONS,
  SUBLICENSABLE_LABEL,
} from "@/lib/creator/titleSchema";

type Props = {
  meta: TitleMetadata;
  setMeta: (m: TitleMetadata) => void;
  readOnly: boolean;
};

/**
 * BusinessIntelligencePanel — captures BI-oriented fields on a title so the
 * admin BI dashboard can sort films by market potential before approaching
 * buyers. Stored inside `metadata.commercial` and `metadata.performance` —
 * no schema migrations required.
 */
export function BusinessIntelligencePanel({ meta, setMeta, readOnly }: Props) {
  const c = meta.commercial;
  const p = meta.performance;

  const updCommercial = (patch: Partial<TitleMetadata["commercial"]>) =>
    setMeta({ ...meta, commercial: { ...c, ...patch } });
  const updPerformance = (patch: Partial<TitleMetadata["performance"]>) =>
    setMeta({ ...meta, performance: { ...p, ...patch } });

  const tagsStr = p.platform_affinity_tags.join(", ");

  return (
    <section className="rounded-lg border border-border/40 bg-card/30 p-4 sm:p-5 space-y-6">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          Business & Performance Signals
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
          Optional BI fields. Feeds the admin Business Intelligence dashboard so
          operators can rank titles by market potential before contacting buyers.
        </p>
      </header>

      {/* Rights & Business */}
      <div className="space-y-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Rights & Business
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium">Rights expiry date</span>
            <input
              type="date"
              disabled={readOnly}
              value={c.rights_expiry_date || ""}
              onChange={(e) => updCommercial({ rights_expiry_date: e.target.value })}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
            />
            <span className="block text-[10px] text-muted-foreground">
              Date after which current rights lapse.
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">Sublicensable status</span>
            <select
              disabled={readOnly}
              value={c.sublicensable_status}
              onChange={(e) => updCommercial({ sublicensable_status: e.target.value as any })}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
            >
              {SUBLICENSABLE_OPTIONS.map((o) => (
                <option key={o} value={o}>{SUBLICENSABLE_LABEL[o]}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium">Target audience</span>
            <input
              type="text"
              disabled={readOnly}
              maxLength={400}
              value={c.target_audience}
              onChange={(e) => updCommercial({ target_audience: e.target.value })}
              placeholder="e.g. Urban 18–34, South Indian diaspora, family viewers"
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> Performance
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium">ROI estimate</span>
            <select
              disabled={readOnly}
              value={p.roi_estimate}
              onChange={(e) => updPerformance({ roi_estimate: e.target.value as any })}
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
            >
              {ROI_ESTIMATE_OPTIONS.map((o) => (
                <option key={o} value={o}>{ROI_ESTIMATE_LABEL[o]}</option>
              ))}
            </select>
            <span className="block text-[10px] text-muted-foreground">
              Your confidence in commercial return.
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">Platform affinity tags</span>
            <input
              type="text"
              disabled={readOnly}
              defaultValue={tagsStr}
              onBlur={(e) => {
                const parts = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 20);
                updPerformance({ platform_affinity_tags: parts });
              }}
              placeholder="Netflix, Prime Video, Aha, YouTube AVOD"
              className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
            />
            <span className="block text-[10px] text-muted-foreground">
              Comma-separated. Streaming platforms this title fits.
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
