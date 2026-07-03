import { Film, Layers, Briefcase, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Why StreamVista — compact value cards, one sentence + one CTA each.
 */

const REASONS = [
  {
    icon: Film,
    audience: "Protect & Collaborate",
    body: "Safeguard intellectual property and collaborate securely with approved partners.",
    cta: { label: "Enter Creator", to: "/auth?intent=signup&role=content_owner" },
  },
  {
    icon: Layers,
    audience: "Accelerate Distribution",
    body: "Move titles from production to delivery faster across every channel.",
    cta: { label: "Enter Studio", to: "/auth?intent=signup&role=studio" },
  },
  {
    icon: Briefcase,
    audience: "Close Deals & Grow Revenue",
    body: "Discover ready titles, close licensing deals and unlock new revenue opportunities.",
    cta: { label: "Enter Buyer", to: "/auth?intent=signup&role=buyer" },
  },
];

export const WhyStreamVista = () => (
  <section id="why" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-12 animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Why StreamVista</span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Built to grow your <span className="gradient-text">media business</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {REASONS.map(({ icon: Icon, audience, body, cta }) => (
          <article key={audience} className="bg-card p-7 md:p-8 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 inline-flex items-center justify-center mb-5">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg md:text-xl font-bold uppercase tracking-tight mb-3">{audience}</h3>
            <p className="text-sm md:text-[15px] text-text-secondary leading-relaxed mb-6">{body}</p>
            <Link
              to={cta.to}
              className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent hover:text-foreground transition-colors"
            >
              {cta.label} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </div>
  </section>
);
