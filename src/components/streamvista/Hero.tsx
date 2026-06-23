import { ArrowRight, Film, Layers, Briefcase, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustBadges } from "./TrustBadges";

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
        </div>

        <div className="space-y-7 max-w-md">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            StreamVista is the operating layer for cinema and series IP — title intake,
            recurring storage, post / vault workflows and commercial requests for buyers,
            built for creators, studios and acquisition teams in one platform.
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

      {/* 3-surface strip — Creator / Studio / Buyer */}
      <h2 className="sr-only">Three surfaces: Creator, Studio, Buyer</h2>
      <div className="mt-16 grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden animate-fade-in">
        {[
          {
            icon: Film,
            step: "Creator",
            title: "Submit titles",
            body: "Bring films, metadata, posters, trailers and master files into one secure pipeline. Start free with 5 GB; add recurring 1 TB storage blocks as your catalog grows.",
          },
          {
            icon: Layers,
            step: "Studio",
            title: "Run operations",
            body: "Vault, ingest, mastering and delivery workflows for post houses and production teams. Plan changes handled by our team.",
          },
          {
            icon: Briefcase,
            step: "Licensing",
            title: "Request rights",
            body: "Acquisition teams, OTT and distributors submit screener, licensing and rights requests behind an NDA gate and track every conversation.",
          },
        ].map(({ icon: Icon, step, title, body }) => (
          <div key={step} className="bg-background p-6 md:p-7">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">{step}</span>
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-bold mb-1.5">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
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
