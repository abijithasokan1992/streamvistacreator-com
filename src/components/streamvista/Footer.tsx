import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Cloud, ShieldCheck, type LucideIcon } from "lucide-react";
import { CrayonsNetwork } from "./CrayonsNetwork";

const PRODUCT_LINKS = [
  { to: "/#platform", label: "Solutions" },
  { to: "/pricing", label: "Pricing" },
  { to: "/creator-preview", label: "Creator Preview" },
  { to: "/partners", label: "Partners" },
  { to: "/connect", label: "Agent integrations" },
];

const COMPANY_LINKS = [
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const LEGAL_LINKS = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/ip-copyright", label: "IP & DMCA" },
  { to: "/accessibility", label: "Accessibility" },
];

const TRUST_LINKS = [
  { to: "/dmca#submit-notice", label: "Report IP infringement" },
  { to: "/dmca#grievance", label: "Grievance officer" },
  { to: "/ip-copyright", label: "IP policy" },
];

const BrandChipLabel = () => (
  <span className="inline-flex items-baseline gap-1">
    <span className="text-foreground/90 font-semibold tracking-[0.18em]">STREAMVISTA</span>
    <span className="text-muted-foreground/70 tracking-[0.22em] text-[0.85em]">CLOUD&nbsp;X</span>
  </span>
);

const TRUST: { icon: LucideIcon; label: string; content?: React.ReactNode }[] = [
  { icon: Lock, label: "HTTPS Encrypted" },
  { icon: Cloud, label: "StreamVista Cloud X", content: <BrandChipLabel /> },
  { icon: ShieldCheck, label: "IP & Copyright Compliance" },
];

const Wordmark = () => (
  <div className="font-display font-black tracking-tight text-base uppercase leading-none inline-flex items-baseline gap-2">
    <span className="text-foreground">STREAMVISTA</span>
    <span className="text-muted-foreground/70 font-semibold text-[0.72em] tracking-[0.2em]">
      CLOUD&nbsp;X
    </span>
  </div>
);

export const Footer = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <footer className="relative mt-24 border-t border-border/40">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="container py-12">
        {/* 4-column grid: Brand · Product · Company · Legal / Trust */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" aria-label="StreamVista home">
              <Wordmark />
            </Link>
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
              One Secure Cloud for Films, Series &amp; Shows
            </p>
            {isHome && (
              <ul className="mt-5 flex flex-wrap items-center gap-1.5">
                {TRUST.map(({ icon: Icon, label, content }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2 py-1 text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    <Icon className="w-3 h-3 opacity-70" strokeWidth={1.75} />
                    <span>{content ?? label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <div>
            <FooterColumn title="Legal" links={LEGAL_LINKS} />
            <div className="mt-6">
              <FooterColumn title="Trust & Safety" links={TRUST_LINKS} />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            <strong className="text-foreground/80">STREAMVISTA (OPC) PRIVATE LIMITED</strong>
            <span className="text-foreground/70"> · Ernakulam, Kerala, India.</span>
          </p>
        </div>

        {/* Crayons Network lineage promoted */}
        <div className="mt-10 pt-8 border-t border-border/40">
          <CrayonsNetwork eyebrow="Powered by The Crayons Network" />
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70 max-w-md mx-auto">
            The founding media companies behind the StreamVista ecosystem —
            <span className="text-foreground/70"> Crayons Pictures</span>,
            <span className="text-foreground/70"> Crayons Bridge</span> and
            <span className="text-foreground/70"> Crayons Loop</span>.
          </p>
        </div>
      </div>
    </footer>
  );
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-foreground/90 mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
