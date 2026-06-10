import { Link } from "react-router-dom";
import { useBranding } from "@/lib/branding";

const NAV_LINKS = [
  { href: "/#plan", label: "Solutions" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/about", label: "About OPC" },
  { href: "/support", label: "Support" },
];

const Wordmark = () => (
  <div className="leading-tight">
    <div className="font-display font-bold text-sm tracking-tight">
      StreamVista <span className="gradient-text">Cloud X</span>
    </div>
  </div>
);

export const Navbar = () => {
  const branding = useBranding();
  const logo = branding?.site_logo_url?.trim() || null;
  const showWord = branding?.show_wordmark ?? true;

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="container flex items-center h-16 gap-6">
        {/* Brand — Left */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          {logo ? (
            <>
              <img
                src={logo}
                alt="StreamVista Cloud X"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                className="h-9 md:h-10 w-auto max-w-[160px] object-contain bg-transparent border-0 outline-none shadow-none p-0"
              />
              {showWord && <Wordmark />}
            </>
          ) : (
            <Wordmark />
          )}
        </Link>

        {/* Center Nav */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-8 text-sm text-muted-foreground">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-5 ml-auto md:ml-0">
          <Link
            to="/auth"
            className="hidden sm:inline-block text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/auth?plan=free"
            className="cta-guide relative text-xs md:text-sm font-semibold px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
};
