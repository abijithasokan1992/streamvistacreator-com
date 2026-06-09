import { Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  feature: string;
  sv: string | boolean;
  framio: string | boolean;
  dropbox: string | boolean;
  gdrive: string | boolean;
};

const ROWS: Row[] = [
  { feature: "Built for filmmakers (RAW, R3D, ProRes)", sv: true, framio: true, dropbox: false, gdrive: false },
  { feature: "Camera-to-cloud ingest", sv: true, framio: true, dropbox: false, gdrive: false },
  { feature: "Frame-accurate review & comments", sv: true, framio: true, dropbox: false, gdrive: false },
  { feature: "Branded client share links", sv: true, framio: "Add-on", dropbox: false, gdrive: false },
  { feature: "Watermarking & view tracking", sv: true, framio: true, dropbox: false, gdrive: false },
  { feature: "UPI / Razorpay checkout (₹ INR)", sv: true, framio: false, dropbox: false, gdrive: false },
  { feature: "WhatsApp + Email support", sv: true, framio: false, dropbox: false, gdrive: false },
  { feature: "Free plan with real storage", sv: true, framio: "Limited", dropbox: "2 GB", gdrive: "15 GB" },
  { feature: "Starting price", sv: "Free → ₹499/mo", framio: "$15/mo", dropbox: "$12/mo", gdrive: "$2/mo" },
];

const Cell = ({ v, highlight }: { v: string | boolean; highlight?: boolean }) => {
  if (typeof v === "boolean") {
    return v
      ? <Check className={cn("w-4 h-4 mx-auto", highlight ? "text-accent" : "text-primary")} />
      : <X className="w-4 h-4 mx-auto text-muted-foreground/40" />;
  }
  return (
    <span className={cn(
      "text-xs md:text-sm whitespace-nowrap",
      highlight ? "text-accent font-semibold" : "text-muted-foreground"
    )}>{v}</span>
  );
};

export const ComparisonTable = () => (
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
            Frame.io power.
            <br />
            <span className="gradient-text">Indian pricing.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          A side-by-side comparison with the tools your team probably uses today.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 glass">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left p-5 font-mono-tech text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Feature</th>
              <th className="p-5 bg-gradient-primary/5">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="font-display font-bold text-sm gradient-text">StreamVista</span>
                </div>
              </th>
              <th className="p-5 font-display font-bold text-sm text-muted-foreground text-center">Frame.io</th>
              <th className="p-5 font-display font-bold text-sm text-muted-foreground text-center">Dropbox</th>
              <th className="p-5 font-display font-bold text-sm text-muted-foreground text-center">Google Drive</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.feature} className={cn("border-b border-border/40 last:border-b-0", i % 2 === 0 && "bg-primary/[0.02]")}>
                <td className="p-4 md:p-5 text-sm">{r.feature}</td>
                <td className="p-4 md:p-5 text-center bg-gradient-primary/[0.04]"><Cell v={r.sv} highlight /></td>
                <td className="p-4 md:p-5 text-center"><Cell v={r.framio} /></td>
                <td className="p-4 md:p-5 text-center"><Cell v={r.dropbox} /></td>
                <td className="p-4 md:p-5 text-center"><Cell v={r.gdrive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground/70 text-center font-mono-tech">
        Comparison based on publicly listed plans as of {new Date().getFullYear()}. Trademarks belong to their respective owners.
      </p>
    </div>
  </section>
);
