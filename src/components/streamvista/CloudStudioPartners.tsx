import pictures from "@/assets/partner-crayons-pictures.png";
import bridge from "@/assets/partner-crayons-bridge.png";
import loop from "@/assets/partner-crayons-loop.png";

const PARTNERS = [
  {
    logo: pictures,
    name: "Crayons Pictures",
    tag: "Production House",
    desc: "Feature films, series and branded content originating on the Cloud X pipeline — from dailies to DI.",
  },
  {
    logo: bridge,
    name: "Crayons Bridge",
    tag: "Studio Workflow OS",
    desc: "The connective layer between editors, colorists and producers — review, approvals and version control across continents.",
  },
  {
    logo: loop,
    name: "Crayons Loop",
    tag: "Creator Distribution",
    desc: "Short-form, vertical and social cut-downs ingested directly from your Cloud X workspace to every platform.",
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
        {PARTNERS.map((p) => (
          <article
            key={p.name}
            className="group glass rounded-3xl p-7 flex flex-col gap-5 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-fade-in"
          >
            <div className="h-24 rounded-2xl bg-white grid place-items-center p-5 overflow-hidden">
              <img
                src={p.logo}
                alt={`${p.name} logo`}
                loading="lazy"
                className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition-transform"
              />
            </div>
            <div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                {p.tag}
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{p.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);
