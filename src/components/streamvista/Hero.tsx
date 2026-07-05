import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type HeroBanner = {
  id: string;
  headline: string;
  subheadline: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  cta2_label: string | null;
  cta2_url: string | null;
};

type HeroSettings = {
  mode: "single" | "slider";
  autoplay: boolean;
  interval_ms: number;
  pause_on_hover: boolean;
};

const DEFAULT_SETTINGS: HeroSettings = {
  mode: "single",
  autoplay: true,
  interval_ms: 5000,
  pause_on_hover: true,
};

const nonEmpty = (v: string | null | undefined) => (v && v.trim() ? v : null);

/**
 * Public hero — premium, admin-driven.
 * Reads `homepage_hero_settings` to decide between Single (lowest sort_order)
 * and Slider (fade through all published + active rows in sort order).
 */
export const Hero = () => {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_SETTINGS);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: rows }, { data: cfg }] = await Promise.all([
        (supabase as any)
          .from("hero_banners")
          .select("id,headline,subheadline,image_url,cta_label,cta_url,cta2_label,cta2_url")
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
      if (!active) return;
      if (rows) setBanners(rows as HeroBanner[]);
      if (cfg) setSettings({ ...DEFAULT_SETTINGS, ...cfg });
    })();
    return () => {
      active = false;
    };
  }, []);

  // Effective slide set: in single mode, only the first banner.
  const slides = settings.mode === "slider" ? banners : banners.slice(0, 1);

  // Autoplay
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (
      settings.mode !== "slider" ||
      !settings.autoplay ||
      slides.length < 2 ||
      (paused && settings.pause_on_hover)
    ) {
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, settings.interval_ms);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [settings, slides.length, paused]);

  const current = slides[index] ?? null;

  const subtitle =
    nonEmpty(current?.subheadline) ??
    "Manage, protect, distribute, license and monetize professional media through one connected platform.";
  const ctaLabel = nonEmpty(current?.cta_label) ?? "Get Started";
  const ctaHref = nonEmpty(current?.cta_url) ?? "/auth?intent=signup";
  const cta2Label = nonEmpty(current?.cta2_label) ?? "Book a Demo";
  const cta2Href = nonEmpty(current?.cta2_url) ?? "/contact?intent=demo";
  const isSlider = false;
  

  return (
    <section
      className="relative pt-28 pb-20 md:pb-28 overflow-hidden border-b border-border/40"
      onMouseEnter={() => isSlider && settings.pause_on_hover && setPaused(true)}
      onMouseLeave={() => isSlider && settings.pause_on_hover && setPaused(false)}
    >
      {/* Crossfade background layer per slide */}
      {slides.map((s, i) => {
        const img = nonEmpty(s.image_url);
        if (!img) return null;
        return (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            <img
              src={img}
              alt={s.headline ?? "StreamVista hero"}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
              width={1920}
              height={1080}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background md:from-background/10 md:via-background/5" />
          </div>
        );
      })}
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px]" />

      <div className="container relative">
        <div className="flex flex-wrap items-center gap-2 mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/5">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
              StreamVista Cloud X
            </span>
          </div>
        </div>

        {/* Crossfade copy layer per slide */}
        <div className="relative">
          {slides.length === 0 && <FallbackCopy />}
          {slides.map((s, i) => {
            const isCurrent = i === index;
            return (
              <div
                key={s.id}
                className={`grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end transition-opacity duration-[1000ms] ease-in-out ${
                  isCurrent ? "relative opacity-100" : "absolute inset-0 opacity-0 pointer-events-none"
                }`}
                aria-hidden={!isCurrent}
              >
                {s.headline ? (
                  isCurrent ? (
                    <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
                      {s.headline}
                    </h1>
                  ) : (
                    <h2 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
                      {s.headline}
                    </h2>
                  )
                ) : (
                  <DefaultHeadline />
                )}

                <div className="space-y-7 max-w-md">
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                    {nonEmpty(s.subheadline) ?? subtitle}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      to={nonEmpty(s.cta_url) ?? ctaHref}
                      className="cta-guide group relative h-14 inline-flex items-center justify-center gap-3 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1"
                    >
                      <span>{nonEmpty(s.cta_label) ?? ctaLabel}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      to={nonEmpty(s.cta2_url) ?? cta2Href}
                      className="group relative h-14 inline-flex items-center justify-center gap-3 px-6 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1 transition-colors"
                    >
                      <span>{nonEmpty(s.cta2_label) ?? cta2Label}</span>
                    </Link>
                  </div>
                  <TrustStrip />
                </div>
              </div>
            );
          })}
        </div>

        {isSlider && (
          <div className="mt-10 flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Show hero ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-accent" : "w-4 bg-border hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const TRUST_LABELS = [
  "Asset Management",
  "Rights Management",
  "Distribution",
  "Marketplace",
  "Revenue Intelligence",
];

const TrustStrip = () => (
  <div className="mt-10 flex flex-wrap gap-2">
    {TRUST_LABELS.map((label) => (
      <span
        key={label}
        className="inline-flex items-center px-3 py-1.5 rounded-full border border-border/60 bg-background/40 backdrop-blur-sm font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {label}
      </span>
    ))}
  </div>
);

const DefaultHeadline = () => (
  <div>
    <div className="mb-6 font-mono-tech text-[11px] uppercase tracking-[0.3em] text-accent">
      StreamVista Cloud X
    </div>
    <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,7.6vw,6rem)]">
      The Digital Media
      <br />
      <span className="gradient-text">Business Platform</span>
    </h1>
  </div>
);

const FallbackCopy = () => (
  <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
    <DefaultHeadline />
    <div className="space-y-7 max-w-md">
      <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
        Manage, protect, distribute, license and monetize professional media through one connected platform.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/auth?intent=signup"
          className="cta-guide group relative h-14 inline-flex items-center justify-center gap-3 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          to="/contact?intent=demo"
          className="group relative h-14 inline-flex items-center justify-center gap-3 px-6 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1 transition-colors"
        >
          <span>Book a Demo</span>
        </Link>
      </div>
      <TrustStrip />
    </div>
  </div>
);
