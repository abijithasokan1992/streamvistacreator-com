import { Check, Sparkles } from "lucide-react";
import { PLANS, type Cycle } from "./plans";
import { cn } from "@/lib/utils";

interface Props {
  selected: Cycle;
  onSelect: (c: Cycle) => void;
}

export const Pricing = ({ selected, onSelect }: Props) => (
  <section id="pricing" className="py-28 relative border-b border-border/40">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              [ Billing Cadence ]
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl">
            Choose your
            <br />
            <span className="gradient-text">cadence.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
          Same plan. Savings deepen with commitment. Switch any time — no lock-in.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 max-w-6xl mx-auto">
        {PLANS.map((p, i) => {
          const active = p.cycle === selected;
          return (
            <button
              key={p.cycle}
              onClick={() => onSelect(p.cycle)}
              className={cn(
                "relative text-left p-8 md:p-10 transition-all duration-300 animate-fade-in group",
                active
                  ? "bg-gradient-to-b from-primary/10 to-background"
                  : "bg-background hover:bg-primary/[0.04]"
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {p.badge && (
                <div className="absolute top-0 right-0 px-3 py-1.5 bg-gradient-gold text-accent-foreground text-[10px] font-bold uppercase tracking-[0.2em] glow-gold">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {p.badge}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-10">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {p.label}
                </div>
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all",
                    active ? "bg-primary border-primary glow-primary" : "border-border"
                  )}
                />
              </div>

              <div className="mb-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-display font-black text-5xl md:text-6xl tracking-tight",
                    active && "gradient-text"
                  )}
                >
                  {p.priceLabel}
                </span>
              </div>
              <div className="font-mono-tech text-[11px] uppercase tracking-widest text-muted-foreground mb-6">
                {p.cadence}
              </div>

              {p.savings && (
                <div className="inline-block px-2.5 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest mb-6">
                  {p.savings}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-8 leading-relaxed border-t border-border/60 pt-6">
                {p.description}
              </p>

              <ul className="space-y-3 text-sm">
                {["Scalable cloud storage", "Secure by default", "Protected sharing", "2 concurrent users", "Archive + onboarding"].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
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
