import { useEffect, useState } from "react";
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
};

/**
 * Public hero — minimal, premium, single-slide.
 * Optionally overlays an admin-managed `hero_banners` row (first active by
 * sort_order). Falls back to the static StreamVista flagship copy.
 */
export const Hero = () => {
  const [banner, setBanner] = useState<HeroBanner | null>(null);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("hero_banners")
      .select("id,headline,subheadline,image_url,cta_label,cta_url")
      .eq("is_active", true)
      .eq("status", "published")
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (active && data) setBanner(data as HeroBanner);
      });
    return () => {
      active = false;
    };
  }, []);

  const subtitle =
    banner?.subheadline ??
    "Intake, storage, operations and licensing in one secure operating layer";
  const ctaLabel = banner?.cta_label ?? "Get Started";
  const ctaHref = banner?.cta_url ?? "/auth?intent=signup";

  return (
  <section className="relative pt-28 pb-20 md:pb-28 overflow-hidden border-b border-border/40">
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
        {banner?.headline?.startsWith("STREAMVISTA HERO DEMO") && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/50 bg-amber-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-amber-400">
              Demo hero from CMS
            </span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
        {banner?.headline ? (
          <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
            {banner.headline}
          </h1>
        ) : (
          <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
            ONE SECURE CLOUD
            <br />
            FOR FILMS, SERIES
            <br />
            <span className="gradient-text">&amp; SHOWS</span>
          </h1>
        )}

        <div className="space-y-7 max-w-md">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={ctaHref}
              className="cta-guide group relative h-14 inline-flex items-center justify-center gap-3 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1"
            >
              <span>{ctaLabel}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/contact"
              className="group relative h-14 inline-flex items-center justify-center gap-3 px-6 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md flex-1 transition-colors"
            >
              <span>Talk to StreamVista</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};
