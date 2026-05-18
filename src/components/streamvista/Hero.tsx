import { Sparkles, ShieldCheck, Zap } from "lucide-react";

export const Hero = () => (
  <section className="relative pt-32 pb-20 overflow-hidden">
    <div className="absolute inset-0 grid-bg" />
    <div className="absolute top-1/3 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-float" />
    <div className="absolute bottom-0 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary-glow/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

    <div className="container relative">
      <div className="max-w-4xl mx-auto text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          Launch Partner Program · India Region
        </div>

        <h1 className="font-display font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-6">
          The Creator Cloud
          <br />
          <span className="gradient-text">built for cinema.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          StreamVista Cloud X powers studios, post houses, VFX teams and digital creators with
          sovereign storage, secure collaboration and enterprise-grade reliability.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#pricing" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-primary text-primary-foreground font-semibold glow-primary hover:scale-105 transition-transform">
            View Launch Plan
          </a>
          <a href="#onboard" className="w-full sm:w-auto px-8 py-3.5 rounded-full glass text-foreground font-semibold hover:border-primary/50 transition-colors">
            Start Onboarding →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Zap, label: "50 TB", sub: "Month-1 allocation" },
            { icon: ShieldCheck, label: "99.9%", sub: "Uptime SLA" },
            { icon: Sparkles, label: "India", sub: "Sovereign region" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="glass rounded-2xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 grid place-items-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-display font-bold text-xl">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
