/**
 * ProductionHero — Production Control Center hero card.
 *
 * Reuses existing data (projects.crew JSONB, storage_allocations, ingest_jobs)
 * — no new tables, no new APIs. Renders:
 *   • Cover Photo / Production Name / Number / Content Type / Status
 *   • Production Day (days since start_date)
 *   • Storage Used (workspace-wide) & Last Upload (latest ingest_jobs row)
 *   • Primary CTAs: Ingest Media, Open Library
 *   • Secondary: Edit Production, Switch Production
 *   • Optional Production Conditions (weather) when crew.shoot_location is set
 *
 * All actions are provided by the parent to preserve existing routing / dialogs.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clapperboard, Cloud, HardDrive, Pencil, Repeat, UploadCloud,
  MapPin, Sunrise, Sunset, Wind, Droplets, ThermometerSun, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getWeatherData } from "@/services/weatherApi";

type ActiveProject = { id: string; name: string; crew?: any } | null;

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n < 1_099_511_627_776) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  return `${(n / 1_099_511_627_776).toFixed(2)} TB`;
}

function productionDay(startDate?: string): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

function conditionTone(w: any): "good" | "caution" | "risk" {
  if (!w) return "good";
  const wind = w.windSpeed ?? 0;
  const precip = w.precipitation ?? 0;
  if (precip >= 2 || wind >= 40) return "risk";
  if (precip >= 0.3 || wind >= 25) return "caution";
  return "good";
}

const TONE_STYLE = {
  good:    { dot: "🟢", label: "Good for Shooting", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" },
  caution: { dot: "🟡", label: "Use Caution",       cls: "text-amber-300 border-amber-400/30 bg-amber-500/10" },
  risk:    { dot: "🔴", label: "Weather Risk",      cls: "text-destructive border-destructive/40 bg-destructive/10" },
} as const;

export default function ProductionHero({
  workspaceId,
  activeProject,
  totalGb,
  usedGb,
  onIngest,
  onOpenLibrary,
  onEdit,
  onSwitch,
}: {
  workspaceId: string | null;
  activeProject: ActiveProject;
  totalGb: number;
  usedGb: number;
  onIngest: () => void;
  onOpenLibrary: () => void;
  onEdit?: () => void;
  onSwitch?: () => void;
}) {
  const crew = activeProject?.crew ?? {};
  const cover: string | undefined = crew.cover_url || crew.cover_photo;
  const shootLocation = crew.shoot_location as
    | { name?: string; lat?: number; lng?: number }
    | undefined;

  const [lastUpload, setLastUpload] = useState<{ at: string; bytes: number } | null>(null);
  const [weather, setWeather] = useState<any | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Last upload for the active production (or workspace if none).
  useEffect(() => {
    if (!workspaceId) { setLastUpload(null); return; }
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("ingest_jobs")
        .select("created_at,transferred_bytes,project_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (activeProject?.id) q = q.eq("project_id", activeProject.id);
      const { data } = await q;
      if (cancelled) return;
      const row = (data as any[])?.[0];
      setLastUpload(row ? { at: row.created_at, bytes: Number(row.transferred_bytes ?? 0) } : null);
    })();
    return () => { cancelled = true; };
  }, [workspaceId, activeProject?.id]);

  // Weather when the production has a shoot location.
  useEffect(() => {
    if (!shootLocation?.lat || !shootLocation?.lng) { setWeather(null); return; }
    let cancelled = false;
    setWeatherLoading(true);
    getWeatherData(shootLocation.lat, shootLocation.lng, shootLocation.name)
      .then((w) => { if (!cancelled) setWeather(w); })
      .catch(() => { if (!cancelled) setWeather(null); })
      .finally(() => { if (!cancelled) setWeatherLoading(false); });
    return () => { cancelled = true; };
  }, [shootLocation?.lat, shootLocation?.lng, shootLocation?.name]);

  const day = useMemo(() => productionDay(crew.start_date), [crew.start_date]);
  const tone = useMemo(() => TONE_STYLE[conditionTone(weather)], [weather]);

  if (!activeProject) {
    return (
      <section className="rounded-2xl border border-dashed border-border/50 bg-secondary/10 p-6 text-center">
        <Clapperboard className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-display text-lg">No active production</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick or create a production to sync Upload, Storage, and Activity.
        </p>
        {onSwitch && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onSwitch}>
            Choose production
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-secondary/10 to-background overflow-hidden">
      <div className="grid md:grid-cols-[220px_1fr] gap-0">
        {/* Cover */}
        <div className="relative bg-secondary/30 aspect-[3/2] md:aspect-auto md:min-h-full">
          {cover ? (
            <img src={cover} alt={`${activeProject.name} cover`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              <Clapperboard className="w-10 h-10 opacity-40" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">
                  Active Production
                </span>
                {crew.title_status && (
                  <span className="text-[10px] uppercase tracking-widest font-mono border rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-400/30">
                    {crew.title_status}
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl md:text-3xl leading-tight mt-1 truncate">
                {activeProject.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {crew.title_number && <span className="font-mono">{crew.title_number}</span>}
                {crew.content_type && <span>· {crew.content_type}</span>}
                {day && <span>· Day {day}</span>}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onIngest} className="bg-gradient-primary text-primary-foreground glow-primary">
                <UploadCloud className="w-4 h-4 mr-2" /> Ingest Media
              </Button>
              <Button onClick={onOpenLibrary} variant="outline">
                <Cloud className="w-4 h-4 mr-2" /> Open Library
              </Button>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Storage Used</p>
              <p className="font-display text-sm mt-1">
                {usedGb.toFixed(2)} GB<span className="text-muted-foreground"> / {totalGb.toFixed(0)} GB</span>
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Last Upload</p>
              <p className="font-display text-sm mt-1 truncate">
                {lastUpload
                  ? `${fmtBytes(lastUpload.bytes)} · ${new Date(lastUpload.at).toLocaleDateString()}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Content Type</p>
              <p className="font-display text-sm mt-1">{crew.content_type ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Status</p>
              <p className="font-display text-sm mt-1">{crew.title_status ?? "—"}</p>
            </div>
          </div>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2 text-xs">
            {onEdit && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Production
              </Button>
            )}
            {onSwitch && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSwitch}>
                <Repeat className="w-3.5 h-3.5 mr-1.5" /> Switch Production
              </Button>
            )}
          </div>

          {/* Production Conditions (weather) — hidden when no shoot location. */}
          {shootLocation?.lat && shootLocation?.lng && (
            <div className={`rounded-xl border p-3 ${tone.cls}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="font-medium">{shootLocation.name ?? "Shoot Location"}</span>
                  {weather && (
                    <span className="text-muted-foreground">
                      · {new Date(weather.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono uppercase tracking-widest">
                  {tone.dot} {tone.label}
                </span>
              </div>
              {weatherLoading ? (
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching conditions…
                </div>
              ) : weather ? (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5"><ThermometerSun className="w-3.5 h-3.5" /> {Math.round(weather.temperature)}°C</span>
                  <span className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> {weather.precipitation?.toFixed?.(1) ?? 0} mm rain</span>
                  <span className="flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" /> {Math.round(weather.windSpeed)} km/h</span>
                  <span className="flex items-center gap-1.5"><Sunrise className="w-3.5 h-3.5" /> {weather.sunrise?.slice(11, 16)} · <Sunset className="w-3.5 h-3.5 ml-1" /> {weather.sunset?.slice(11, 16)}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
