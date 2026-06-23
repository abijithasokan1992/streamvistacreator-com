import { Upload, Database, Wrench, ShieldCheck, FileSignature, ArrowRight } from "lucide-react";

/**
 * Public workflow strip — the five operational stages StreamVista runs end-to-end:
 *   Ingest → Store → Prepare → Control Access → License
 *
 * Stays presentation-only: no data, no auth state. Each step links into the
 * relevant surface so curious visitors can drill in without leaving the page.
 */

const STEPS = [
  {
    icon: Upload,
    step: "01",
    title: "Ingest",
    body: "Camera-to-cloud pipelines, browser uploads and structured intake for masters, posters, metadata and legal docs.",
  },
  {
    icon: Database,
    step: "02",
    title: "Store",
    body: "Recurring 1 TB storage blocks on enterprise-grade infrastructure with full chain-of-custody for every asset.",
  },
  {
    icon: Wrench,
    step: "03",
    title: "Prepare",
    body: "Frame-accurate review, mastering, QC and delivery prep — handled in-platform with your post and production team.",
  },
  {
    icon: ShieldCheck,
    step: "04",
    title: "Control access",
    body: "NDA-gated screener links, watermarked previews, granular roles and timeline-tracked admin updates.",
  },
  {
    icon: FileSignature,
    step: "05",
    title: "License",
    body: "Buyer / OTT / distributor requests, deal-room exchange and audit-ready records — from first contact to signed deal.",
  },
];

export const Workflow = () => (
  <section id="workflow" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              How StreamVista runs
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            One pipeline.
            <br />
            <span className="gradient-text">Intake to deal.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          Every title moves through the same five operational stages — so nothing
          gets lost between your editor, your vault, your legal team and your buyer.
        </p>
      </div>

      <ol className="grid md:grid-cols-2 lg:grid-cols-5 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {STEPS.map(({ icon: Icon, step, title, body }, idx) => (
          <li key={step} className="bg-card p-6 md:p-7 flex flex-col relative">
            <div className="flex items-center justify-between mb-5">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                {step}
              </span>
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-bold uppercase mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            {idx < STEPS.length - 1 && (
              <ArrowRight
                aria-hidden
                className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent bg-background rounded-full p-0.5 border border-border/60"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  </section>
);
