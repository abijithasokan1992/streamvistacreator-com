import { Film, Layers, Briefcase } from "lucide-react";

/**
 * Who is it for — three simple cards. No CTAs (kept minimal per Sprint 001).
 */

const AUDIENCES = [
  {
    key: "creators",
    icon: Film,
    title: "Creators",
    body: "Upload and prepare content.",
  },
  {
    key: "studios",
    icon: Layers,
    title: "Studios",
    body: "Manage production and post-production.",
  },
  {
    key: "buyers",
    icon: Briefcase,
    title: "Buyers",
    body: "Discover and license titles.",
  },
] as const;

export const PlatformOverview = () => (
  <section id="platform" className="py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-14 max-w-3xl animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Who is it for?
          </span>
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
          Built for the <span className="gradient-text">whole pipeline</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {AUDIENCES.map(({ key, icon: Icon, title, body }) => (
          <article key={key} className="bg-card p-8 md:p-10 flex flex-col">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-primary-foreground border border-primary/30 mb-6"
              style={{
                backgroundImage: "var(--gradient-primary)",
                boxShadow:
                  "0 1px 0 hsl(0 0% 100% / 0.25) inset, 0 -2px 0 hsl(225 60% 6% / 0.18) inset, 0 8px 22px -10px hsl(var(--primary) / 0.6)",
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight mb-3">
              {title}
            </h3>
            <p className="text-base text-text-secondary leading-relaxed">{body}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
