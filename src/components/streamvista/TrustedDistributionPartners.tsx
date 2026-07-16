/**
 * Trusted Distribution Partners — enterprise network band.
 * Text badges only; no logos to avoid brand-permission issues.
 */
const PARTNERS = [
  "Sun Nxt",
  "Amritha",
  "Amazon Prime",
  "JioCinema",
  "ZEE5",
];

export const TrustedDistributionPartners = () => (
  <section id="partners" className="border-b border-border/40 bg-background/60">
    <div className="container py-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 shrink-0">
          Trusted Distribution Partners
        </span>
        <ul className="flex flex-wrap items-center gap-2 md:gap-3">
          {PARTNERS.map((p) => (
            <li
              key={p}
              className="inline-flex items-center rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-semibold text-foreground/90 hover:border-primary/50 hover:text-foreground transition-colors"
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default TrustedDistributionPartners;
