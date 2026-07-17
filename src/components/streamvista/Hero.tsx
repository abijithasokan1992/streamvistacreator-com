import { ArrowRight, Briefcase, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";
import { BRAND_NAME_SHORT, BRAND_SECONDARY, BRAND_TAGLINE } from "@/lib/brand";

/**
 * Public Hero — widescreen "opening shot".
 * Letterboxed cinematic bars, warm gold accent, ambient light-leak overlay,
 * and a serif display H1 that lands like a title card. Body copy remains
 * in the app's existing sans face for readability.
 *
 * All motion respects prefers-reduced-motion (see .sv-reveal in index.css).
 * No video backgrounds, no heavy image payloads.
 */
export const Hero = () => {
  const { role } = useAuth();
  const { signedIn, has, routeFor } = useUserRoles();
  const primaryTo = signedIn ? dashboardForRole(role) : "/auth?intent=signup";
  const primaryLabel = signedIn ? "Open Your Dashboard" : "Get Started · I'm a Creator";
  const PrimaryIcon = signedIn ? LayoutDashboard : ArrowRight;
  const buyerTo = signedIn && has("buyer") ? routeFor("buyer", "/contact?topic=buyer-access") : "/contact?topic=buyer-access";
  const buyerLabel = signedIn && has("buyer") ? "Open Buyer Dashboard" : "I'm a Buyer · Request Access";

  return (
    <section
      className="hero-letterbox relative pt-28 pb-16 sm:pt-32 sm:pb-24 md:pt-40 md:pb-32 overflow-hidden border-b border-border/40"
      aria-labelledby="sv-hero-heading"
    >
      {/* Very-low-opacity light leak — pure CSS gradients, GPU cheap. */}
      <div className="light-leak" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-[0.18]" aria-hidden />

      <div className="container relative z-[3]">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <div className="w-10 h-px bg-cine-gold" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em]">
              <span className="text-foreground font-bold">{BRAND_NAME_SHORT}</span>
              <span className="text-cine-gold"> · {BRAND_SECONDARY}</span>
            </span>
          </div>

          <h1
            id="sv-hero-heading"
            className="h-cine text-[clamp(2.6rem,7.5vw,6rem)] text-foreground animate-fade-in"
          >
            Connect Film Content Owners
            <br />
            with <span className="text-cine-gold italic">Global Buyers</span>
          </h1>

          <p className="mt-6 font-mono-tech text-[11px] uppercase tracking-[0.28em] text-cine-gold/90 animate-fade-in">
            {BRAND_TAGLINE}
          </p>

          <div className="mt-8 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed space-y-3 animate-fade-in">
            <p>
              StreamVista connects creators, filmmakers, producers, studios and rights holders with
              verified OTT platforms, broadcasters, satellite television, FAST channels,
              distributors and digital streaming services worldwide.
            </p>
            <p>
              Prepare rights-ready catalogues, present your films, series and documentaries to
              qualified buyers, and run professional delivery workflows in one place.
            </p>
          </div>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row gap-3 animate-fade-in hero-button-container">
            <Link
              to={primaryTo}
              className="cta-guide group h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
            >
              <span>{primaryLabel}</span>
              <PrimaryIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to={buyerTo}
              className="group h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-8 border border-cine-gold hover:bg-cine-gold/10 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              <span>{buyerLabel}</span>
            </Link>
          </div>

          <p className="mt-6 max-w-2xl text-xs text-muted-foreground/80 leading-relaxed animate-fade-in">
            StreamVista provides professional connectivity and workflow support. Buyer response,
            licensing, distribution, release and revenue are not guaranteed.
          </p>

          <p className="mt-4 text-[11px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground/70 animate-fade-in">
            Film Sales · OTT & FAST Licensing · Satellite &amp; Digital Distribution Workflow
          </p>
        </div>
      </div>

      {/* Scene-cut divider at the base of the hero */}
      <div className="scene-divider absolute bottom-3 left-1/2 -translate-x-1/2 z-[3]" aria-hidden />
    </section>
  );
};
