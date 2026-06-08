import { Film, Workflow, MonitorPlay, type LucideIcon } from "lucide-react";

type Partner = {
  icon: LucideIcon;
  name: string;
  tag: string;
  desc: string;
  accent: string; // tailwind gradient classes
};

const PARTNERS: Partner[] = [
  {
    icon: Film,
    name: "Crayons Pictures",
    tag: "Production House",
    desc: "Feature films, series and branded content originating on the Cloud X pipeline — from dailies to DI.",
    accent: "from-primary/30 via-primary-glow/20 to-transparent",
  },
  {
    icon: Workflow,
    name: "Crayons Bridge",
    tag: "Studio Workflow OS",
    desc: "The connective layer between editors, colorists and producers — review, approvals and version control across continents.",
    accent: "from-primary-glow/30 via-primary/20 to-transparent",
  },
  {
    icon: MonitorPlay,
    name: "Crayons Loop",
    tag: "Creator Distribution",
    desc: "Short-form, vertical and social cut-downs ingested directly from your Cloud X workspace to every platform.",
    accent: "from-accent/30 via-accent/10 to-transparent",
  },
];

export const CloudStudioPartners = () => (
  <section id="partners" className="py-28 border-t border-border/40">
    <div className="container">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              Ecosystem — Cloud Studio Partners
            </span>
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-5xl md:text-6xl">
            Built with our
            <br />
            <span className="gradient-text">cloud studio partners.</span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          The Crayons creative network powers every workspace — production, workflow and distribution operating as one Cloud X fabric.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PARTNERS.map((p) => {
          const Icon = p.icon;
          return (
            <article
              key={p.name}
              className="group glass rounded-3xl p-7 flex flex-col gap-5 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-fade-in"
            >
              <div
                className={`relative h-28 rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br ${p.accent} grid place-items-center`}
              >
                <div className="absolute inset-0 grid-bg opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="relative flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl glass-strong grid place-items-center group-hover:scale-105 transition-transform">
                    <Icon className="w-7 h-7 text-accent drop-shadow-[0_0_12px_hsl(var(--accent)/0.7)]" strokeWidth={1.6} />
                  </div>
                  <span className="font-display text-xl font-bold tracking-tight text-foreground">
                    {p.name.replace("Crayons ", "")}
                  </span>
                </div>
              </div>
              <div>
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                  {p.tag}
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{p.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  </section>
);
