import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";

const SUBMIT_CONTENT_URL = "https://www.crayonsloop.com/login";

/**
 * Brand hierarchy: STREAMVISTA is heavy/primary; "Cloud X" is muted secondary.
 */
const Wordmark = ({ size = "sm" }: { size?: "sm" | "md" }) => (
  <div className={`font-display font-black tracking-tight uppercase leading-none ${size === "md" ? "text-lg" : "text-sm md:text-base"}`}>
    <span className="text-foreground">STREAMVISTA</span>
    <span className="ml-1.5 text-muted-foreground/70 font-semibold text-[0.72em] tracking-[0.2em] align-middle">
      CLOUD X
    </span>
  </div>
);

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/#platform", label: "Solutions" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/creator-preview", label: "Creator Preview" },
  { to: "/partners", label: "Partners" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const signedIn = !loading && !!user;
  const dashHref = dashboardForRole(role);

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="container flex items-center justify-between h-16 gap-2 sm:gap-4">
        <Link to="/" className="flex items-center gap-3 shrink-0" aria-label="StreamVista home">
          <Wordmark />
        </Link>

        <nav className="hidden xl:flex items-center gap-5" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <ThemeToggle className="hidden sm:inline-flex" />
          {signedIn ? (
            <Link
              to={dashHref}
              className="cta-guide relative inline-flex items-center gap-2 text-xs md:text-sm font-semibold px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform whitespace-nowrap"
              aria-label="Open your dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden sm:inline text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Log in to StreamVista"
              >
                Login
              </Link>
              <a
                href={SUBMIT_CONTENT_URL}
                className="cta-guide relative text-xs md:text-sm font-semibold px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform whitespace-nowrap"
                aria-label="Submit content for licensing review"
              >
                Submit Content
              </a>
            </>
          )}

          {/* Compact menu stays active through tablet widths to avoid nav crowding. */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="xl:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Wordmark size="md" />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile primary">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="py-3 px-2 text-base border-b border-border/40 text-foreground hover:text-accent transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link
                  to={signedIn ? dashHref : "/auth"}
                  onClick={() => setOpen(false)}
                  className="mt-4 py-3 px-2 text-sm uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                >
                  {signedIn ? "Dashboard" : "Login"}
                </Link>
                {!signedIn && (
                  <a
                    href={SUBMIT_CONTENT_URL}
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-gradient-primary px-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground"
                  >
                    Submit Content
                  </a>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
