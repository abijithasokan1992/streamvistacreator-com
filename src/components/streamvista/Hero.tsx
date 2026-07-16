import { ArrowRight, Briefcase, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

/**
 * Public Hero — cinematic single hero.
 * P0: broken "60-second overview" removed.
 * P1: role-aware secondary CTA for buyers; brand hierarchy on eyebrow.
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
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden border-b border-border/40">
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
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em]">
              <span className="text-foreground font-bold">StreamVista</span>
              <span className="text-accent/80"> · Cloud X</span>
            </span>
          </div>

          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-[clamp(2.6rem,8vw,6.5rem)]">
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

      <div className="mt-12 flex flex-col sm:flex-row gap-3 animate-fade-in hero-button-container">
        <Link
          to={primaryTo}
          className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
        >
          <span>{primaryLabel}</span>
          <PrimaryIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          to={buyerTo}
          className="group h-14 inline-flex items-center justify-center gap-3 px-8 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
        >
          <Briefcase className="w-4 h-4" />
          <span>{buyerLabel}</span>
        </Link>
      </div>

          <p className="mt-5 text-[11px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground/70 animate-fade-in">
            Enterprise B2B Distribution · High-Speed Master Ingest · Secure Multi-Platform Delivery
          </p>
        </div>
      </div>
    </section>
  );
};
