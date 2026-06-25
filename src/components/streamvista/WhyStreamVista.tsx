import { Film, Layers, Briefcase } from "lucide-react";

/**
 * Why StreamVista — short value statements for the three audiences.
 * Intentionally minimal: no dashboard mechanics, no feature lists.
 */

const REASONS = [
  {
    icon: Film,
    audience: "For Creators",
    body: "Protect your master, hold your rights, present your title with cinema-grade polish.",
  },
  {
    icon: Layers,
    audience: "For Studios",
    body: "One vault for ingest, mastering, QC and delivery — without the toolchain sprawl.",
  },
  {
    icon: Briefcase,
    audience: "For Distributors & Buyers",
    body: "Discover ready titles, screen under NDA, and close deals with a full audit trail.",
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
          Built for the people who <span className="gradient-text">move titles</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {REASONS.map(({ icon: Icon, audience, body }) => (
          <article key={audience} className="bg-card p-7 md:p-8 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 inline-flex items-center justify-center mb-5">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg md:text-xl font-bold uppercase tracking-tight mb-3">{audience}</h3>
            <p className="text-sm md:text-[15px] text-text-secondary leading-relaxed">{body}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
