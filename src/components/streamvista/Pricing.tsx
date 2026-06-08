import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PLANS } from "./plans";
import { cn } from "@/lib/utils";

export const Pricing = () => (
  <section id="pricing" className="py-28 relative border-b border-border/40">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Plans
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl">
            Start free.
            <br />
            <span className="gradient-text">Grow on your terms.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
          Begin on the Free plan — upgrade from your account anytime. No lock-in.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 border border-border/60 max-w-6xl mx-auto">
        {PLANS.map((p, i) => {
          const isFree = p.cycle === "free";
          return (
            <div
              key={p.cycle}
              className="relative text-left p-7 md:p-8 transition-all duration-300 animate-fade-in group bg-background hover:bg-primary/[0.04]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {p.badge && (
                <div className={cn(
                  "absolute top-0 right-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]",
                  isFree ? "bg-accent/20 text-accent" : "bg-gradient-gold text-accent-foreground glow-gold"
                )}>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {p.badge}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-8">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {p.label}
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-border" />
              </div>

              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-display font-black text-4xl md:text-5xl tracking-tight">
                  {p.priceLabel}
                </span>
              </div>
              <div className="font-mono-tech text-[11px] uppercase tracking-widest text-muted-foreground mb-5">
                {p.cadence}
              </div>

              {p.savings && (
                <div className="inline-block px-2.5 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest mb-5">
                  {p.savings}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed border-t border-border/60 pt-5">
                {p.description}
              </p>

              <ul className="space-y-2.5 text-sm mb-8">
                {(isFree
                  ? ["Cloud storage to get started", "Secure file sharing", "Password & expiry on shares", "Upgrade anytime from your account"]
                  : ["Scalable cloud storage", "Secure by default", "Protected sharing", "2 concurrent users", "Archive + onboarding"]
                ).map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={`/auth?plan=${p.cycle}`}
                className="cta-guide group/btn relative h-12 w-full inline-flex items-center justify-center gap-2 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md"
              >
                <span>{isFree ? "Claim Free Workspace" : "Get Started"}</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);
