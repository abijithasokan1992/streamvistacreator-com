import { Link, useLocation } from "react-router-dom";
import { Lock, CreditCard, Cloud, ShieldCheck, type LucideIcon } from "lucide-react";
import { useBranding } from "@/lib/branding";

type FooterLink = { to: string; label: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "StreamVista OPC",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/about#partner", label: "Partner with OPC" },
      { to: "/about#contact", label: "Contact OPC" },
      { to: "/about#investors", label: "Finance & Investors" },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/support", label: "Help Center" },
      { to: "/support#guide", label: "Creator Studio Guide" },
      { to: "/support#status", label: "System Status" },
    ],
  },
  {
    title: "Legal & Compliance",
    links: [
      { to: "/terms", label: "Terms & Conditions (OPC IP)" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/ip-copyright", label: "IP & DMCA Policy" },
      { to: "/refund", label: "Refund Policy" },
    ],
  },
];

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: Lock, label: "256-bit SSL Secure" },
  { icon: CreditCard, label: "100% Secure Payments" },
  { icon: Cloud, label: "Oracle Cloud · 99.9% SLA" },
  { icon: ShieldCheck, label: "DMCA Protected" },
];

export const Footer = () => {
  const b = useBranding();
  const logo = b?.footer_logo_url;
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <footer className="relative mt-24 border-t border-border/40">
      {/* Ambient glass glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60"
           style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(220 95% 62% / 0.08), transparent 60%)" }} />

      <div className="container py-14">
        {/* Top: Brand blurb + 3 link columns => 4-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand column */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              {logo ? (
                <img src={logo} alt="StreamVista Cloud X" className="h-10 w-auto max-w-[160px] object-contain" />
              ) : (
                <div className="font-display font-bold text-base tracking-tight">
                  StreamVista <span className="gradient-text">Cloud X</span>
                </div>
              )}
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-[260px]">
              Premium cinematic cloud workspace for filmmakers, studios, and independent creators —
              engineered by StreamVista OPC Pvt Ltd.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="space-y-4">
              <h4 className="text-[11px] font-mono-tech uppercase tracking-[0.22em] text-foreground/80">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Glass divider */}
        <div className="relative my-10 h-px w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent blur-sm" />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            <strong className="text-foreground/80">StreamVista OPC Pvt Ltd</strong>
            <span className="opacity-60"> · Operated by Crayons Pictures · Ernakulam, Kerala, India.</span>
          </p>

          {isHome && (
            <ul className="flex flex-wrap items-center gap-2 md:gap-2.5">
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  title={label}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-foreground/[0.02] backdrop-blur-xl px-2.5 py-1 text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Icon className="w-3 h-3 opacity-70 group-hover:opacity-100" strokeWidth={1.75} />
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
