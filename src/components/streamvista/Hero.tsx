import { ArrowRight, Film, Layers, Briefcase, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustBadges } from "./TrustBadges";
import { HeroStudioIdent } from "./HeroStudioIdent";

/**
 * Public hero — three-audience platform statement.
 *
 * The MVP truth this hero communicates:
 *   • Creator: title submission + storage + delivery workflow
 *   • Studio: vault / service / managed operations
 *   • Buyer:  rights / screener / acquisition request workflow
 *
 * No fake "self-serve OTT empire" copy. Primary CTA → sign up.
 * Secondary CTA → "Talk to StreamVista" (founder-assisted path via /contact).
 */
export const Hero = () => (
  <section className="relative pt-28 pb-16 overflow-hidden border-b border-border/40">
    <div className="absolute inset-0 grid-bg opacity-60" />
    <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px]" />
    <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px]" />

    <div className="container relative">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/5 mb-8 animate-fade-in">
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
          Made in India · For cinema operators
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
        <div>
          <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(2.4rem,8.4vw,7rem)]">
            ONE SECURE
            <br />
            CINEMA &amp; CONTENT CLOUD
            <br />
            <span className="gradient-text">FROM INTAKE TO DEAL.</span>
          </h1>

          {/* Studio ident — cycling logo showcase */}
          <div className="mt-10 lg:hidden">
            <HeroStudioIdent />
          </div>
        </div>


        <div className="space-y-7 max-w-md">
          <div className="hidden lg:block -mt-4">
            <HeroStudioIdent />
          </div>

          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            The operating layer for cinema and series IP — intake, storage, post and commercial workflows, in one platform.
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

      {/* 3-surface strip — Creator / Studio / Licensing (Projection Glass) */}
      <h2 className="sr-only">Three surfaces: Creator, Studio, Licensing</h2>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 animate-fade-in">
        {[
          {
            icon: Film,
            step: "Creator",
            title: "Submit titles",
            body: "Films, metadata, posters and masters in one secure pipeline. 5 GB free, +1 TB blocks as you grow.",
          },
          {
            icon: Layers,
            step: "Studio",
            title: "Run operations",
            body: "Vault, ingest, mastering and delivery for post and production teams.",
          },
          {
            icon: Briefcase,
            step: "Licensing",
            title: "Request rights",
            body: "Screener, licensing and rights requests behind an NDA gate — every conversation tracked.",
          },
        ].map(({ icon: Icon, step, title, body }) => (
          <div
            key={step}
            className="group relative overflow-hidden rounded-2xl border border-border-strong/60 glass p-7 md:p-9 transition-all duration-500 hover:border-primary/60 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.45)]"
          >
            {/* Top-edge highlight — embossed lip */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
            {/* Projection-glass sheen */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-foreground/[0.06] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            {/* Corner aura — picks up brand primary on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{ background: "radial-gradient(circle, hsl(var(--primary-glow) / 0.35), transparent 70%)" }}
            />
            <div className="relative z-10 space-y-6">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl text-primary-foreground border border-primary/30 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[-3deg]"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow:
                    "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 10px 24px -8px hsl(var(--primary) / 0.55)",
                }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="pill-attention mb-3">{step}</span>
                <h3 className="font-display text-3xl md:text-[2rem] font-black text-foreground tracking-tight mt-3 mb-3 leading-[1.05]">
                  {title}
                </h3>
                <p className="text-[15px] text-text-secondary leading-relaxed font-medium">
                  {body}
                </p>
              </div>
            </div>
          </div>
        ))}

      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Trusted infrastructure
        </span>
        <TrustBadges compact />
      </div>
    </div>
  </section>
);
