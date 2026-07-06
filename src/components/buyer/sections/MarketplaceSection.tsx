import { useMemo, useState } from "react";
import { Search, Loader2, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMarketplaceCatalog, type MarketplaceTitle } from "../marketplace/useMarketplaceCatalog";
import { MarketplaceCard } from "../marketplace/MarketplaceCard";
import { TitleDetailsDialog } from "../marketplace/TitleDetailsDialog";
import { useWatchlist } from "../hooks/useWatchlist";

type Sort = "updated" | "title-asc" | "title-desc" | "year-desc";

export default function MarketplaceSection({
  onRequestForTitle,
}: {
  onRequestForTitle: (title: MarketplaceTitle, hint: "screener" | "acquisition") => void;
}) {
  const { rows, loading, error } = useMarketplaceCatalog();
  const { has, toggle } = useWatchlist();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [detail, setDetail] = useState<MarketplaceTitle | null>(null);

  const contentTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.content_type && set.add(r.content_type));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(r => {
      if (type !== "all" && (r.content_type ?? "") !== type) return false;
      if (!q) return true;
      const hay = `${r.title} ${r.subtitle ?? ""} ${r.blurb ?? ""} ${r.partner ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    switch (sort) {
      case "title-asc":  out.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "title-desc": out.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "year-desc":  out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      default:           out.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return out;
  }, [rows, query, type, sort]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-xl">Marketplace</h2>
        <p className="text-sm text-muted-foreground">
          Browse commercially available titles. Detailed rights, territories and pricing are shared privately after admin review.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, partners, keywords…"
            className="pl-8"
            aria-label="Search marketplace"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by content type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {contentTypes.map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="sm:w-44" aria-label="Sort marketplace">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="title-asc">Title A → Z</SelectItem>
            <SelectItem value="title-desc">Title Z → A</SelectItem>
            <SelectItem value="year-desc">Newest year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center" role="status" aria-label="Loading marketplace">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6 text-sm text-muted-foreground">
          Marketplace is temporarily unavailable.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <Film className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
          <h3 className="font-semibold">No titles match</h3>
          <p className="text-sm text-muted-foreground mt-1">Try clearing the filters or adjusting your search.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 list-none">
          {filtered.map(t => (
            <li key={t.id}>
              <MarketplaceCard
                t={t}
                actions={{
                  isWatched: has(t.id),
                  onToggleWatch: (x) => toggle({ id: x.id, title: x.title, posterUrl: x.poster_url, contentType: x.content_type }),
                  onView: setDetail,
                  onRequestScreener: (x) => onRequestForTitle(x, "screener"),
                  onRequestAcquisition: (x) => onRequestForTitle(x, "acquisition"),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <TitleDetailsDialog
        title={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        isWatched={detail ? has(detail.id) : false}
        onToggleWatch={() => detail && toggle({ id: detail.id, title: detail.title, posterUrl: detail.poster_url, contentType: detail.content_type })}
        onRequestScreener={() => { if (detail) { onRequestForTitle(detail, "screener"); setDetail(null); } }}
        onRequestAcquisition={() => { if (detail) { onRequestForTitle(detail, "acquisition"); setDetail(null); } }}
      />
    </section>
  );
}
