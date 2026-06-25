/**
 * Our Partners — public trust strip.
 *
 * Logos are pulled live from each partner's own domain via the Clearbit Logo
 * API so we always serve the original brand mark rather than a recreated
 * wordmark. Each logo links to the partner's official site (new tab).
 *
 * If a partner logo fails to load we fall back to a clean wordmark chip so
 * the strip never breaks visually.
 */

import { useState } from "react";

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

const PartnerLogo = ({ partner }: { partner: Partner }) => {
  const [failed, setFailed] = useState(false);
  const logoSrc = `https://logo.clearbit.com/${partner.domain}?size=256`;

  return (
    <a
      href={partner.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${partner.name} — open official site in new tab`}
      title={partner.name}
      className="group h-20 md:h-24 px-6 flex items-center justify-center bg-card hover:bg-card/70 transition-colors"
    >
      {failed ? (
        <span className="font-display text-sm md:text-base font-bold uppercase tracking-[0.14em] text-text-secondary group-hover:text-foreground transition-colors">
          {partner.name}
        </span>
      ) : (
        <img
          src={logoSrc}
          alt={`${partner.name} logo`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-10 md:max-h-12 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        />
      )}
    </a>
  );
};

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
        <p className="mt-5 text-sm md:text-base text-text-secondary max-w-2xl md:mx-0 mx-auto">
          StreamVista titles reach audiences through trusted platforms across India and beyond.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {PARTNERS.map((p) => (
          <PartnerLogo key={p.name} partner={p} />
        ))}
      </div>
    </div>
  </section>
);
