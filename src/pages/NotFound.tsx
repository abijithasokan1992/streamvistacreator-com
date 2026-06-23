import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-dvh bg-background text-foreground overflow-hidden">
      {/* Atmospheric backdrop */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px] pointer-events-none" />

      {/* Brand bar — typography-only wordmark */}
      <header className="relative z-10 border-b border-border/40 backdrop-blur-xl bg-background/40">
        <div className="container flex items-center h-16">
          <Link to="/" className="font-display font-black tracking-tight text-sm md:text-base uppercase leading-none">
            STREAMVISTA <span className="gradient-text">CLOUD X</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 container flex flex-col items-center justify-center text-center py-24 md:py-32">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/5 mb-8 animate-fade-in">
          <Compass className="w-3 h-3 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
            Off-script · Scene not found
          </span>
        </div>

        <h1 className="font-display font-black uppercase leading-[0.85] tracking-tight text-[clamp(5rem,18vw,12rem)] gradient-text mb-4 animate-fade-in">
          404
        </h1>

        <p className="font-display text-xl md:text-3xl font-bold uppercase tracking-tight mb-3 animate-fade-in">
          This cut doesn't exist.
        </p>
        <p className="text-sm md:text-base text-muted-foreground max-w-md mb-2 animate-fade-in">
          The link you followed may be broken, expired, or never made it past the editor's bin.
        </p>
        <code className="text-[11px] font-mono-tech text-muted-foreground mb-10 break-all max-w-md">
          {location.pathname}
        </code>

        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-md border border-border/60 hover:bg-secondary text-xs font-semibold uppercase tracking-[0.18em]"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <Link
            to="/"
            className="cta-guide h-12 px-6 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs glow-primary"
          >
            <Home className="w-4 h-4" /> Return Home
          </Link>
        </div>

        <p className="mt-12 text-[10px] font-mono-tech uppercase tracking-[0.3em] text-muted-foreground">
          © {new Date().getFullYear()} StreamVista OPC Pvt Ltd · Operated by Crayons Pictures
        </p>
      </main>
    </div>
  );
};

export default NotFound;
