/**
 * Connected Media Ecosystem — homepage section.
 *
 * Replaces the old logo grid with a category-first information architecture:
 * partner categories describe the reach StreamVista provides, and a short
 * curated set of featured buyer logos anchors the credibility of the network.
 * Full directory + submission details live on /partners.
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const CATEGORIES: string[] = [
  "OTT & Streaming",
  "Broadcasters",
  "FAST Channels",
  "TVOD",
  "AVOD",
  "SVOD",
  "Educational & Library",
  "Airlines & Hospitality",
  "Rights Buyers",
  "Distribution Partners",
];

type FeaturedPartner = { name: string; domain: string; href: string };

const FEATURED: FeaturedPartner[] = [
  { name: "BookMyShow",        domain: "bookmyshow.com",        href: "https://in.bookmyshow.com/" },
  { name: "BookMyShow Stream", domain: "stream.bookmyshow.com", href: "https://stream.bookmyshow.com/" },
  { name: "JioHotstar",        domain: "hotstar.com",           href: "https://www.hotstar.com/" },
  { name: "Watcho",            domain: "watcho.com",            href: "https://www.watcho.com/" },
  { name: "Sun NXT",           domain: "sunnxt.com",            href: "https://www.sunnxt.com/" },
  { name: "ManoramaMAX",       domain: "manoramamax.com",       href: "https://www.manoramamax.com/" },
  { name: "aha",               domain: "aha.video",             href: "https://www.aha.video/" },
  { name: "Asianet",           domain: "asianet.co.in",         href: "https://www.asianet.co.in/" },
  { name: "Surya TV",          domain: "suryatv.net",           href: "https://www.suryatv.net/" },
  { name: "Hoopla",            domain: "hoopladigital.com",     href: "https://www.hoopladigital.com/" },
  { name: "Midwest Tape",      domain: "midwesttape.com",       href: "https://www.midwesttape.com/" },
  { name: "Crayons Bridge",    domain: "crayonsbridge.com",     href: "https://www.crayonsbridge.com/" },
];

export const Partners = () => (
  <section id="partners" className="py-24 border-b border-border/40 relative">
    <div className="container">
      {/* Header */}
      <div className="mb-12 animate-fade-in text-center md:text-left max-w-3xl">
        <div className="flex items-center gap-3 mb-5 justify-center md:justify-start">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Connected Media Ecosystem
          </span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Connected <span className="gradient-text">Media Ecosystem</span>
        </h2>
        <p className="mt-4 text-lg md:text-xl text-foreground/90 font-medium">
          One upload. Unlimited opportunities.
        </p>
        <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
          StreamVista connects your films, series and shows to OTT platforms, broadcasters,
          FAST channels, TVOD, AVOD, SVOD services, digital storefronts, educational platforms
          and licensing partners through one secure workflow.
        </p>
      </div>

      {/* Partner categories */}
      <div className="mb-10">
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground/70 mb-4">
          Distribution surfaces
        </div>
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li
              key={c}
              className="inline-flex items-center rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-medium text-foreground/85 hover:border-primary/50 hover:text-foreground transition-colors"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Featured buyer logos */}
      <div className="mb-10">
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground/70 mb-4">
          Featured partners
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
          {FEATURED.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.name} — open official site in new tab`}
              title={p.name}
              className="group relative h-20 md:h-24 px-6 flex items-center justify-center bg-card hover:bg-card/70 transition-colors"
            >
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-display text-sm md:text-base font-bold uppercase tracking-[0.14em] text-text-secondary group-hover:text-foreground transition-colors">
                {p.name}
              </span>
              <img
                src={`https://logo.clearbit.com/${p.domain}?size=256`}
                alt={`${p.name} logo`}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                className="relative max-h-10 md:max-h-12 w-auto object-contain bg-card opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </a>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/partners"
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground hover:scale-[1.03] transition-transform"
        >
          Explore Partner Ecosystem <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border border-border-strong/60 hover:border-primary/60 transition-colors"
        >
          Become a Partner
        </Link>
      </div>
    </div>
  </section>
);
