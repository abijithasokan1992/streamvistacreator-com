import { ArrowRight } from "lucide-react";

export const Hero = () => (
  <section className="relative pt-28 pb-12 overflow-hidden border-b border-border/40">
    {/* Atmospheric backdrops */}
    <div className="absolute inset-0 grid-bg opacity-60" />
    <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px]" />
    <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px]" />

    <div className="container relative">
      <div className="mb-10" />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
        {/* Editorial headline */}
        <div>
          <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(3.5rem,11vw,9rem)]">
            The Creator
            <br />
            Cloud
            <br />
            <span className="gradient-text">Built for cinema.</span>
          </h1>
        </div>

        {/* Sidebar copy + CTAs */}
        <div className="space-y-8 max-w-md">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Secure storage and collaboration —
            engineered for studios, VFX houses, post teams and independent creators.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="#pricing"
              className="group h-14 inline-flex items-center justify-between px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary"
            >
              View Launch Plan
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#onboard"
              className="h-14 inline-flex items-center justify-between px-6 border border-border text-foreground font-semibold uppercase tracking-[0.18em] text-xs hover:border-primary/60 transition-colors"
            >
              Start Onboarding
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

    </div>
  </section>
);
