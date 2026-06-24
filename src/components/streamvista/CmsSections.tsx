import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, ArrowRight } from "lucide-react";

type Banner = { id: string; headline: string; subheadline: string | null; image_url: string | null; cta_label: string | null; cta_url: string | null };
type Ad = { id: string; slot: "top"|"mid"|"bottom"; title: string; image_url: string | null; link_url: string | null };
type Film = { id: string; title: string; blurb: string | null; poster_url: string | null; link_url: string | null };
type Item = { id: string; kind: "news"|"event"; title: string; summary: string | null; image_url: string | null; link_url: string | null; event_date: string | null; location: string | null };

function useList<T>(table: string) {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    let active = true;
    (supabase as any).from(table).select("*").order("sort_order").order("created_at", { ascending: false })
      .then(({ data }: any) => { if (active) setRows((data as T[]) ?? []); });
    return () => { active = false; };
  }, [table]);
  return rows;
}

export function CmsHeroBanners() {
  const banners = useList<Banner>("hero_banners");
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[i % banners.length];
  return (
    <section className="container py-10">
      <div className="relative overflow-hidden rounded-3xl glass-strong border border-border/40">
        {b.image_url && <img src={b.image_url} alt={b.headline} className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="relative p-8 md:p-14 max-w-3xl">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{b.headline}</h2>
          {b.subheadline && <p className="mt-3 text-base md:text-lg text-muted-foreground">{b.subheadline}</p>}
          {b.cta_url && b.cta_label && (
            <a href={b.cta_url} className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm">
              {b.cta_label} <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {banners.map((_, k) => (
              <button key={k} aria-label={`Slide ${k+1}`} onClick={() => setI(k)} className={`w-2 h-2 rounded-full transition ${k === i % banners.length ? "bg-accent w-6" : "bg-muted-foreground/40"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CmsAdZone({ slot }: { slot: "top"|"mid"|"bottom" }) {
  const ads = useList<Ad>("ad_zones").filter(a => a.slot === slot);
  if (!ads.length) return null;
  return (
    <section className="container py-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map(a => (
          <a key={a.id} href={a.link_url ?? "#"} target={a.link_url ? "_blank" : undefined} rel="noopener noreferrer"
             className="group block rounded-2xl overflow-hidden border border-border/50 bg-secondary/30 hover:border-accent/50 transition">
            {a.image_url && <img src={a.image_url} alt={a.title} className="w-full aspect-[16/7] object-cover group-hover:scale-[1.02] transition" />}
            <div className="p-3 text-sm font-medium">{a.title}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CmsFeaturedFilms() {
  const films = useList<Film>("featured_films");
  if (!films.length) return null;
  return (
    <section className="container py-12">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Our Licensed Film Portfolio</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
        {films.map(f => (
          <a key={f.id} href={f.link_url ?? "#"} className="group block rounded-2xl overflow-hidden border border-border/50 bg-secondary/30 hover:border-accent/50 transition">
            {f.poster_url
              ? <img src={f.poster_url} alt={f.title} className="w-full aspect-[2/3] object-cover group-hover:scale-[1.03] transition" />
              : <div className="w-full aspect-[2/3] bg-secondary" />}
            <div className="p-4 space-y-1">
              <div className="font-semibold text-sm">{f.title}</div>
              {f.blurb && <p className="text-xs text-muted-foreground line-clamp-2">{f.blurb}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CmsNewsEvents() {
  const items = useList<Item>("news_events");
  if (!items.length) return null;
  const news = items.filter(i => i.kind === "news");
  const events = items.filter(i => i.kind === "event");
  return (
    <section className="container py-12 grid lg:grid-cols-2 gap-10">
      {news.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-bold mb-5">Latest news</h2>
          <ul className="space-y-4">
            {news.map(n => (
              <li key={n.id} className="rounded-2xl border border-border/50 bg-secondary/20 overflow-hidden flex gap-4">
                {n.image_url && <img src={n.image_url} alt={n.title} className="w-28 h-28 object-cover shrink-0" />}
                <div className="p-3 flex-1 min-w-0">
                  <a href={n.link_url ?? "#"} className="font-semibold hover:text-accent">{n.title}</a>
                  {n.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.summary}</p>}
                  {n.event_date && <div className="text-[11px] text-muted-foreground mt-1.5">{new Date(n.event_date).toLocaleDateString()}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {events.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-bold mb-5">Upcoming events</h2>
          <ul className="space-y-4">
            {events.map(ev => (
              <li key={ev.id} className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                <a href={ev.link_url ?? "#"} className="font-semibold hover:text-accent">{ev.title}</a>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  {ev.event_date && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(ev.event_date).toLocaleString()}</span>}
                  {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</span>}
                </div>
                {ev.summary && <p className="text-xs text-muted-foreground mt-2">{ev.summary}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
