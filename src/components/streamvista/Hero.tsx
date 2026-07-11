import { useState } from "react";
import { ArrowRight, Play, X } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public Hero — Sprint 001 rebuild.
 * Single cinematic hero. One primary CTA + one secondary (overview video).
 */
export const Hero = () => {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden border-b border-border/40">
      {/* Ambient cinematic backdrop */}
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(900px 500px at 85% 90%, hsl(var(--accent) / 0.14), transparent 60%)",
        }}
      />
      <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[140px]" aria-hidden />
      <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[160px]" aria-hidden />

      <div className="container relative">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              StreamVista Cloud X
            </span>
          </div>

          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-[clamp(2.6rem,8vw,6.5rem)] animate-fade-in">
            Own a Film, Series
            <br />
            or <span className="gradient-text">Documentary?</span>
          </h1>

          <div className="mt-8 max-w-2xl text-base md:text-xl text-muted-foreground leading-relaxed space-y-1.5 animate-fade-in">
            <p>Upload your content.</p>
            <p>Protect your rights.</p>
            <p>Connect with verified buyers.</p>
            <p>License globally through one secure platform.</p>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-3 animate-fade-in">
            <Link
              to="/auth?intent=signup"
              className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="group h-14 inline-flex items-center justify-center gap-3 px-8 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Watch 60-Second Overview</span>
            </button>
          </div>
        </div>
      </div>

      {videoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="StreamVista 60-second overview"
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden border border-border/60 bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              aria-label="Close overview video"
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-background/70 hover:bg-background border border-border/60 grid place-items-center"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-full h-full grid place-items-center text-center px-8">
              <div>
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent mb-3">
                  Overview
                </div>
                <p className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                  60-second overview video coming soon
                </p>
                <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                  We're finalising the platform reel. In the meantime, create a free workspace to explore StreamVista end-to-end.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
