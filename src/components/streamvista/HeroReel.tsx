import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Star } from "lucide-react";

type ReelItem = {
  id: string;
  title: string;
  subtitle: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_featured: boolean | null;
};

const ROTATE_MS = 7000;

export function HeroReel() {
  const [items, setItems] = useState<ReelItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("homepage_hero_reel")
      .select("id,title,subtitle,poster_url,backdrop_url,image_url,cta_label,cta_url,is_featured")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        if (!active) return;
        setItems((data as ReelItem[]) ?? []);
        setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [items.length, paused]);

  const current = items[i];
  const next = items[(i + 1) % Math.max(items.length, 1)];

  // Preload upcoming backdrop for smooth crossfade
  useEffect(() => {
    if (!next) return;
    const url = next.backdrop_url || next.image_url || next.poster_url;
    if (!url) return;
    const img = new Image();
    img.src = url;
  }, [next]);

  const posterStrip = useMemo(() => items.slice(0, 8), [items]);

  if (!loaded || items.length === 0) return null;

  const backdrop = (it: ReelItem) =>
    it.backdrop_url || it.image_url || it.poster_url || "";
  const mobileImage = (it: ReelItem) =>
    it.poster_url || it.image_url || it.backdrop_url || "";

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) {
      setI(x => (x + (dx < 0 ? 1 : items.length - 1)) % items.length);
    }
    touchX.current = null;
  };

  return (
    <section
      aria-label="Featured titles"
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative h-[58vh] min-h-[440px] max-h-[760px] w-full overflow-hidden border-y border-border/40">
        {/* Layered cinematic backdrops with slow crossfade */}
        {items.map((it, k) => {
          const url = backdrop(it);
          const isActive = k === i;
          return (
            <div
              key={it.id}
              aria-hidden={!isActive}
              className="absolute inset-0 transition-opacity duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ opacity: isActive ? 1 : 0 }}
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  width={1920}
                  height={1080}
                  loading={k === 0 ? "eager" : "lazy"}
                  fetchPriority={isActive ? "high" : "auto"}
                  className="absolute inset-0 w-full h-full object-cover will-change-transform animate-[reel-pan_14s_ease-in-out_infinite_alternate]"
                  style={{ filter: "saturate(1.05) contrast(1.05)" }}
                />
              ) : (
                <div className="absolute inset-0 bg-secondary" />
              )}
            </div>
          );
        })}

        {/* Cinematic overlays: bottom-to-top, vignette, film grain */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-background/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background))_100%)]" />
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.07]"
             style={{ backgroundImage:
               "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")" }} />

        {/* Title card */}
        <div className="absolute inset-0 flex items-end">
          <div className="container pb-14 md:pb-20 relative">
            {current && (
              <div key={current.id} className="max-w-3xl animate-[reel-rise_900ms_ease-out_both]">
                <div className="flex items-center gap-3 mb-5">
                  <span className="inline-flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-[0.28em] text-accent px-3 py-1.5 rounded-full border border-accent/30 bg-accent/10 backdrop-blur-sm">
                    Featured Title · {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                  </span>
                  {current.is_featured && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-amber-300 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 backdrop-blur-sm shadow-[0_0_20px_-4px_rgba(251,191,36,0.25)]">
                      <Star className="w-3.5 h-3.5 fill-amber-300" /> Spotlight
                    </span>
                  )}
                </div>
                <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02] text-balance">
                  {current.title}
                </h2>
                {current.subtitle && (
                  <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
                    {current.subtitle}
                  </p>
                )}
                {current.cta_label && current.cta_url && (
                  <a
                    href={current.cta_url}
                    className="mt-7 inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm shadow-2xl hover:opacity-95 transition"
                  >
                    {current.cta_label} <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Side cinema bars */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 md:w-20 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 md:w-20 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* Poster strip / chapter selectors */}
      {items.length > 1 && (
        <div className="container -mt-10 md:-mt-14 relative z-10">
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 scrollbar-none">
            {posterStrip.map((it, k) => {
              const active = k === i;
              const thumb = it.poster_url || it.image_url || it.backdrop_url;
              return (
                <button
                  key={it.id}
                  onClick={() => setI(k)}
                  aria-label={`Show ${it.title}`}
                  className={`group relative shrink-0 rounded-xl overflow-hidden border transition-all duration-500 ${
                    active
                      ? "border-accent/80 ring-2 ring-accent/40 w-32 md:w-40 aspect-[2/3]"
                      : "border-border/40 hover:border-accent/40 w-24 md:w-28 aspect-[2/3] opacity-70 hover:opacity-100"
                  }`}
                >
                  {thumb ? (
                    <img src={thumb} alt={it.title} loading="lazy"
                         className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-secondary" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-background/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2 text-left">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-1">
                      {String(k + 1).padStart(2, "0")}
                    </div>
                    <div className="text-xs font-semibold line-clamp-2">{it.title}</div>
                  </div>
                  {active && (
                    <div className="absolute top-0 left-0 h-0.5 bg-accent animate-[reel-progress_7s_linear]"
                         style={{ animationPlayState: paused ? "paused" : "running" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes reel-pan {
          0%   { transform: scale(1.06) translate3d(0,0,0); }
          100% { transform: scale(1.12) translate3d(-1.5%, -1%, 0); }
        }
        @keyframes reel-rise {
          0%   { opacity: 0; transform: translateY(18px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes reel-progress {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }
      `}</style>
    </section>
  );
}

export default HeroReel;
