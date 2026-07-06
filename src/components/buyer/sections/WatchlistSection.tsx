import { useMemo, useState } from "react";
import { Bookmark, Film, Search, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWatchlist } from "../hooks/useWatchlist";

type Sort = "recent" | "title-asc" | "title-desc";

export default function WatchlistSection({
  onRequestForWatch,
}: {
  onRequestForWatch: (item: { id: string; title: string }) => void;
}) {
  const { items, remove } = useWatchlist();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter(i => !q || i.title.toLowerCase().includes(q));
    if (sort === "title-asc")  out.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "title-desc") out.sort((a, b) => b.title.localeCompare(a.title));
    if (sort === "recent")     out.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return out;
  }, [items, query, sort]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-xl">Watchlist</h2>
        <p className="text-sm text-muted-foreground">
          Titles you're tracking. Add from the Marketplace to keep a shortlist for internal review.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search my watchlist…"
            className="pl-8"
            aria-label="Search watchlist"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="sm:w-44" aria-label="Sort watchlist">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently added</SelectItem>
            <SelectItem value="title-asc">Title A → Z</SelectItem>
            <SelectItem value="title-desc">Title Z → A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <Bookmark className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
          <h3 className="font-semibold">Nothing on the watchlist yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Browse the Marketplace and tap the bookmark icon to save titles here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No titles match your search.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none">
          {filtered.map(i => (
            <li key={i.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3 flex gap-3">
              <div className="w-16 h-24 rounded-md bg-secondary/40 overflow-hidden shrink-0">
                {i.posterUrl ? (
                  <img src={i.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-muted-foreground"><Film className="w-5 h-5" aria-hidden /></div>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <h3 className="text-sm font-semibold truncate">{i.title}</h3>
                {i.contentType && (
                  <p className="text-[11px] text-muted-foreground capitalize">{i.contentType}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-auto">Added {new Date(i.addedAt).toLocaleDateString()}</p>
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => onRequestForWatch({ id: i.id, title: i.title })} className="min-h-9">
                    <Send className="w-3.5 h-3.5 mr-1" aria-hidden /> Request
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(i.id)} aria-label={`Remove ${i.title} from watchlist`} className="min-h-9">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
