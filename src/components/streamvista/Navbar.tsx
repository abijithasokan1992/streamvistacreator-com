import { Cloud } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const branding = useBranding();
  const logo = branding?.site_logo_url;
  const pos = branding?.site_logo_position ?? "top-left";
  const showWord = branding?.show_wordmark ?? true;

  const brandBlock = (
    <a href="/" className="flex items-center gap-2.5">
      {logo ? (
        <img src={logo} alt="Brand" className="h-9 w-auto max-w-[160px] object-contain" />
      ) : (
        <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
          <Cloud className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
      )}
      {(!logo || showWord) && (
        <div className="leading-tight">
          <div className="font-display font-bold text-sm tracking-tight">StreamVista <span className="gradient-text">Cloud X</span></div>
        </div>
      )}
    </a>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className={cn("container flex items-center h-16 gap-4", pos === "top-right" ? "justify-between" : "justify-between")}>
        {pos === "top-left" && brandBlock}
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#plan" className="hover:text-foreground transition-colors">Plan</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#onboard" className="hover:text-foreground transition-colors">Get started</a>
          <a href="/launching-special-plan" className="relative hover:text-foreground transition-colors">
            <span className="gradient-text font-medium">Launching Special</span>
            <span className="absolute -top-2 -right-3 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          </a>
          <a href="/vault" className="hover:text-foreground transition-colors">My Vault</a>
        </nav>
        {pos === "top-right" ? brandBlock : (
          <a href="/auth" className="cta-guide relative text-xs md:text-sm font-semibold px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground hover:scale-105 transition-transform">
            Log In / Sign Up
          </a>
        )}
      </div>
    </header>
  );
};
