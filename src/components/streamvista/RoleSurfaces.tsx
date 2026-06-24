import { Film, Layers, Briefcase, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Three-door routing block — Creator / Studio / Licensing.
 * Label-first, 3 short chips per surface, single CTA.
 */

type Surface = {
  key: "creator" | "studio" | "buyer";
  title: string;
  icon: typeof Film;
  pitch: string;
  chips: string[];
  cta: { label: string; to: string };
};

const SURFACES: Surface[] = [
  {
    key: "creator",
    title: "Creator",
    icon: Film,
    pitch: "Submit titles. Hold rights. Stay protected.",
    chips: ["Secure Intake", "Master Vault", "Rights Control"],
    cta: { label: "Enter Creator", to: "/auth?intent=signup&role=content_owner" },
  },
  {
    key: "studio",
    title: "Studio",
    icon: Layers,
    pitch: "Run post, QC and delivery from one vault.",
    chips: ["Ingest & Mastering", "QC & Delivery", "Role-Based Access"],
    cta: { label: "Enter Studio", to: "/auth?intent=signup&role=studio" },
  },
  {
    key: "buyer",
    title: "Licensing",
    icon: Briefcase,
    pitch: "Request screeners. Close deals under NDA.",
    chips: ["NDA Gate", "Screeners", "Deal Room"],
    cta: { label: "Enter Licensing", to: "/auth?intent=signup&role=buyer" },
  },
];

export const RoleSurfaces = () => (
  <section id="for" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-14 animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px" style={{ background: "var(--gradient-primary)" }} />
          <span className="eyebrow">Three surfaces · One platform</span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Choose your <span className="gradient-text">door.</span>
        </h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-px bg-border/60 border border-border-strong/60 rounded-2xl overflow-hidden">
        {SURFACES.map(({ key, title, icon: Icon, pitch, chips, cta }) => (
          <article key={key} className="group relative bg-card p-7 md:p-9 flex flex-col transition-colors hover:bg-card/60">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight">{title}</h3>
              <div
                className="w-11 h-11 rounded-xl grid place-items-center text-primary-foreground border border-primary/30"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow: "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[15px] text-text-secondary leading-relaxed mb-6 font-medium">{pitch}</p>

            <div className="flex flex-wrap gap-2 mb-8">
              {chips.map((c) => (
                <span
                  key={c}
                  className="px-2.5 py-1 rounded-md border border-border-strong/60 bg-background/40 text-[11px] font-mono-tech uppercase tracking-[0.14em] text-text-secondary"
                >
                  {c}
                </span>
              ))}
            </div>

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
