import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public hero — minimal, premium, 3-door routing.
 * Hero is short by design. Surfaces live in <RoleSurfaces />.
 */
export const Hero = () => (
  <section className="relative pt-28 pb-20 md:pb-28 overflow-hidden border-b border-border/40">
    <div className="absolute inset-0 grid-bg opacity-60" />
    <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px]" />
    <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px]" />

    <div className="container relative">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/5 mb-8 animate-fade-in">
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
          StreamVista Cloud X
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
        <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
          ONE SECURE CLOUD
          <br />
          FOR CINEMA &amp;
          <br />
          <span className="gradient-text">SERIES IP.</span>
        </h1>

        <div className="space-y-7 max-w-md">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Intake, storage, operations and licensing — in one operating layer.
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
