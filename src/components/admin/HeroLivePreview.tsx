import { useEffect, useRef, useState } from "react";
import { Loader2, Image as ImageIcon, Layers, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HeroBanner = {
  id: string;
  headline: string | null;
  subheadline: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta2_label: string | null;
};

type Settings = {
  mode: "single" | "slider";
  autoplay: boolean;
  interval_ms: number;
  pause_on_hover: boolean;
};

const DEFAULTS: Settings = {
  mode: "single",
  autoplay: true,
  interval_ms: 5000,
  pause_on_hover: true,
};

const nonEmpty = (v: string | null | undefined) => (v && v.trim() ? v : null);

/**
 * Admin-only preview widget. Renders a scaled simulation of the public homepage
 * hero using the actual `hero_banners` rows and `homepage_hero_settings` row,
 * with a local override so admins can compare Single vs Slider without saving.
 */
export function HeroLivePreview() {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [saved, setSaved] = useState<Settings>(DEFAULTS);
  const [override, setOverride] = useState<"saved" | "single" | "slider">("saved");
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: cfg }] = await Promise.all([
      (supabase as any)
        .from("hero_banners")
        .select("id,headline,subheadline,image_url,cta_label,cta2_label,sort_order,is_active,status")
        .eq("is_active", true)
        .eq("status", "published")
        .order("sort_order")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("homepage_hero_settings")
        .select("mode,autoplay,interval_ms,pause_on_hover")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setBanners((rows as HeroBanner[]) ?? []);
    if (cfg) setSaved({ ...DEFAULTS, ...cfg });
    setLoading(false);
    setIndex(0);
  };

  useEffect(() => {
    load();
  }, []);

  const effectiveMode: "single" | "slider" =
    override === "saved" ? saved.mode : override;
  const slides = effectiveMode === "slider" ? banners : banners.slice(0, 1);
  const isSlider = effectiveMode === "slider" && slides.length > 1;

  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isSlider || !saved.autoplay || (paused && saved.pause_on_hover)) return;
    intervalRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, saved.interval_ms);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isSlider, saved.autoplay, saved.interval_ms, saved.pause_on_hover, slides.length, paused]);

  // Keep index in range when slide set changes
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const current = slides[index];

  return (
    <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-accent" />
          <p className="text-xs font-semibold uppercase tracking-wider">
            Live Hero Preview
          </p>
          <span className="text-[10px] text-muted-foreground">
            {banners.length} published · saved mode: <strong>{saved.mode}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ModeChip active={override === "saved"} onClick={() => setOverride("saved")} label="Saved" />
          <ModeChip active={override === "single"} onClick={() => setOverride("single")} icon={<ImageIcon className="w-3 h-3" />} label="Single" />
          <ModeChip active={override === "slider"} onClick={() => setOverride("slider")} icon={<Layers className="w-3 h-3" />} label="Slider" />
          <button
            onClick={load}
            className="ml-1 h-7 w-7 grid place-items-center rounded-md border border-border hover:bg-secondary"
            aria-label="Refresh preview"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        className="relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-border/60 bg-background"
        onMouseEnter={() => isSlider && saved.pause_on_hover && setPaused(true)}
        onMouseLeave={() => isSlider && saved.pause_on_hover && setPaused(false)}
      >
        {loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : slides.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
            No Published + Active banners to preview.
          </div>
        ) : (
          <>
            {slides.map((s, i) => {
              const img = nonEmpty(s.image_url);
              const isCurrent = i === index;
              return (
                <div
                  key={s.id}
                  className="absolute inset-0 transition-opacity duration-[1000ms] ease-in-out"
                  style={{ opacity: isCurrent ? 1 : 0 }}
                  aria-hidden={!isCurrent}
                >
                  {img ? (
                    <img
                      src={img}
                      alt={s.headline ?? "Hero"}
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary to-background" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/50 to-background" />
                  <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-end">
                    {s.headline && (
                      <div className="font-display font-black uppercase leading-[0.9] tracking-tight text-base sm:text-2xl md:text-3xl line-clamp-2 max-w-[80%]">
                        {s.headline}
                      </div>
                    )}
                    {s.subheadline && (
                      <p className="mt-2 text-[11px] sm:text-xs text-muted-foreground line-clamp-2 max-w-md">
                        {s.subheadline}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {nonEmpty(s.cta_label) && (
                        <span className="h-6 px-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded bg-gradient-primary text-primary-foreground">
                          {s.cta_label}
                        </span>
                      )}
                      {nonEmpty(s.cta2_label) && (
                        <span className="h-6 px-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider rounded border border-border/70">
                          {s.cta2_label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isSlider && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Show slide ${i + 1}`}
                    className={`h-1 rounded-full transition-all ${
                      i === index ? "w-6 bg-accent" : "w-2.5 bg-border hover:bg-muted-foreground/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Preview mirrors the public hero using current banners and saved slider settings (autoplay {saved.autoplay ? "on" : "off"}, {saved.interval_ms}ms{saved.pause_on_hover ? ", pause on hover" : ""}). Override above is preview-only — change the saved mode in <em>Hero Mode</em> above.
        {current?.headline ? ` Showing: ${current.headline}` : ""}
      </p>
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-md border text-[11px] transition ${
        active
          ? "border-accent/70 bg-accent/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
