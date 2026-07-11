import { Upload, ShieldCheck, Store, Handshake, TrendingUp, ArrowRight } from "lucide-react";

/**
 * How it works — 5 simple steps.
 * Upload → Review → Marketplace → Buyer → Revenue.
 */

const STEPS = [
  { icon: Upload, step: "01", title: "Upload", body: "Bring your title, assets and metadata." },
  { icon: ShieldCheck, step: "02", title: "Review", body: "Rights, QC and readiness verified." },
  { icon: Store, step: "03", title: "Marketplace", body: "Your title goes live to verified buyers." },
  { icon: Handshake, step: "04", title: "Buyer", body: "Negotiate and close licensing deals." },
  { icon: TrendingUp, step: "05", title: "Revenue", body: "Track earnings across every channel." },
];

export const Workflow = () => (
  <section id="workflow" className="py-24 border-b border-border/40 relative overflow-hidden">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.3]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.15), transparent 55%), radial-gradient(circle at 75% 80%, hsl(var(--accent) / 0.12), transparent 55%)",
      }}
    />

    <div className="container relative">
      <div className="mb-16 text-center animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">How it works</span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-5xl lg:text-6xl">
          From upload <span className="gradient-text">to revenue</span>
        </h2>
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-2 relative">
        {STEPS.map(({ icon: Icon, step, title, body }, i) => (
          <li key={step} className="relative flex flex-col items-center text-center">
            <div
              className="relative w-[92px] h-[92px] rounded-full flex flex-col items-center justify-center border-2 mb-5"
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
            <h3 className="font-display text-base md:text-lg font-bold uppercase tracking-tight">{title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-2 max-w-[22ch]">{body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight
                aria-hidden
                className="hidden lg:block absolute top-[44px] -right-3 w-5 h-5 text-primary/40"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  </section>
);
