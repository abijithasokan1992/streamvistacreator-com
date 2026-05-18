import { Cloud } from "lucide-react";

export const Navbar = () => (
  <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
    <div className="container flex items-center justify-between h-16">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
          <Cloud className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold text-sm tracking-tight">StreamVista <span className="gradient-text">Cloud X</span></div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Crayons Creator Portal</div>
        </div>
      </div>
      <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#plan" className="hover:text-foreground transition-colors">Plan</a>
        <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        <a href="#onboard" className="hover:text-foreground transition-colors">Onboarding</a>
      </nav>
      <a href="#onboard" className="text-xs md:text-sm font-medium px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground glow-primary hover:scale-105 transition-transform">
        Reserve Cloud
      </a>
    </div>
  </header>
);
