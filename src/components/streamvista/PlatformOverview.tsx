import { Film, Layers, Briefcase, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public Platform Overview — merged value proposition + workspace entry.
 * Each card pairs the "why" with the matching workspace CTA.
 */

const SURFACES = [
  {
    key: "creator",
    title: "Creator Workspace",
    icon: Film,
    headline: "Protect & Collaborate",
    pitch:
      "Safeguard intellectual property, manage titles and metadata, and collaborate securely with approved partners.",
    cta: { label: "Enter Creator", to: "/auth?intent=signup&role=content_owner" },
  },
  {
    key: "studio",
    title: "Studio Workspace",
    icon: Layers,
    headline: "Accelerate Distribution",
    pitch:
      "Run production, media operations and delivery — move titles from set to platform faster across every channel.",
    cta: { label: "Enter Studio", to: "/auth?intent=signup&role=studio" },
  },
  {
    key: "buyer",
    title: "Buyer Workspace",
    icon: Briefcase,
    headline: "Close Deals & Grow Revenue",
    pitch:
      "Discover ready titles, review screeners, close licensing deals and unlock new revenue opportunities.",
    cta: { label: "Enter Buyer", to: "/auth?intent=signup&role=buyer" },
  },
] as const;

export const PlatformOverview = () => (
  <section id="platform" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-12 animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px" style={{ background: "var(--gradient-primary)" }} />
          <span className="eyebrow">Choose your workspace</span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Built to grow your <span className="gradient-text">media business</span>
        </h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-px bg-border/60 border border-border-strong/60 rounded-2xl overflow-hidden">
        {SURFACES.map(({ key, title, icon: Icon, headline, pitch, cta }) => (
          <article key={key} className="group relative bg-card p-7 md:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight">{title}</h3>
              <div
                className="w-10 h-10 rounded-xl grid place-items-center text-primary-foreground border border-primary/30"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow:
                    "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
              {headline}
            </p>
            <p className="text-[15px] text-text-secondary leading-relaxed mb-7 font-medium">{pitch}</p>
            <Link
              to={cta.to}
              className="btn-emboss group/btn mt-auto h-11 w-full inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.18em] text-[11px] rounded-md"
            >
              <span>{cta.label}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
          </article>
        ))}
      </div>
    </div>
  </section>
);
