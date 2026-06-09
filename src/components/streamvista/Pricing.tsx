import { Check, Sparkles, ArrowRight, Infinity as InfinityIcon } from "lucide-react";
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
              Simple pricing · Pay-As-You-Go
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl">
            Two plans.
            <br />
            <span className="gradient-text">Zero surprises.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          Start with 128 GB free. When your footage grows past 1 TB on Creator, the next TB unlocks
          automatically at the same ₹767 — no contracts, no overage shock.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-border/60 border border-border/60 max-w-5xl mx-auto">
        {PLANS.map((p, i) => {
          const isFree = p.cycle === "free";
          return (
            <div
              key={p.cycle}
              className="relative text-left p-7 md:p-10 transition-all duration-300 animate-fade-in group bg-background hover:bg-primary/[0.04]"
              style={{ animationDelay: `${i * 100}ms` }}
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
                <span className="font-display font-black text-5xl md:text-6xl tracking-tight">
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

              <div className="grid gap-2 mb-6">
                <div className="flex items-center gap-2 text-xs font-mono-tech uppercase tracking-widest text-accent">
                  <InfinityIcon className="w-3.5 h-3.5" />
                  {p.storageLabel}
                </div>
                <div className="text-xs text-muted-foreground">{p.bandwidthLabel}</div>
              </div>

              <ul className="space-y-2.5 text-sm mb-8">
                {p.features.map((f) => (
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
                <span>{isFree ? "Start free — 128 GB" : "Get 1 TB · ₹767/mo"}</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
        Free plan bandwidth overage is billed only when you exceed 500 GB / month at ₹10 / GB.
        Creator plan auto-scales storage — each extra TB is added on demand at ₹650 + 18% GST.
      </p>
    </div>
  </section>
);
