import { HardDrive, ShieldCheck, Share2, Users, Archive, LifeBuoy, RefreshCw } from "lucide-react";

const features = [
  { icon: HardDrive, title: "Cloud Storage", desc: "Secure, scalable storage for all your media." },
  { icon: ShieldCheck, title: "Top Security", desc: "Fully encrypted files with custom access controls." },
  { icon: RefreshCw, title: "Smart Uploads", desc: "Auto-resume your uploads, even if you go offline." },
  { icon: Share2, title: "Safe Sharing", desc: "Share links with passwords, expiry, and download limits." },
  { icon: Users, title: "Team Access", desc: "2 concurrent users for easy collaboration." },
  { icon: Archive, title: "Cold Archive", desc: "Long-term storage for your finished projects." },
  { icon: LifeBuoy, title: "Pro Onboarding", desc: "Expert help with setup and data migration." },
];


export const PlanFeature = () => (
  <section id="plan" className="py-28 relative border-b border-border/40">
    <div className="container">
      {/* Editorial header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-fade-in">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Production Standards
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-7xl">
            Professional tools.
            <br />
            <span className="gradient-text">Scalable plans.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
          Everything a studio, VFX house, or independent creator needs to ship —
          from free tier to full production scale.
        </p>
      </div>

      {/* Editorial list */}
      <div className="border-t border-border/60">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="group grid grid-cols-[auto_1fr_auto] gap-4 md:gap-10 items-start py-8 md:py-10 border-b border-border/60 hover:bg-primary/[0.03] transition-colors px-2 -mx-2 animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="font-mono-tech text-xs text-muted-foreground pt-2 w-10">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="grid md:grid-cols-[1.1fr_1.4fr] gap-2 md:gap-10 items-start">
              <h3 className="font-display font-bold uppercase text-2xl md:text-3xl tracking-tight">
                {title}
              </h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md">
                {desc}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full border border-border grid place-items-center group-hover:border-primary group-hover:bg-primary/10 transition-colors">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
