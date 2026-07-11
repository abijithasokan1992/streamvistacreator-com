/**
 * Rights & Distribution — six simple category chips.
 */
const CATEGORIES = ["OTT", "Broadcasters", "FAST", "Airlines", "Hospitality", "Educational"];

export const RightsDistribution = () => (
  <section id="rights" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-12 max-w-3xl animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Rights &amp; Distribution
          </span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-5xl">
          License across <span className="gradient-text">every channel</span>
        </h2>
      </div>

      <ul className="flex flex-wrap gap-3">
        {CATEGORIES.map((c) => (
          <li
            key={c}
            className="inline-flex items-center rounded-full border border-border/60 bg-card/40 px-5 py-2.5 text-sm font-semibold text-foreground/90 hover:border-primary/50 hover:text-foreground transition-colors"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  </section>
);
