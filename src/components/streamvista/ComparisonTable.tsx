import { Check, Sparkles } from "lucide-react";
import { useCreatorPaygPrice } from "@/hooks/usePublicPlans";

/**
 * Brand-neutral "Why StreamVista" feature grid.
 * (Previous side-by-side comparison referencing third-party brands has been
 * retired — we now stand on our own capabilities, no trademarks of others
 * appear on the marketing surface.)
 */
type Capability = {
  title: string;
  body: string;
};

export const ComparisonTable = () => {
  const payg = useCreatorPaygPrice();
  const CAPABILITIES: Capability[] = [
    { title: "Built for filmmakers", body: "Native handling of RAW, R3D and ProRes — no transcoding before upload." },
    { title: "Camera-to-cloud ingest", body: "Push dailies straight from set into your secure cinematic vault." },
    { title: "Frame-accurate review", body: "Timecode-anchored comments. Approve cuts in one click, no chat threads." },
    { title: "Branded client share links", body: "Password, expiry, watermark, view tracking — included on every plan." },
    { title: "UPI / Razorpay checkout", body: "Native ₹ INR billing, GST invoice, instant top-up. No FX surprises." },
    { title: "WhatsApp + Email support", body: "Real humans, real fast. Reach the OPC team without a ticket queue." },
    { title: "Free plan with real storage", body: "128 GB and 500 GB/month bandwidth — enough to ship a short film." },
    { title: "Predictable pricing", body: `Start free. Scale to 1 TB for ${payg.totalLabel}/mo. Auto Pay-As-You-Go beyond that.` },
  ];
  return (
  <section id="compare" className="py-24 border-t border-border/40 relative">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Why StreamVista
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            Cinema-grade cloud.
            <br />
            <span className="gradient-text">Indian pricing.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          Everything an indie film team actually needs — without renting tools built for
          someone else's workflow.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {CAPABILITIES.map((c, i) => (
          <article
            key={c.title}
            className="bg-background p-6 md:p-7 animate-fade-in hover:bg-primary/[0.04] transition-colors"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-3.5 h-3.5 text-accent" strokeWidth={3} />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
                Included
              </span>
            </div>
            <h3 className="font-display font-bold text-base md:text-lg mb-1.5 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-1 shrink-0" />
              <span>{c.title}</span>
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {c.body}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground/70 text-center font-mono-tech">
        Every capability above ships on the free plan unless explicitly marked otherwise.
      </p>
    </div>
  </section>
);
