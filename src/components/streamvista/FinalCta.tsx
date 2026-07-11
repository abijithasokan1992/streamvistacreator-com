import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Final CTA — single primary action per Sprint 001.
 */
export const FinalCta = () => (
  <section id="cta" className="py-28 relative overflow-hidden">
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

        <div className="mt-12 flex justify-center">
          <Link
            to="/auth?intent=signup"
            className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-10 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
          >
            <span>Create Your Workspace</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  </section>
);
