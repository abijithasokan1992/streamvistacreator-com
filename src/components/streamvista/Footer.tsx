import { Link, useLocation } from "react-router-dom";
import { Lock, Cloud, ShieldCheck, type LucideIcon } from "lucide-react";

const LEGAL_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/ip-copyright", label: "IP & DMCA" },
  { to: "/refund", label: "Refund" },
  { to: "/contact", label: "Contact" },
];

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: Lock, label: "256-bit SSL" },
  { icon: Cloud, label: "Oracle Cloud" },
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
      </div>
    </footer>
  );
};
