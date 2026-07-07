import { Upload, FolderKanban, Users, Send, TrendingUp, ArrowRight } from "lucide-react";

/**
 * Workflow — business-value pipeline. Upload → Manage → Collaborate → Distribute → Monetize.
 */

const STEPS = [
  { icon: Upload, step: "01", title: "Upload", body: "Bring assets, projects and metadata in." },
  { icon: FolderKanban, step: "02", title: "Manage", body: "Organize titles, rights and library." },
  { icon: Users, step: "03", title: "Collaborate", body: "Review, approve and share with partners." },
  { icon: Send, step: "04", title: "Distribute", body: "Deliver to platforms, buyers and marketplaces." },
  { icon: TrendingUp, step: "05", title: "Monetize", body: "Close licensing deals and grow revenue." },
];

const TRUST = [
  { icon: ShieldCheck, label: "Protect your intellectual property." },
  { icon: Users, label: "Collaborate securely with approved partners." },
  { icon: History, label: "Full audit trail on every asset." },
  { icon: Fingerprint, label: "Enterprise-grade access controls." },
];

export const Workflow = () => (
  <section id="workflow" className="py-20 lg:py-24 border-b border-border/40 relative overflow-hidden">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.15), transparent 55%), radial-gradient(circle at 75% 80%, hsl(var(--accent) / 0.12), transparent 55%)",
      }}
    />

    <div className="container relative">
      <div className="mb-12 lg:mb-14 animate-fade-in text-center">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">How it works</span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-5xl lg:text-6xl">
          From upload <span className="gradient-text">to revenue</span>
        </h2>
      </div>

      {/* Horizontal timeline */}
      <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-2 relative">
        {STEPS.map(({ icon: Icon, step, title, body }, i) => (
          <li key={step} className="relative flex flex-col items-center text-center">
            <div
              className="relative w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center border-2 mb-4"
              style={{
                borderColor: "hsl(var(--primary) / 0.45)",
                background:
                  "linear-gradient(145deg, hsl(var(--surface-elevated) / 0.9), hsl(var(--surface) / 0.7))",
                boxShadow:
                  "0 12px 32px -10px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(var(--accent) / 0.25)",
              }}
            >
              <Icon className="w-6 h-6 text-primary" />
              <span className="mt-1 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">{step}</span>
            </div>
            <h3 className="font-display text-sm md:text-base font-bold uppercase tracking-tight">{title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-1 max-w-[24ch]">{body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight
                aria-hidden
                className="hidden lg:block absolute top-[42px] -right-3 w-5 h-5 text-primary/40"
              />
            )}
          </li>
        ))}
      </ol>

      {/* Compact trust strip */}
      <ul className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TRUST.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5"
          >
            <div
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.15))",
                boxShadow: "inset 0 0 0 1px hsl(var(--accent) / 0.25)",
              }}
            >
              <Icon className="w-4 h-4 text-accent" />
            </div>
            <span className="text-[13px] text-foreground/90 leading-snug">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
