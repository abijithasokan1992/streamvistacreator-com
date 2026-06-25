import {
  Upload,
  Database,
  Wrench,
  ShieldCheck,
  FileSignature,
  FileLock2,
  KeyRound,
  Lock,
  History,
  Scale,
  ArrowRight,
} from "lucide-react";

/**
 * One Pipeline — a single visual workflow diagram.
 *
 * Five stages flow left-to-right as connected nodes on a glowing rail.
 * Security & Trust wraps the entire pipeline as a protective perimeter band.
 *
 * Premium, cinematic, product-grade. 2D with light-isometric depth.
 */

const STEPS = [
  {
    icon: Upload,
    step: "01",
    title: "Ingest",
    body: "Masters, posters, metadata in.",
  },
  {
    icon: Database,
    step: "02",
    title: "Store",
    body: "Encrypted, versioned, auditable.",
  },
  {
    icon: Wrench,
    step: "03",
    title: "Prepare",
    body: "QC, mastering, delivery-ready.",
  },
  {
    icon: ShieldCheck,
    step: "04",
    title: "Control Access",
    body: "NDA-gated, role-scoped.",
  },
  {
    icon: FileSignature,
    step: "05",
    title: "License",
    body: "Screeners, requests, contracts.",
  },
];

const TRUST = [
  { icon: FileLock2, label: "NDA Gate", body: "Signed before any frame loads." },
  { icon: KeyRound, label: "Controlled Access", body: "Role-scoped, time-bound links." },
  { icon: Lock, label: "Encrypted Storage", body: "At rest and in transit." },
  { icon: History, label: "Audit Timeline", body: "Every view, every change." },
  { icon: Scale, label: "DMCA / IP Protection", body: "Takedown + chain of custody." },
];

export const Workflow = () => (
  <section id="workflow" className="py-16 sm:py-20 lg:py-24 border-b border-border/40 relative overflow-hidden">
    {/* ambient backdrop */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.45]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.18), transparent 55%), radial-gradient(circle at 75% 80%, hsl(var(--accent) / 0.14), transparent 55%)",
      }}
    />

    <div className="container relative">
      {/* ===== Section header ===== */}
      <div className="mb-10 sm:mb-14 lg:mb-16 animate-fade-in text-center">
        <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            One pipeline
          </span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
          From intake <span className="gradient-text">to deal</span>
        </h2>
        <p className="mt-4 sm:mt-5 max-w-2xl mx-auto text-sm md:text-base text-muted-foreground">
          Five stages, one secure rail. Content moves left to right — every step
          wrapped by the same trust layer.
        </p>
      </div>

      {/* ===== Unified Pipeline Diagram ===== */}
      <div
        className="relative rounded-2xl border border-border/50 p-6 sm:p-8 lg:p-10 backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--card) / 0.7), hsl(var(--background) / 0.5))",
          boxShadow:
            "inset 0 1px 0 hsl(var(--accent) / 0.15), 0 24px 64px -24px hsl(var(--primary) / 0.25)",
        }}
      >
        {/* Corner accent marks — schematic diagram feel */}
        <div aria-hidden className="absolute top-3 left-3 w-4 h-4 border-t border-l border-primary/30 rounded-tl-sm" />
        <div aria-hidden className="absolute top-3 right-3 w-4 h-4 border-t border-r border-primary/30 rounded-tr-sm" />
        <div aria-hidden className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-primary/30 rounded-bl-sm" />
        <div aria-hidden className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-primary/30 rounded-br-sm" />
        {/* ===== Security & Trust perimeter badge ===== */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/40 backdrop-blur-md"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.18))",
            boxShadow:
              "0 0 24px hsl(var(--primary) / 0.2), inset 0 1px 0 hsl(var(--accent) / 0.3)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
            Security & Trust
          </span>
        </div>

        {/* ===== Connecting rail (desktop only) ===== */}
        <div
          aria-hidden
          className="hidden lg:block absolute left-[calc(10%+40px)] right-[calc(10%+40px)] top-[104px] h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--accent) / 0.3), hsl(var(--primary) / 0.6) 30%, hsl(var(--primary) / 0.6) 70%, hsl(var(--accent) / 0.3))",
            boxShadow: "0 0 20px hsl(var(--primary) / 0.35), 0 0 6px hsl(var(--accent) / 0.25)",
          }}
        />

        {/* ===== Pipeline nodes ===== */}
        <ol className="relative z-[1] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-5 lg:gap-4">
          {STEPS.map(({ icon: Icon, step, title, body }, i) => (
            <li key={step} className="relative group">
              {/* Arrow connector between nodes (mobile + sm) */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="lg:hidden absolute left-1/2 -translate-x-1/2 bottom-[-22px] z-10 flex items-center justify-center w-6 h-6"
                >
                  <ArrowRight className="w-4 h-4 text-primary/50 rotate-90" />
                </div>
              )}

              <div className="relative flex flex-col items-center text-center">
                {/* Node circle */}
                <div className="relative mb-4 sm:mb-5">
                  {/* Outer glow ring */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      transform: "scale(1.25)",
                      background:
                        "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)",
                    }}
                  />

                  {/* Node body */}
                  <div
                    className="relative w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] lg:w-[104px] lg:h-[104px] rounded-full flex flex-col items-center justify-center border-2 transition-all duration-500 group-hover:scale-105"
                    style={{
                      borderColor: "hsl(var(--primary) / 0.45)",
                      background:
                        "linear-gradient(145deg, hsl(var(--surface-elevated) / 0.9), hsl(var(--surface) / 0.7))",
                      boxShadow:
                        "0 12px 32px -10px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(var(--accent) / 0.25), 0 0 0 1px hsl(var(--primary) / 0.15)",
                    }}
                  >
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                    <span className="mt-1 font-mono-tech text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-accent">
                      {step}
                    </span>
                  </div>

                  {/* Desktop arrow to next node */}
                  {i < STEPS.length - 1 && (
                    <div
                      aria-hidden
                      className="hidden lg:block absolute top-1/2 -translate-y-1/2 left-[calc(100%+8px)]"
                    >
                      <ArrowRight className="w-4 h-4 text-primary/40" />
                    </div>
                  )}
                </div>

                {/* Label below node */}
                <h3 className="font-display text-sm sm:text-base font-bold uppercase tracking-tight">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1 max-w-[26ch]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* ===== Security & Trust perimeter band ===== */}
        <div
          className="mt-10 sm:mt-12 lg:mt-14 rounded-xl border border-border/50 p-4 sm:p-5 lg:p-6 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--surface-elevated) / 0.5), hsl(var(--surface) / 0.3))",
            boxShadow: "inset 0 1px 0 hsl(var(--accent) / 0.12)",
          }}
        >
          {/* perimeter glow line */}
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.5) 20%, hsl(var(--primary) / 0.5) 50%, hsl(var(--accent) / 0.5) 80%, transparent)",
            }}
          />

          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {TRUST.map(({ icon: Icon, label, body }) => (
              <li
                key={label}
                className="group flex items-center gap-3 rounded-lg border border-border/40 bg-background/50 p-3 sm:p-3.5 transition-colors hover:border-accent/50"
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.15))",
                    boxShadow: "inset 0 0 0 1px hsl(var(--accent) / 0.25)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-wide">
                    {label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== Onboarding CTA ===== */}
      <div className="mt-10 sm:mt-12 lg:mt-14 flex flex-col items-center text-center animate-fade-in">
        <a
          href="/onboarding"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold text-sm glow-primary transition-transform hover:scale-[1.02]"
        >
          Start your onboarding
          <ArrowRight className="w-4 h-4" />
        </a>
        <p className="mt-3 text-xs text-muted-foreground max-w-xs">
          Two fields. 30 seconds. No credit card.
        </p>
      </div>
    </div>
  </section>
);
