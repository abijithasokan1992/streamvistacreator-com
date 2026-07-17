import { Upload, ShieldCheck, Store, Handshake, TrendingUp } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * How it works — 5-step timeline, presented as a horizontal filmstrip on
 * desktop and a vertical stack on mobile. Each frame is a bordered card with
 * subtle perforation motif, scene-number markers ("01"…"05"), and a soft
 * gold glow on hover.
 */

const STEPS = [
  { icon: Upload,     step: "01", title: "Upload",      body: "Bring your title, assets and metadata." },
  { icon: ShieldCheck, step: "02", title: "Review",      body: "Rights, QC and readiness verified." },
  { icon: Store,      step: "03", title: "Marketplace", body: "Your title goes live to verified buyers." },
  { icon: Handshake,  step: "04", title: "Buyer",       body: "Negotiate and close licensing deals." },
  { icon: TrendingUp, step: "05", title: "Revenue",     body: "Track earnings across every channel." },
];

export const Workflow = () => (
  <section id="workflow" className="py-20 sm:py-28 border-b border-border/40 relative overflow-hidden">
    <div className="container relative">
      <Reveal className="mb-16 text-center">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-8 h-px bg-cine-gold" />
          <span className="scene-marker">How it works</span>
          <div className="w-8 h-px bg-cine-gold" />
        </div>
        <h2 className="h-cine text-4xl md:text-5xl lg:text-6xl">
          From upload <span className="text-cine-gold italic">to revenue</span>
        </h2>
      </Reveal>

      <ol
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5"
        aria-label="Five-step licensing workflow"
      >
        {STEPS.map(({ icon: Icon, step, title, body }, i) => (
          <Reveal as="li" key={step} delay={i * 90}>
            <article className="film-frame relative flex flex-col items-start gap-4 p-6 h-full">
              <span className="scene-marker">Scene {step}</span>
              <div className="w-11 h-11 rounded-md bg-cine-gold/10 border border-cine-gold flex items-center justify-center">
                <Icon className="w-5 h-5 text-cine-gold" />
              </div>
              <h3 className="font-display text-base md:text-lg font-bold uppercase tracking-tight">
                {title}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                {body}
              </p>
            </article>
          </Reveal>
        ))}
      </ol>
    </div>

    <div className="scene-divider mt-20" aria-hidden />
  </section>
);
