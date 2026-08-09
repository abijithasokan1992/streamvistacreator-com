import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";

const SUBMIT_CONTENT_URL = "https://www.crayonsloop.com/login";

/**
 * Final CTA — one primary creator action.
 * Signed-in users continue to their workspace; new submissions use the
 * approved Crayons Loop intake so the public homepage never offers competing
 * creator onboarding paths.
 */
export const FinalCta = () => {
  const { user, role, loading } = useAuth();
  const signedIn = !loading && !!user;
  const dashboardTo = dashboardForRole(role);
  const label = signedIn ? "Continue to your workspace" : "Submit Content";
  const Icon = signedIn ? LayoutDashboard : ArrowRight;
  const className = signedIn
    ? "group h-14 inline-flex items-center justify-center gap-3 px-10 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
    : "cta-guide group h-14 inline-flex items-center justify-center gap-3 px-10 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md";

  const content = (
    <>
      <span>{label}</span>
      <Icon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </>
  );

  return (
    <section id="cta" className="py-20 sm:py-24 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-[0.07]" aria-hidden />
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[50rem] h-[50rem] rounded-full bg-primary/15 blur-[160px]"
        aria-hidden
      />
      <div className="container relative">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl lg:text-7xl">
            Ready to license
            <br />
            <span className="gradient-text">your content?</span>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
            Start with your title details and rights ownership. StreamVista will review readiness before any licensing or distribution step.
          </p>

          <div className="mt-8 sm:mt-10 flex justify-center">
            {signedIn ? (
              <Link to={dashboardTo} className={className}>{content}</Link>
            ) : (
              <a href={SUBMIT_CONTENT_URL} className={className} aria-label="Submit content for licensing review">{content}</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
