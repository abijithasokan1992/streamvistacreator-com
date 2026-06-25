import { Film, Layers, Briefcase, ArrowRight, Upload, Database, Wrench, ShieldCheck, FileSignature, Lock, History, Fingerprint } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public Platform Overview — a single compact section that merges:
 *   3A. Choose Your Door  (Creator / Studio / Licensing)
 *   3B. One Pipeline      (Ingest → Store → Prepare → Control Access → License)
 *   3C. Security & Trust  (NDA, Access, Storage, Audit, DMCA)
 *
 * Presentation-only. No dashboard logic exposed.
 */

const SURFACES = [
  {
    key: "creator",
    title: "Creator",
    icon: Film,
    pitch: "Submit titles, manage rights, prepare catalogue.",
    cta: { label: "Enter Creator", to: "/auth?intent=signup&role=content_owner" },
  },
  {
    key: "studio",
    title: "Studio",
    icon: Layers,
    pitch: "Run ingest, storage, QC and delivery.",
    cta: { label: "Enter Studio", to: "/auth?intent=signup&role=studio" },
  },
  {
    key: "buyer",
    title: "Licensing",
    icon: Briefcase,
    pitch: "Review titles, request screeners, close deals.",
    cta: { label: "Enter Licensing", to: "/auth?intent=signup&role=buyer" },
  },
] as const;

const STEPS = [
  { icon: Upload, step: "01", title: "Ingest" },
  { icon: Database, step: "02", title: "Store" },
  { icon: Wrench, step: "03", title: "Prepare" },
  { icon: ShieldCheck, step: "04", title: "Control Access" },
  { icon: FileSignature, step: "05", title: "License" },
];

const TRUST = [
  { icon: ShieldCheck, title: "NDA Gate" },
  { icon: Lock, title: "Controlled Access" },
  { icon: Database, title: "Encrypted Storage" },
  { icon: History, title: "Audit Timeline" },
  { icon: Fingerprint, title: "DMCA / IP Protection" },
];

export const PlatformOverview = () => (
  <section id="platform" className="py-24 border-b border-border/40 relative">
    <div className="container">
      {/* Header */}
      <div className="mb-12 animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px" style={{ background: "var(--gradient-primary)" }} />
          <span className="eyebrow">Platform overview</span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          One platform, <span className="gradient-text">three doors</span>
        </h2>
      </div>

      {/* 3A — Doors */}
      <div className="grid lg:grid-cols-3 gap-px bg-border/60 border border-border-strong/60 rounded-2xl overflow-hidden mb-16">
        {SURFACES.map(({ key, title, icon: Icon, pitch, cta }) => (
          <article key={key} className="group relative bg-card p-7 md:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight">{title}</h3>
              <div
                className="w-10 h-10 rounded-xl grid place-items-center text-primary-foreground border border-primary/30"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow: "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
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

      {/* 3B — Pipeline */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">One pipeline</span>
        </div>
        <ol className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {STEPS.map(({ icon: Icon, step, title }, idx) => (
            <li key={step} className="bg-card p-5 md:p-6 flex flex-col relative">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">{step}</span>
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-display text-base md:text-lg font-bold uppercase">{title}</h3>
              {idx < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent bg-background rounded-full p-0.5 border border-border/60"
                />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* 3C — Trust */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Security &amp; trust</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {TRUST.map(({ icon: Icon, title }) => (
            <div key={title} className="bg-card p-5 md:p-6 flex flex-col items-start">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 inline-flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-display text-sm md:text-base font-bold uppercase leading-tight">{title}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
