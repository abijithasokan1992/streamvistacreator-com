import { Link, useLocation } from "react-router-dom";
import { Lock, Cloud, ShieldCheck, type LucideIcon } from "lucide-react";
import { CrayonsNetwork } from "./CrayonsNetwork";

const LEGAL_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/connect", label: "Agent integrations" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/ip-copyright", label: "IP & DMCA" },
  { to: "/contact", label: "Contact" },
];

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: Lock, label: "256-bit SSL" },
  { icon: Cloud, label: "StreamVista Cloud X" },
  { icon: ShieldCheck, label: "DMCA Protected" },
];

export const Footer = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <footer className="relative mt-24 border-t border-border/40">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="container py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <Link to="/" className="font-display font-black tracking-tight text-base uppercase">
            STREAMVISTA <span className="gradient-text">CLOUD X</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Trust &amp; Safety</span>
          <Link to="/dmca#submit-notice" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Report IP infringement</Link>
          <Link to="/dmca#grievance" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Grievance officer</Link>
          <Link to="/ip-copyright" className="text-xs text-muted-foreground hover:text-foreground transition-colors">IP policy</Link>
        </div>

        <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            <strong className="text-foreground/80">StreamVista OPC Pvt Ltd</strong>
            <span className="opacity-60"> · Ernakulam, Kerala, India.</span>
          </p>

          {isHome && (
            <ul className="flex flex-wrap items-center gap-2">
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <Icon className="w-3 h-3 opacity-70" strokeWidth={1.75} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-10 pt-6 border-t border-border/40">
          <CrayonsNetwork />
          <p className="mt-6 text-center text-[11px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground opacity-50">
            StreamVista Syndicates — Powered by The Crayons Network
            <span className="mx-2">·</span>
            Crayons Pictures <span className="mx-1.5">•</span>
            Crayons Bridge <span className="mx-1.5">•</span>
            Crayons Loop
          </p>
        </div>
      </div>
    </footer>
  );
};
