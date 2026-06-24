import { Film, Layers, Briefcase, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public role surfaces — Creator / Studio / Buyer.
 *
 * Each card is honest about the engagement model:
 *   • Creator: self-serve sign-up + founder-assisted Pro/Studio upgrades
 *               + self-serve recurring storage add-ons.
 *   • Studio:  founder-assisted plan changes + service / vault workflows.
 *   • Buyer:   commercial request workflow, NDA-gated. No subscription.
 *
 * Every CTA routes into a path that actually exists today:
 *   /auth?intent=signup&role=...  → onboarding + role pre-selected
 *   /contact                       → founder-assisted talk path
 */

type Surface = {
  key: "creator" | "studio" | "buyer";
  tag: string;
  title: string;
  icon: typeof Film;
  pitch: string;
  bullets: string[];
  model: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
};

const SURFACES: Surface[] = [
  {
    key: "creator",
    tag: "For filmmakers & rights holders",
    title: "Creator",
    icon: Film,
    pitch:
      "Submit, store and prepare your titles for distribution from a single secure workspace.",
    bullets: [
      "Title intake — metadata, posters, trailers, master files, legal docs",
      "Frame-accurate review and submission pipeline",
      "5 GB workspace on Creator Basic — add recurring 1 TB storage blocks self-serve",
      "Creator Pro / Creator Studio packages handled by our team",
    ],
    model: "Self-serve sign-up · founder-assisted upgrades · self-serve storage",
    primary: { label: "Get started as Creator", to: "/auth?intent=signup&role=content_owner" },
    secondary: { label: "Talk about a Pro plan", to: "/contact" },
  },
  {
    key: "studio",
    tag: "For post-production & facilities",
    title: "Studio",
    icon: Layers,
    pitch:
      "Run vault, ingest, mastering, QC and delivery workflows for high-volume professional operations.",
    bullets: [
      "Vault / heavy storage with operational support",
      "Request service workflows — ingest, mastering, QC, delivery",
      "Plan changes and commercial terms handled by StreamVista",
      "Workspace access for production teams and operators",
    ],
    model: "Founder-assisted plans · self-serve vault storage where live",
    primary: { label: "Open Studio workspace", to: "/auth?intent=signup&role=studio" },
    secondary: { label: "Request a Studio plan", to: "/contact" },
  },
  {
    key: "buyer",
    tag: "For acquisitions, OTT & distributors",
    title: "Licensing",
    icon: Briefcase,
    pitch:
      "Request screeners, rights information and acquisition conversations — securely, with status you can track.",
    bullets: [
      "Submit commercial requests for screener / rights / licensing access",
      "NDA / agreement gate before any title information is exchanged",
      "Track each request with a full timeline of admin updates",
      "No subscription — pay nothing to open a conversation",
    ],
    model: "Request access · NDA-gated · no subscription plan",
    primary: { label: "Open Licensing portal", to: "/auth?intent=signup&role=buyer" },
    secondary: { label: "Contact our team", to: "/contact" },
  },
];

export const RoleSurfaces = () => (
  <section id="for" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px" style={{ background: "var(--gradient-primary)" }} />
            <span className="eyebrow">Three surfaces · One platform</span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            Built for the people
            <br />
            <span className="gradient-text">who actually move IP.</span>
          </h2>
        </div>
        <p className="text-text-secondary max-w-sm text-[15px] leading-relaxed font-medium">
          StreamVista is honest about how each surface works. Some flows are self-serve;
          others are founder-assisted because the commercial fit matters more than a checkout button.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-px bg-border/60 border border-border-strong/60 rounded-2xl overflow-hidden">
        {SURFACES.map(({ key, tag, title, icon: Icon, pitch, bullets, model, primary, secondary }) => (
          <article key={key} className="group relative bg-card p-7 md:p-9 flex flex-col transition-colors hover:bg-card/60">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-5">
              <span className="eyebrow text-text-tertiary">{tag}</span>
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
            <h3 className="font-display text-3xl md:text-4xl font-black uppercase mb-2 tracking-tight">{title}</h3>
            <p className="text-[15px] text-text-secondary leading-relaxed mb-5 font-medium">{pitch}</p>

            <ul className="space-y-2.5 text-sm mb-6">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-text-secondary">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-3">
              <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-primary border-t border-border-subtle pt-4">
                {model}
              </div>
              <Link
                to={primary.to}
                className="btn-emboss group/btn h-11 w-full inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.18em] text-[11px] rounded-md"
              >
                <span>{primary.label}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
              {secondary && (
                <Link
                  to={secondary.to}
                  className="h-10 w-full inline-flex items-center justify-center gap-2 border border-border-strong/60 hover:border-primary/60 hover:bg-primary/5 text-text-secondary hover:text-foreground font-semibold uppercase tracking-[0.18em] text-[11px] rounded-md transition-colors"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

    </div>
  </section>
);
