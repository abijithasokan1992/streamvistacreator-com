/**
 * Our Partners — public trust strip.
 *
 * Logos are pulled from each partner's own domain via the Clearbit Logo API
 * so we always serve the original brand mark rather than a recreated wordmark.
 * Each tile links to the partner's official site (new tab).
 *
 * Stateless on purpose: the fallback wordmark sits behind the <img> and is
 * revealed by hiding the image via the `onError` handler. No hooks, so this
 * file is safe to render in any tree.
 */

type Partner = {
  name: string;
  domain: string;     // used for the Clearbit logo lookup
  href: string;       // official site
};

const PARTNERS: Partner[] = [
  { name: "BookMyShow",        domain: "bookmyshow.com",        href: "https://in.bookmyshow.com/" },
  { name: "BookMyShow Stream", domain: "stream.bookmyshow.com", href: "https://stream.bookmyshow.com/" },
  { name: "Crayons Loop",      domain: "crayonsloop.com",       href: "https://www.crayonsloop.com/" },
  { name: "Watcho",            domain: "watcho.com",            href: "https://www.watcho.com/" },
  { name: "FLIQS",             domain: "fliqs.com",             href: "https://www.fliqs.com/" },
  { name: "JioHotstar",        domain: "hotstar.com",           href: "https://www.hotstar.com/" },
  { name: "Asianet",           domain: "asianet.co.in",         href: "https://www.asianet.co.in/" },
  { name: "ManoramaMAX",       domain: "manoramamax.com",       href: "https://www.manoramamax.com/" },
  { name: "aha",               domain: "aha.video",             href: "https://www.aha.video/" },
  { name: "Surya TV",          domain: "suryatv.net",           href: "https://www.suryatv.net/" },
  { name: "Sun NXT",           domain: "sunnxt.com",            href: "https://www.sunnxt.com/" },
  { name: "Hoopla",            domain: "hoopladigital.com",     href: "https://www.hoopladigital.com/" },
  { name: "Midwest Tape",      domain: "midwesttape.com",       href: "https://www.midwesttape.com/" },
];

export const Partners = () => (
  <section id="partners" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-12 animate-fade-in text-center md:text-left">
        <div className="flex items-center gap-3 mb-5 justify-center md:justify-start">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">Distribution network</span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Our <span className="gradient-text">Partners</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {PARTNERS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.name} — open official site in new tab`}
            title={p.name}
            className="group relative h-20 md:h-24 px-6 flex items-center justify-center bg-card hover:bg-card/70 transition-colors"
          >
            {/* Fallback wordmark — sits behind the logo, visible if the image fails or while it loads */}
            <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-display text-sm md:text-base font-bold uppercase tracking-[0.14em] text-text-secondary group-hover:text-foreground transition-colors">
              {p.name}
            </span>
            <img
              src={`https://logo.clearbit.com/${p.domain}?size=256`}
              alt={`${p.name} logo`}
              loading="lazy"
              onError={(e) => {
                // Hide the broken image so the wordmark fallback shows through.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              className="relative max-h-10 md:max-h-12 w-auto object-contain bg-card opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </a>
        ))}
      </div>
    </div>
  </section>
);
