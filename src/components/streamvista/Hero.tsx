import { ArrowRight, Briefcase, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { dashboardForRole, useAuth } from "@/hooks/useAuth";

const SUBMIT_CONTENT_URL = "https://www.crayonsloop.com/login";

/**
 * Public Hero — one clear proposition and one canonical creator submission path.
 * Signed-in users continue to their StreamVista dashboard; new content owners
 * submit through the approved Crayons Loop intake.
 */
export const Hero = () => {
  const { role } = useAuth();
  const { signedIn, has, routeFor } = useUserRoles();
  const primaryTo = dashboardForRole(role);
  const primaryLabel = signedIn ? "Open Your Dashboard" : "Submit Content";
  const PrimaryIcon = signedIn ? LayoutDashboard : ArrowRight;
  const buyerTo = signedIn && has("buyer") ? routeFor("buyer", "/contact?topic=buyer-access") : "/contact?topic=buyer-access";
  const buyerLabel = signedIn && has("buyer") ? "Open Buyer Dashboard" : "I'm a Buyer · Request Access";

  const primaryClass = "cta-guide group h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md";

  return (
    <section className="relative pt-24 pb-12 sm:pt-28 sm:pb-20 md:pt-36 md:pb-24 overflow-hidden border-b border-border/40">
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
          <div className="flex items-center gap-3 mb-6 sm:mb-8 animate-fade-in">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em]">
              <span className="text-foreground font-bold">StreamVista</span>
              <span className="text-accent/80"> · Cloud X</span>
            </span>
          </div>

          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-[clamp(2.35rem,7vw,5.5rem)]">
            Connect Film Content Owners
            <br />
            with <span className="gradient-text">Global Buyers</span>
          </h1>

          <div className="mt-6 sm:mt-8 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed animate-fade-in">
            <p>
              StreamVista helps filmmakers, producers, studios and rights holders prepare rights-ready titles,
              reach qualified OTT, TV, FAST and digital buyers, and manage professional licensing and delivery workflows.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 animate-fade-in hero-button-container">
            {signedIn ? (
              <Link to={primaryTo} className={primaryClass}>
                <span>{primaryLabel}</span>
                <PrimaryIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <a href={SUBMIT_CONTENT_URL} className={primaryClass} aria-label="Submit content for licensing review">
                <span>{primaryLabel}</span>
                <PrimaryIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            )}
            <Link
              to={buyerTo}
              className="group h-14 w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 sm:px-8 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              <span>{buyerLabel}</span>
            </Link>
          </div>

          <p className="mt-5 max-w-2xl text-xs text-muted-foreground/80 leading-relaxed animate-fade-in">
            StreamVista provides professional connectivity and workflow support. Buyer response,
            licensing, distribution, release and revenue are not guaranteed.
          </p>

          <p className="mt-3 text-[11px] font-mono-tech uppercase tracking-[0.2em] text-muted-foreground/70 animate-fade-in">
            Film Sales · OTT & FAST Licensing · Satellite &amp; Digital Distribution Workflow
          </p>
        </div>
      </div>
    </section>
  );
};
