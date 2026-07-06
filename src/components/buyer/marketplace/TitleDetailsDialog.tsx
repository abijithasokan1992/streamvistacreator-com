import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, Send } from "lucide-react";
import type { MarketplaceTitle } from "./useMarketplaceCatalog";

export function TitleDetailsDialog({
  title,
  open,
  onOpenChange,
  isWatched,
  onToggleWatch,
  onRequestScreener,
  onRequestAcquisition,
}: {
  title: MarketplaceTitle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isWatched: boolean;
  onToggleWatch: () => void;
  onRequestScreener: () => void;
  onRequestAcquisition: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {title && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{title.title}</DialogTitle>
              {title.subtitle && (
                <DialogDescription>{title.subtitle}</DialogDescription>
              )}
            </DialogHeader>

            <div className="grid sm:grid-cols-[160px_1fr] gap-4">
              <div className="aspect-[2/3] rounded-lg bg-secondary/30 overflow-hidden">
                {title.poster_url ? (
                  <img
                    src={title.poster_url}
                    alt={`${title.title} poster`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-3 text-sm min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {title.content_type && <Badge variant="outline" className="capitalize">{title.content_type}</Badge>}
                  {title.year && <Badge variant="outline">{title.year}</Badge>}
                  {title.partner && <Badge variant="outline">{title.partner}</Badge>}
                </div>

                {title.blurb && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Synopsis</div>
                    <p className="text-foreground/90 leading-relaxed">{title.blurb}</p>
                  </div>
                )}

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Commercial information</div>
                  <p className="text-muted-foreground">
                    Territories, rights, screener and pricing details are shared privately after admin review.
                    Submit an acquisition or screener request to receive a scoped commercial packet.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={onToggleWatch} className="sm:w-auto">
                {isWatched
                  ? (<><BookmarkCheck className="w-4 h-4 mr-1.5" aria-hidden /> On watchlist</>)
                  : (<><Bookmark className="w-4 h-4 mr-1.5" aria-hidden /> Add to watchlist</>)}
              </Button>
              <Button variant="secondary" onClick={onRequestScreener} className="sm:w-auto">
                Request screener
              </Button>
              <Button onClick={onRequestAcquisition} className="sm:ml-auto">
                <Send className="w-4 h-4 mr-1.5" aria-hidden /> Request acquisition
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
