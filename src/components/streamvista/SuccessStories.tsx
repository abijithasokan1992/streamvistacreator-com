import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film as FilmIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Success stories carousel — admin-controlled poster showcase.
 *
 * Pulls from the `featured_films` CMS table (managed in Admin).
 * Rendered as a horizontal poster carousel; falls back to a quiet empty state
 * so the homepage never breaks while the catalogue is being populated.
 */

type Film = {
  id: string;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  poster_url: string | null;
  link_url: string | null;
  content_type: string | null;
  year: number | null;
  partner: string | null;
};

export const SuccessStories = () => {
  const [films, setFilms] = useState<Film[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("featured_films")
      .select("*")
      .eq("is_active", true)
      .eq("status", "published")
      .order("sort_order")
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        if (active) setFilms((data as Film[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: "smooth" });
  };

  return (
    <section id="success" className="py-24 border-b border-border/40 relative overflow-hidden">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-px bg-accent" />
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                Licensed catalogue
              </span>
            </div>
            <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
              Successfully Licensed
              <br />
              <span className="gradient-text">Contents by StreamVista</span>
            </h2>
          </div>
          {films.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Scroll posters left"
                onClick={() => scrollBy(-1)}
                className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Scroll posters right"
                onClick={() => scrollBy(1)}
                className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-border/60 hover:border-accent/60 hover:bg-accent/5 text-foreground transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {films.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
            <FilmIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Licensed titles and catalogue highlights will appear here as StreamVista publishes them.
            </p>
          </div>
        ) : (
          <div
            ref={scrollerRef}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-thin"
          >
            {films.map((f) => {
              const Card = (
                <div className="w-[220px] md:w-[260px] shrink-0 snap-start group">
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-card group-hover:border-accent/60 transition-colors">
                    {f.poster_url ? (
                      <img
                        src={f.poster_url}
                        alt={`${f.title} poster`}
                        loading="lazy"
                        className="w-full aspect-[2/3] object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-secondary flex items-center justify-center">
                        <FilmIcon className="w-8 h-8 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 px-1">
                    <div className="font-display text-base font-bold uppercase tracking-tight">
                      {f.title}
                    </div>
                    {(f.content_type || f.year || f.partner) && (
                      <div className="text-[10px] uppercase tracking-[0.18em] text-accent mt-1">
                        {[f.content_type, f.year, f.partner].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {f.subtitle && (
                      <div className="text-xs text-foreground/80 mt-1">{f.subtitle}</div>
                    )}
                    {f.blurb && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {f.blurb}
                      </p>
                    )}
                  </div>
                </div>
              );
              return f.link_url ? (
                <a key={f.id} href={f.link_url} className="contents">
                  {Card}
                </a>
              ) : (
                <div key={f.id} className="contents">
                  {Card}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
