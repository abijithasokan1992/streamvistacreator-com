import { Check, Sparkles } from "lucide-react";
import { PLANS, type Cycle } from "./plans";
import { cn } from "@/lib/utils";

interface Props {
  selected: Cycle;
  onSelect: (c: Cycle) => void;
}

export const Pricing = ({ selected, onSelect }: Props) => (
  <section id="pricing" className="py-24 relative">
    <div className="container">
      <div className="text-center max-w-2xl mx-auto mb-14 animate-fade-in">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-4">Pricing</div>
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
          Choose your <span className="gradient-text">billing cadence</span>
        </h2>
        <p className="text-muted-foreground">Same plan, the savings grow with your commitment.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((p, i) => {
          const active = p.cycle === selected;
          return (
            <button
              key={p.cycle}
              onClick={() => onSelect(p.cycle)}
              className={cn(
                "relative text-left rounded-3xl p-8 transition-all duration-500 animate-scale-in group",
                active
                  ? "glass-strong glow-primary -translate-y-2 border-primary/60"
                  : "glass hover:-translate-y-1 hover:border-primary/30"
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-gold text-accent-foreground text-[11px] font-bold uppercase tracking-wider glow-gold">
                  <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />{p.badge}</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{p.label}</div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 transition-all",
                  active ? "bg-primary border-primary glow-primary" : "border-border"
                )} />
              </div>

              <div className="mb-2 flex items-baseline gap-2">
                <span className={cn("font-display font-bold text-4xl md:text-5xl", active && "gradient-text")}>
                  {p.priceLabel}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-5">{p.cadence}</div>

              {p.savings && (
                <div className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-5">
                  {p.savings}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{p.description}</p>

              <ul className="space-y-2.5 text-sm">
                {["50 TB launch allocation", "India region", "99.9% uptime SLA", "2 concurrent users", "Archive + onboarding"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  </section>
);
