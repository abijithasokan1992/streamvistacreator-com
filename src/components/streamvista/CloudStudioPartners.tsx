import { useEffect, useState } from "react";
import { Film, Workflow, MonitorPlay, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Partner = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logo_url: string;
};

type Settings = {
  aspect_ratio: string;
  object_fit: string;
  container_bg: string;
};

const FALLBACK_ICONS: { icon: LucideIcon; name: string; tag: string; description: string }[] = [
  { icon: Film, name: "Crayons Pictures", tag: "Production House",
    description: "Feature films, series and branded content originating on the StreamVista Creator pipeline — from dailies to DI." },
  { icon: Workflow, name: "Crayons Bridge", tag: "Studio Workflow OS",
    description: "The connective layer between editors, colorists and producers — review, approvals and version control across continents." },
  { icon: MonitorPlay, name: "Crayons Loop", tag: "Creator Distribution",
    description: "Short-form, vertical and social cut-downs ingested directly from your StreamVista workspace to every platform." },
];

const DEFAULT_SETTINGS: Settings = { aspect_ratio: "16/9", object_fit: "contain", container_bg: "#ffffff" };

export const CloudStudioPartners = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: rows }, { data: s }] = await Promise.all([
        supabase.from("partner_logos").select("id,name,tag,description,logo_url,is_active,sort_order")
          .eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("partner_logos_settings").select("aspect_ratio,object_fit,container_bg").eq("id", true).maybeSingle(),
      ]);
      setPartners((rows as Partner[]) ?? []);
      if (s) setSettings({ aspect_ratio: s.aspect_ratio, object_fit: s.object_fit, container_bg: s.container_bg });
      setLoaded(true);
    })();
  }, []);

  const aspectStyle = { aspectRatio: settings.aspect_ratio.replace("/", " / ") };
  const useFallback = loaded && partners.length === 0;

  return (
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {useFallback
            ? FALLBACK_ICONS.map((p) => {
                const Icon = p.icon;
                return (
                  <article key={p.name}
                    className="group glass rounded-3xl p-7 flex flex-col gap-5 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-fade-in">
                    <div className="relative rounded-2xl flex items-center justify-center bg-transparent" style={aspectStyle}>
                      <Icon className="w-14 h-14 text-foreground/80 drop-shadow-[0_0_16px_hsl(var(--accent)/0.6)]" strokeWidth={1.4} />
                    </div>
                    <PartnerCopy name={p.name} tag={p.tag} description={p.description} />
                  </article>
                );
              })
            : partners.map((p) => (
                <article key={p.id}
                  className="group glass rounded-3xl p-7 flex flex-col gap-5 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-fade-in">
                  <div className="rounded-2xl flex items-center justify-center bg-transparent overflow-hidden" style={aspectStyle}>
                    {p.logo_url ? (
                      <img
                        src={p.logo_url}
                        alt={`${p.name} logo`}
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        className={`max-h-[72%] max-w-[72%] w-auto h-auto ${settings.object_fit === "cover" ? "object-cover" : "object-contain"} bg-transparent grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300`}
                      />
                    ) : (
                      <span className="font-display font-bold text-base tracking-tight text-foreground/70">{p.name}</span>
                    )}
                  </div>
                  <PartnerCopy name={p.name} tag={p.tag} description={p.description} />
                </article>
              ))}
        </div>
      </div>
    </section>
  );
};

function PartnerCopy({ name, tag, description }: { name: string; tag: string; description: string }) {
  return (
    <div>
      {tag && (
        <div className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent mb-2">{tag}</div>
      )}
      <h3 className="font-display text-xl font-bold mb-2">{name}</h3>
      {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
    </div>
  );
}
