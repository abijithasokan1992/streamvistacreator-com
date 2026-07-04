import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const Wordmark = () => (
  <div className="font-display font-black tracking-tight text-sm md:text-base uppercase leading-none">
    STREAMVISTA <span className="gradient-text">CLOUD X</span>
  </div>
);

const NAV_LINKS = [
  { to: "/#platform", label: "Solutions" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const Navbar = () => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="container flex items-center justify-between h-16 gap-2 sm:gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="StreamVista Cloud X home">
          <Wordmark />
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            to="/auth"
            className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
          </Link>
          <Link
            to="/auth?intent=signup"
            className="cta-guide relative text-xs md:text-sm font-semibold px-4 md:px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
};
