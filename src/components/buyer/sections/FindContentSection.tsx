import { useMemo, useState } from "react";
import { Search, Loader2, Film, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarketplaceCatalog, type MarketplaceTitle } from "../marketplace/useMarketplaceCatalog";
import { MarketplaceCard } from "../marketplace/MarketplaceCard";
import { TitleDetailsDialog } from "../marketplace/TitleDetailsDialog";
import { useWatchlist } from "../hooks/useWatchlist";
import { cn } from "@/lib/utils";

type Sort = "updated" | "title-asc" | "title-desc" | "year-desc";
type Collection = "all" | "featured" | "recent" | "ready" | "feature" | "series" | "documentary" | "short" | "animation";

const COLLECTIONS: Array<{ id: Collection; label: string }> = [
  { id: "all",         label: "All titles" },
  { id: "featured",    label: "Featured" },
  { id: "recent",      label: "Recently added" },
  { id: "ready",       label: "Ready for licensing" },
  { id: "feature",     label: "Feature films" },
  { id: "series",      label: "Series" },
  { id: "documentary", label: "Documentaries" },
  { id: "short",       label: "Shorts" },
  { id: "animation",   label: "Animation" },
];

function matchesCollection(c: Collection, t: MarketplaceTitle): boolean {
  const now = Date.now();
  const start = t.starts_at ? Date.parse(t.starts_at) : null;
  const end = t.ends_at ? Date.parse(t.ends_at) : null;
  const inWindow = (!start || start <= now) && (!end || end > now);
  const type = (t.content_type ?? "").toLowerCase();
  switch (c) {
    case "all":         return true;
    case "featured":    return true;
    case "recent":      return true;
    case "ready":       return inWindow;
    case "feature":     return type.includes("feature") || type.includes("film");
    case "series":      return type.includes("series");
    case "documentary": return type.includes("doc");
    case "short":       return type.includes("short");
    case "animation":   return type.includes("anim");
    default:            return true;
  }
}

export default function FindContentSection({
  onRequestForTitle,
}: {
  onRequestForTitle: (title: MarketplaceTitle, hint: "screener" | "acquisition") => void;
}) {
  const { rows, loading, error } = useMarketplaceCatalog();
  const { has, toggle } = useWatchlist();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<Collection>("all");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const [company, setCompany] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [detail, setDetail] = useState<MarketplaceTitle | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const contentTypes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.content_type && s.add(r.content_type));
    return Array.from(s).sort();
  }, [rows]);
  const years = useMemo(() => {
    const s = new Set<number>();
    rows.forEach(r => r.year && s.add(r.year));
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);
  const companies = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.partner && s.add(r.partner));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const out = rows.filter(r => {
      if (!matchesCollection(collection, r)) return false;
      if (type !== "all" && (r.content_type ?? "") !== type) return false;
      if (year !== "all" && String(r.year ?? "") !== year) return false;
      if (company !== "all" && (r.partner ?? "") !== company) return false;
      if (availability !== "all") {
        const start = r.starts_at ? Date.parse(r.starts_at) : null;
        const end = r.ends_at ? Date.parse(r.ends_at) : null;
        const inWindow = (!start || start <= now) && (!end || end > now);
        if (availability === "available" && !inWindow) return false;
        if (availability === "coming" && !(start && start > now)) return false;
      }
      if (!q) return true;
      const hay = `${r.title} ${r.subtitle ?? ""} ${r.blurb ?? ""} ${r.partner ?? ""} ${r.content_type ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    switch (sort) {
      case "title-asc":  out.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "title-desc": out.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "year-desc":  out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      default:           out.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return out;
  }, [rows, collection, type, year, company, availability, query, sort]);

  const filtersActive = type !== "all" || year !== "all" || company !== "all" || availability !== "all";
  const clearFilters = () => { setType("all"); setYear("all"); setCompany("all"); setAvailability("all"); };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-xl">Find content</h2>
        <p className="text-sm text-muted-foreground">
          Discover titles available for licensing. Rights, territories and pricing are shared privately after admin review.
        </p>
      </header>

      {/* Global search */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, production companies, genres, languages, rights…"
            className="pl-8"
            aria-label="Search catalogue"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} className="min-h-9">
          <Filter className="w-4 h-4 mr-1.5" aria-hidden /> Filters {filtersActive && <span className="ml-1 text-[10px] font-semibold">•</span>}
        </Button>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="sm:w-44" aria-label="Sort results">
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

      {/* Collections */}
      <nav aria-label="Discovery collections" className="-mx-2 px-2 overflow-x-auto">
        <ul className="flex gap-1.5 min-w-max pb-1 list-none">
          {COLLECTIONS.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCollection(c.id)}
                aria-current={collection === c.id ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
                  collection === c.id
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-secondary/20 border-border/50 text-foreground hover:border-accent/50"
                )}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border/40 bg-secondary/10 p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Content type" value={type} onChange={setType} options={contentTypes} />
          <FilterSelect label="Year"         value={year} onChange={setYear} options={years.map(String)} />
          <FilterSelect label="Production company" value={company} onChange={setCompany} options={companies} />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Availability</label>
            <Select value={availability} onValueChange={setAvailability}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="available">Available now</SelectItem>
                <SelectItem value="coming">Coming soon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="w-3.5 h-3.5 mr-1" aria-hidden /> Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-16 grid place-items-center" role="status" aria-label="Loading catalogue">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6 text-sm text-muted-foreground">
          Catalogue is temporarily unavailable.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <Film className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
          <h3 className="font-semibold">No titles match</h3>
          <p className="text-sm text-muted-foreground mt-1">Try clearing the filters or adjusting your search.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} title{filtered.length !== 1 ? "s" : ""}</p>
            <Badge variant="outline" className="text-[10px]">Only titles you're permitted to discover</Badge>
          </div>
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
        </>
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

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map(o => (
            <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
