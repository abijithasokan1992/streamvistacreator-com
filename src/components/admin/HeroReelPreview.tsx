import { useEffect, useState } from "react";
import { ArrowRight, Star, Eye, EyeOff } from "lucide-react";

type Item = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  status?: string | null;
};

export function HeroReelPreview({ items }: { items: Item[] }) {
  const visible = items.filter(i => i.is_active !== false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= visible.length) setI(0);
  }, [visible.length, i]);

  useEffect(() => {
    if (visible.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % visible.length), 5000);
    return () => clearInterval(t);
  }, [visible.length]);

  const current = visible[i];
  const backdrop = (it?: Item) =>
    (it?.backdrop_url || it?.image_url || it?.poster_url) ?? "";

  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/40">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <Eye className="w-3.5 h-3.5" /> Live preview
          <span className="text-foreground/70">· {visible.length} active</span>
        </div>
        {visible.length > 1 && (
          <div className="flex items-center gap-1">
            {visible.map((_, k) => (
              <button
                key={k}
                onClick={() => setI(k)}
                aria-label={`Preview slide ${k + 1}`}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-1.5 bg-muted-foreground/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="aspect-[21/9] grid place-items-center text-muted-foreground text-sm gap-2">
          <EyeOff className="w-5 h-5" />
          No active items to preview
        </div>
      ) : (
        <div className="relative aspect-[21/9] overflow-hidden">
          {visible.map((it, k) => {
            const url = backdrop(it);
            const active = k === i;
            return (
              <div
                key={it.id}
                className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
                style={{ opacity: active ? 1 : 0 }}
                aria-hidden={!active}
              >
                {url ? (
                  <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-secondary" />
                )}
              </div>
            );
          })}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background))_100%)]" />
          <div className="absolute inset-0 flex items-end">
            <div className="p-5 md:p-7 max-w-xl">
              {current && (
                <div key={current.id} className="animate-[reel-rise_700ms_ease-out_both]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono-tech text-[9px] uppercase tracking-[0.3em] text-accent">
                      Featured · {String(i + 1).padStart(2, "0")} / {String(visible.length).padStart(2, "0")}
                    </span>
                    {current.is_featured && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-amber-400">
                        <Star className="w-2.5 h-2.5 fill-amber-400" /> Spotlight
                      </span>
                    )}
                    {current.status !== "published" && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                    {current.title || <span className="text-muted-foreground italic">Untitled</span>}
                  </h3>
                  {current.subtitle && (
                    <p className="mt-2 text-xs md:text-sm text-muted-foreground line-clamp-2">{current.subtitle}</p>
                  )}
                  {current.cta_label && current.cta_url && (
                    <span className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold text-xs">
                      {current.cta_label} <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes reel-rise {
          0% { opacity: 0; transform: translateY(10px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

export default HeroReelPreview;
