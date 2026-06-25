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
} from "lucide-react";

/**
 * Public workflow strip — the five operational stages StreamVista runs end-to-end:
 *   Ingest → Store → Prepare → Control Access → License
 *
 * Rendered as a light-isometric infographic: stacked stage tiles connected by a
 * glowing pipeline rail, with a Security & Trust band underneath that anchors
 * the same five protective guarantees that wrap every stage.
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
      className="pointer-events-none absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.18), transparent 55%), radial-gradient(circle at 85% 70%, hsl(var(--accent) / 0.14), transparent 55%)",
      }}
    />

    <div className="container relative">
      <div className="mb-10 sm:mb-12 lg:mb-14 animate-fade-in">
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            One pipeline
          </span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
          From intake <span className="gradient-text">to deal</span>
        </h2>
        <p className="mt-4 sm:mt-5 max-w-2xl text-sm md:text-base text-muted-foreground">
          Five stages, one secure rail. Content moves left to right — every step
          wrapped by the same trust layer.
        </p>
      </div>

      {/* ===== Pipeline rail ===== */}
      <div className="relative">
        {/* desktop connecting rail */}
        <div
          aria-hidden
          className="hidden lg:block absolute left-0 right-0 top-[88px] h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.6) 12%, hsl(var(--primary) / 0.7) 50%, hsl(var(--accent) / 0.6) 88%, transparent)",
            boxShadow: "0 0 24px hsl(var(--primary) / 0.35)",
          }}
        />

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-6 lg:gap-6 relative">
          {STEPS.map(({ icon: Icon, step, title, body }) => (
            <li key={step} className="relative group">
              {/* isometric stage tile */}
              <div className="relative flex flex-col items-center text-center">
                {/* glyph block */}
                <div
                  className="relative w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] lg:w-[120px] lg:h-[120px] mb-4 sm:mb-5 transition-transform duration-500 group-hover:-translate-y-1"
                  style={{ perspective: "600px" }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl border border-border/70 bg-card"
                    style={{
                      transform: "rotateX(18deg) rotateZ(-8deg)",
                      boxShadow:
                        "0 18px 40px -18px hsl(var(--primary) / 0.45), inset 0 1px 0 hsl(var(--accent) / 0.25)",
                      backgroundImage:
                        "linear-gradient(140deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
                    }}
                  />
                  {/* depth side */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      transform: "rotateX(18deg) rotateZ(-8deg) translateZ(-8px) translateY(6px)",
                      background:
                        "linear-gradient(180deg, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.15))",
                      filter: "blur(0.5px)",
                      opacity: 0.55,
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
                    <span className="mt-1.5 sm:mt-2 font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                      {step}
                    </span>
                  </div>
                </div>

                {/* rail node */}
                <div
                  aria-hidden
                  className="hidden lg:block absolute top-[88px] w-3 h-3 rounded-full bg-accent"
                  style={{ boxShadow: "0 0 0 4px hsl(var(--background)), 0 0 16px hsl(var(--accent))" }}
                />

                <h3 className="font-display text-base sm:text-lg font-bold uppercase mt-1 sm:mt-2">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1 max-w-[24ch] sm:max-w-[20ch] lg:max-w-[18ch]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ===== Security & Trust band ===== */}
      <div className="mt-12 sm:mt-14 lg:mt-16 relative">
        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Security & Trust · wraps every stage
          </span>
        </div>

        <div
          className="rounded-2xl border border-border/60 p-3 sm:p-4 md:p-5 backdrop-blur-sm"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--card) / 0.85), hsl(var(--background) / 0.6))",
            boxShadow: "inset 0 1px 0 hsl(var(--accent) / 0.18)",
          }}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {TRUST.map(({ icon: Icon, label, body }) => (
              <li
                key={label}
                className="group flex flex-col sm:flex-row items-center sm:items-start gap-2.5 sm:gap-3 rounded-xl border border-border/50 bg-background/60 p-2.5 sm:p-3 md:p-4 transition-colors hover:border-accent/60 text-center sm:text-left"
              >
                <div
                  className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.18))",
                    boxShadow: "inset 0 0 0 1px hsl(var(--accent) / 0.3)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wide">
                    {label}
                  </div>
                  <div className="text-[11px] md:text-xs text-muted-foreground leading-snug mt-0.5">
                    {body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);
