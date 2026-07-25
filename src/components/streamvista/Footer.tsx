import { Link } from "react-router-dom";
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

const Wordmark = () => (
  <div className="font-display font-black tracking-tight text-base uppercase leading-none inline-flex items-baseline gap-2">
    <span className="text-foreground">STREAMVISTA</span>
    <span className="text-muted-foreground/70 font-semibold text-[0.72em] tracking-[0.2em]">
      CLOUD&nbsp;X
    </span>
  </div>
);

export const Footer = () => {
  return (
    <footer className="relative border-t border-border/40">
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
            <span className="opacity-60"> · Ernakulam, Kerala, India.</span>
          </p>
        </div>

        {/* Crayons Network lineage promoted */}
        <div className="mt-10 pt-8 border-t border-border/40">
          <CrayonsNetwork eyebrow="Powered by The Crayons Network" />
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
