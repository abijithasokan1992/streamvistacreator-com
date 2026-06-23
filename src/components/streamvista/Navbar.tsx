import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const Wordmark = () => (
  <div className="font-display font-black tracking-tight text-sm md:text-base uppercase leading-none">
    STREAMVISTA <span className="gradient-text">CLOUD X</span>
  </div>
);

export const Navbar = () => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="container flex items-center justify-between h-16 gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="StreamVista Cloud X home">
          <Wordmark />
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="/#for" className="text-xs text-muted-foreground hover:text-foreground transition-colors">For</a>
          <a href="/#pricing" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            to="/contact"
            className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </Link>
          <Link
            to="/auth"
            className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/auth?intent=signup"
            className="cta-guide relative text-xs md:text-sm font-semibold px-4 md:px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform"
          >
            <span className="hidden sm:inline">Get Started</span>
            <span className="sm:hidden">Sign Up</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
