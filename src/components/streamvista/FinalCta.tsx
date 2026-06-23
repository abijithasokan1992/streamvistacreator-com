import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Final CTA — the close on the homepage. Two doors:
 *   • Request access  → /auth?intent=signup
 *   • Talk to StreamVista → /contact (founder-assisted)
 */
export const FinalCta = () => (
  <section id="cta" className="py-24 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-primary opacity-[0.07]" aria-hidden />
    <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[50rem] h-[50rem] rounded-full bg-primary/15 blur-[160px]" aria-hidden />
    <div className="container relative">
      <div className="max-w-4xl mx-auto text-center animate-fade-in">
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
          Ready when you are
        </span>
        <h2 className="mt-6 font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl lg:text-7xl">
          Move your next title
          <br />
          <span className="gradient-text">through StreamVista.</span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Whether you are a filmmaker bringing a new title in, a studio running daily
          operations, or a buyer looking for rights — start the conversation in the way
          that fits you.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/auth?intent=signup"
            className="cta-guide group h-14 inline-flex items-center justify-center gap-3 px-8 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
          >
            <span>Request access</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/contact"
            className="group h-14 inline-flex items-center justify-center gap-3 px-8 border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors"
          >
            <span>Talk to StreamVista</span>
          </Link>
        </div>
      </div>
    </div>
  </section>
);
