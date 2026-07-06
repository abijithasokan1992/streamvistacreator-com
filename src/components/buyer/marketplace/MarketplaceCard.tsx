import { Bookmark, BookmarkCheck, Eye, Film, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketplaceTitle } from "./useMarketplaceCatalog";

type Action = {
  onView: (t: MarketplaceTitle) => void;
  onRequestScreener: (t: MarketplaceTitle) => void;
  onRequestAcquisition: (t: MarketplaceTitle) => void;
  onToggleWatch: (t: MarketplaceTitle) => void;
  isWatched: boolean;
};

function fmtAvailability(t: MarketplaceTitle) {
  const now = Date.now();
  const start = t.starts_at ? Date.parse(t.starts_at) : null;
  const end = t.ends_at ? Date.parse(t.ends_at) : null;
  if (start && start > now) return "Coming soon";
  if (end && end < now) return "Ended";
  return "Available";
}

export function MarketplaceCard({ t, actions }: { t: MarketplaceTitle; actions: Action }) {
  const availability = fmtAvailability(t);
  return (
    <article
      className={cn(
        "group rounded-2xl border border-border/40 bg-secondary/10 overflow-hidden",
        "flex flex-col focus-within:ring-2 focus-within:ring-accent/50"
      )}
    >
      <div className="relative aspect-[2/3] bg-secondary/40">
        {t.poster_url ? (
          <img
            src={t.poster_url}
            alt={`${t.title} poster`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <Film className="w-8 h-8" aria-hidden />
          </div>
        )}
        <button
          type="button"
          onClick={() => actions.onToggleWatch(t)}
          aria-pressed={actions.isWatched}
          aria-label={actions.isWatched ? `Remove ${t.title} from watchlist` : `Add ${t.title} to watchlist`}
          className={cn(
            "absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full backdrop-blur",
            "bg-background/70 border border-border/60 text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          )}
        >
          {actions.isWatched
            ? <BookmarkCheck className="w-4 h-4 text-accent" aria-hidden />
            : <Bookmark className="w-4 h-4" aria-hidden />}
        </button>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight truncate">{t.title}</h3>
          {t.subtitle && (
            <p className="text-xs text-muted-foreground truncate">{t.subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {t.content_type && <Badge variant="outline" className="text-[10px] capitalize">{t.content_type}</Badge>}
          {t.year && <Badge variant="outline" className="text-[10px]">{t.year}</Badge>}
          <Badge
            className={cn(
              "text-[10px]",
              availability === "Available"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-secondary text-muted-foreground border-border/60"
            )}
          >
            {availability}
          </Badge>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Commercial status: <span className="text-foreground/90">Enquire</span>
          {t.updated_at && (
            <span className="block">Updated {new Date(t.updated_at).toLocaleDateString()}</span>
          )}
        </p>

        <div className="mt-auto pt-2 grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => actions.onView(t)} className="min-h-9">
            <Eye className="w-3.5 h-3.5 mr-1" aria-hidden /> Details
          </Button>
          <Button size="sm" onClick={() => actions.onRequestAcquisition(t)} className="min-h-9">
            <Send className="w-3.5 h-3.5 mr-1" aria-hidden /> Request
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.onRequestScreener(t)}
            className="col-span-2 min-h-9"
          >
            Request screener
          </Button>
        </div>
      </div>
    </article>
  );
}
