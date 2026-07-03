import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Final CTA — closing conversion block. Two doors:
 *   • Get Started → /auth?intent=signup
 *   • Book a Demo → /contact
 */
export const FinalCta = () => (
  <section id="cta" className="py-24 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-primary opacity-[0.07]" aria-hidden />
    <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[50rem] h-[50rem] rounded-full bg-primary/15 blur-[160px]" aria-hidden />
    <div className="container relative">
      <div className="max-w-4xl mx-auto text-center animate-fade-in">
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl lg:text-7xl">
          Ready to grow your
          <br />
          <span className="gradient-text">media business?</span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Manage assets, collaborate with partners, distribute content and unlock new revenue opportunities through one connected platform.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/auth?intent=signup"
            className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/contact?intent=demo"
            className="group h-14 inline-flex items-center justify-center gap-3 px-8 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
          >
            <span>Book a Demo</span>
          </Link>
        </div>
      </div>
    </div>
  </section>
);
