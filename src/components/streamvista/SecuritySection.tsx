import { ShieldCheck, Lock, KeyRound, History, Cloud, Fingerprint } from "lucide-react";

/**
 * Security & trust section — the controls a rights-holder cares about before
 * they hand over a master file or open a screener.
 *
 * Mentions Oracle Cloud as the underlying storage vendor (already used elsewhere
 * for trust signaling). Presentation-only; no data fetch.
 */

const PILLARS = [
  { icon: ShieldCheck, title: "NDA Gate", body: "Signed before any title info moves." },
  { icon: KeyRound, title: "Controlled Access", body: "Role-scoped, watermarked links." },
  { icon: Lock, title: "Secure Storage", body: "Encrypted at rest, chain-of-custody." },
  { icon: History, title: "Audit Timeline", body: "Every status, every exchange logged." },
  { icon: Cloud, title: "Oracle Cloud", body: "Enterprise durability and residency." },
  { icon: Fingerprint, title: "IP Protection", body: "DMCA and takedown built in." },
];

export const SecuritySection = () => (
  <section id="security" className="py-24 border-b border-border/40 relative overflow-hidden">
    <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
    <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[140px]" aria-hidden />
    <div className="container relative">
      <div className="mb-14 animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Security &amp; trust
          </span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Built for IP <span className="gradient-text">that can't leak.</span>
        </h2>
      </div>


      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <article key={title} className="bg-card p-6 md:p-7">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 inline-flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-bold uppercase mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
