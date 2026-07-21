// Where it's streaming — thin panel that queries TMDb's watch/providers for the
// title's TMDb id and shows which platforms currently carry the film by region.
// India is highlighted first. Results are stored on `metadata.availability` so
// admins can see which rights are already exploited vs still available to sell.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, Tv } from "lucide-react";
import type { TitleMetadata } from "@/lib/creator/titleSchema";
import { fetchWatchProviders } from "@/lib/creator/metadataProviders";

const PRIORITY_REGIONS = ["IN", "US", "GB", "AE", "SG", "CA", "AU"];
const REGION_LABEL: Record<string, string> = {
  IN: "India", US: "United States", GB: "United Kingdom", AE: "UAE",
  SG: "Singapore", CA: "Canada", AU: "Australia",
};

export function WhereItsStreamingPanel({
  meta,
  onUpdate,
  readOnly,
}: {
  meta: TitleMetadata;
  onUpdate: (patch: Partial<TitleMetadata>) => void;
  readOnly?: boolean;
}) {
  const tmdbId = (meta.tmdb_id ?? "").trim();
  const kind = "movie" as const; // conservative default — TV titles just get an empty result
  const availability = (meta as any).availability ?? { source: "", fetched_at: "", regions: {} };
  const [loading, setLoading] = useState(false);

  const regions = availability.regions ?? {};
  const regionCodes = useMemo(() => {
    const all = Object.keys(regions);
    const priority = PRIORITY_REGIONS.filter((c) => all.includes(c));
    const rest = all.filter((c) => !priority.includes(c)).sort();
    return [...priority, ...rest];
  }, [regions]);

  const refresh = async () => {
    if (!tmdbId) {
      toast.info("Add a TMDb ID (or use Smart Metadata Import) to load streaming availability.");
      return;
    }
    setLoading(true);
    try {
      const providers = await fetchWatchProviders(tmdbId, kind);
      onUpdate({ availability: providers } as Partial<TitleMetadata>);
      const count = Object.keys(providers.regions ?? {}).length;
      toast.success(count ? `Availability loaded (${count} regions).` : "No streaming availability listed yet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load streaming availability.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load once when TMDb id becomes known and we haven't fetched yet.
  useEffect(() => {
    if (!tmdbId || availability.fetched_at || readOnly) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Where it's streaming</h3>
        </div>
        <button
          type="button"
          disabled={loading || readOnly}
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs hover:bg-secondary/40 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>
      <p className="text-[11px] text-muted-foreground">
        Sourced from TMDb's watch providers. Helps you and admins see which platforms already carry the title,
        so you know which rights are still available to sell.
      </p>

      {!tmdbId && (
        <p className="text-xs text-muted-foreground italic">
          Add a TMDb ID (Story tab → Smart Metadata Import) to see streaming availability.
        </p>
      )}

      {tmdbId && regionCodes.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic">
          Not currently listed on any streaming platform per TMDb. Rights appear open across regions.
        </p>
      )}

      {regionCodes.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {regionCodes.map((code) => {
            const r = regions[code];
            const rows: [string, string[]][] = [
              ["Subscription", r.flatrate ?? []],
              ["Free", r.free ?? []],
              ["Ads", r.ads ?? []],
              ["Rent", r.rent ?? []],
              ["Buy", r.buy ?? []],
            ].filter(([, list]) => list.length > 0) as [string, string[]][];
            if (rows.length === 0) return null;
            return (
              <div key={code} className="rounded-md border border-border/40 p-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{REGION_LABEL[code] ?? code}</span>
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noreferrer" className="text-primary text-[10px] hover:underline">
                      View on TMDb ↗
                    </a>
                  )}
                </div>
                <div className="mt-1.5 space-y-1">
                  {rows.map(([label, list]) => (
                    <div key={label} className="text-[11px]">
                      <span className="text-muted-foreground">{label}: </span>
                      <span>{list.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {availability.fetched_at && (
        <p className="text-[10px] text-muted-foreground">
          Last updated {new Date(availability.fetched_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
