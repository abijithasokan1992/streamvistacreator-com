import { Film, Tv, Clapperboard, Camera, Sparkles, Music } from "lucide-react";

/**
 * Supported content — six clear content types.
 */

const TYPES = [
  { icon: Film, label: "Feature Films" },
  { icon: Tv, label: "Series" },
  { icon: Clapperboard, label: "Short Films" },
  { icon: Camera, label: "Documentaries" },
  { icon: Sparkles, label: "Animation" },
  { icon: Music, label: "Music Videos" },
];

export const SupportedContent = () => (
  <section id="content" className="py-16 sm:py-24 border-b border-border/40 relative">
    <div className="container">
      <div className="mb-14 text-center max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-8 h-px bg-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            Supported content
          </span>
          <div className="w-8 h-px bg-accent" />
        </div>
        <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-5xl">
          Every format, <span className="gradient-text">one platform</span>
        </h2>
      </div>

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border/60 border border-border/60 rounded-2xl overflow-hidden">
        {TYPES.map(({ icon: Icon, label }) => (
          <li key={label} className="bg-card p-6 md:p-7 flex flex-col items-center text-center gap-3">
            <div
              className="w-11 h-11 rounded-lg grid place-items-center border border-primary/30 bg-primary/10 text-primary"
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="font-display text-sm md:text-base font-bold uppercase tracking-tight">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
