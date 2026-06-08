import { Link } from "react-router-dom";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { TrustBadges } from "./TrustBadges";

const LEGAL_LINKS = [
  { to: "/about", label: "About & Support" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/ip-copyright", label: "IP & DMCA" },
  { to: "/refund", label: "Refund" },
];

export const Footer = () => {
  const b = useBranding();
  const logo = b?.footer_logo_url;
  const pos = b?.footer_logo_position ?? "footer-left";
  return (
    <footer className="border-t border-border/40 mt-16">
      <div className="container py-10 space-y-8">
        <TrustBadges className="justify-center md:justify-start" />

        <div
          className={cn(
            "flex flex-col md:flex-row md:items-center gap-6 md:gap-4",
            pos === "footer-right" ? "md:justify-end" : "md:justify-between",
          )}
        >
          <div className="flex items-center gap-4">
            {logo ? (
              <img
                src={logo}
                alt="StreamVista Cloud X"
                className="h-10 w-auto max-w-[180px] object-contain opacity-80"
              />
            ) : null}
            <div className="text-xs text-muted-foreground leading-relaxed">
              © {new Date().getFullYear()} <strong className="text-foreground/80">StreamVista OPC Pvt Ltd</strong>
              <span className="opacity-60"> · Operated by Crayons Pictures · Ernakulam, Kerala, India</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {LEGAL_LINKS.map(l => (
              <Link key={l.to} to={l.to} className="hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
