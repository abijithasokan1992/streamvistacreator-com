import { Bookmark, Film, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/components/buyer/hooks/useWatchlist";

/**
 * Buyer Watchlist — restored surface listing every title the buyer has
 * bookmarked from the marketplace. Client-side only (localStorage-backed
 * via useWatchlist); no schema changes required.
 */
export default function WatchlistSection({
  onGoFind,
}: {
  onGoFind?: () => void;
}) {
  const { items, remove } = useWatchlist();

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Watchlist</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Titles you're tracking. Bookmarks live on this device.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onGoFind}>
          Browse marketplace
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/10 p-8 text-center">
          <Bookmark className="w-6 h-6 mx-auto text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">Your watchlist is empty.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add titles from Find Content to keep an eye on them here.
          </p>
        </div>
      ) : (
        <ul
          role="list"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-border/40 bg-secondary/10 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[2/3] bg-secondary/40">
                {it.posterUrl ? (
                  <img
                    src={it.posterUrl}
                    alt={`${it.title} poster`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <Film className="w-8 h-8" aria-hidden />
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{it.title}</h3>
                  {it.contentType && (
                    <p className="text-[11px] text-muted-foreground capitalize truncate">
                      {it.contentType}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Added {new Date(it.addedAt).toLocaleDateString()}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1">
                  <Button asChild size="sm" variant="secondary" className="min-h-9">
                    <Link to={`/?title=${encodeURIComponent(it.id)}`}>Open</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() => remove(it.id)}
                    aria-label={`Remove ${it.title} from watchlist`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden /> Remove
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
