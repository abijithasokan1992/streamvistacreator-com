import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";

/**
 * Final CTA — single primary action, smart-linked for signed-in users so
 * multi-role master accounts route straight to their primary dashboard.
 */
export const FinalCta = () => {
  const { user, role, loading } = useAuth();
  const signedIn = !loading && !!user;
  const to = signedIn ? dashboardForRole(role) : "/auth?intent=signup";
  const label = signedIn ? "Open Your Dashboard" : "Create Your Workspace";
  const Icon = signedIn ? LayoutDashboard : ArrowRight;
  return (
    <section id="cta" className="py-20 sm:py-24 relative overflow-hidden">
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

          <div className="mt-8 flex justify-center">
            <Link
              to={to}
              className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-10 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
            >
              <span>{label}</span>
              <Icon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
