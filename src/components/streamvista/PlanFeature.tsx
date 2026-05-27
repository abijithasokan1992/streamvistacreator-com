import { HardDrive, MapPin, Activity, Users, Archive, LifeBuoy } from "lucide-react";

const features = [
  { icon: HardDrive, title: "Cloud Storage", desc: "Scalable, secure storage for your production assets." },
  { icon: MapPin, title: "India Region", desc: "Data sovereignty with low-latency Mumbai-region storage." },
  { icon: Activity, title: "99.9% Uptime SLA", desc: "Enterprise-grade reliability for production workloads." },
  { icon: Users, title: "2 Concurrent Users", desc: "Collaborate seamlessly across teams and timelines." },
  { icon: Archive, title: "Archive Support", desc: "Cold storage tier for delivered projects and masters." },
  { icon: LifeBuoy, title: "Onboarding Support", desc: "White-glove setup, training and migration assistance." },
];

export const PlanFeature = () => (
  <section id="plan" className="py-24 relative">
    <div className="container">
      <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-4">Cloud X Plan</div>
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
          One plan. <span className="gradient-text">Built for production.</span>
        </h2>
        <p className="text-muted-foreground">Everything a studio, VFX house, or independent creator needs to ship.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="glass rounded-2xl p-6 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-primary grid place-items-center mb-5 glow-primary">
              <Icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
