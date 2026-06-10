import { ArrowRight, Camera, MessageSquare, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustBadges } from "./TrustBadges";

/**
 * Cinematic, conversion-focused hero.
 * One-sentence promise → 3-step demo strip → primary CTA → trust bar.
 */
export const Hero = () => (
  <section className="relative pt-28 pb-16 overflow-hidden border-b border-border/40">
    {/* Atmospheric backdrops */}
    <div className="absolute inset-0 grid-bg opacity-60" />
    <div className="absolute top-0 -left-32 w-[40rem] h-[40rem] rounded-full bg-primary/15 blur-[120px]" />
    <div className="absolute bottom-0 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary-glow/10 blur-[140px]" />

    <div className="container relative">
      {/* India-first tagline pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/40 bg-accent/5 mb-8 animate-fade-in">
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent">
          Made in India
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-end animate-fade-in">
        {/* Editorial headline */}
        <div>
          <h1 className="font-display font-black uppercase leading-[0.88] tracking-tight text-[clamp(3rem,10vw,8rem)]">
            THE CREATOR
            <br />
            CLOUD STUDIO
            <br />
            <span className="gradient-text">BUILT FOR CINEMA</span>
          </h1>
        </div>

        {/* Sidebar copy + CTA */}
        <div className="space-y-7 max-w-md">
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Upload dailies straight from set. Get frame-accurate review from your producer.
            Deliver final masters to your client — all in one cinematic cloud built for filmmakers.
          </p>

          <Link
            to="/auth?plan=free"
            className="cta-guide group relative h-14 inline-flex items-center justify-center gap-3 px-6 bg-gradient-primary text-primary-foreground font-semibold uppercase tracking-[0.18em] text-xs rounded-md w-full"
          >
            <span>Start Free — No Card Needed</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 3-step demo strip */}
      <div className="mt-16 grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden animate-fade-in">
        {[
          { icon: Camera, step: "01", title: "Upload from set", body: "Drag in dailies, RAW R3D, ProRes — direct from camera to your secure vault." },
          { icon: MessageSquare, step: "02", title: "Review with timecode", body: "Producers and directors leave frame-accurate notes. Approve cuts in one click." },
          { icon: Send, step: "03", title: "Deliver to client", body: "One signed link — branded, password-protected, watermarked. Track every view." },
        ].map(({ icon: Icon, step, title, body }) => (
          <div key={step} className="bg-background p-6 md:p-7">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">{step}</span>
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-bold mb-1.5">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Trust bar */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Trusted infrastructure
        </span>
        <TrustBadges compact />
      </div>
    </div>
  </section>
);
