/**
 * Distribution Network — refined muted marquee row.
 * Text badges only (no logos to avoid brand-permission issues).
 * Auto-scrolls slowly, pauses on hover / focus, respects prefers-reduced-motion.
 */

const PARTNERS = [
  "Sun Nxt",
  "Amrita",
  "Amazon Prime",
  "JioCinema",
  "ZEE5",
];

// Duplicate the list once so the seamless loop has a matching second half.
const MARQUEE = [...PARTNERS, ...PARTNERS];

export const TrustedDistributionPartners = () => (
  <section
    id="partners"
    aria-label="Distribution Network"
    className="border-b border-border/40 bg-background/60"
  >
    <div className="container py-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
        <span className="scene-marker shrink-0">Distribution Network</span>

        <div className="marquee-mask flex-1 min-w-0" tabIndex={0} aria-label="Rolling list of distribution platforms">
          <ul className="marquee-track" aria-hidden="false">
            {MARQUEE.map((p, i) => (
              <li
                key={`${p}-${i}`}
                className="chip-glow shrink-0"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default TrustedDistributionPartners;
