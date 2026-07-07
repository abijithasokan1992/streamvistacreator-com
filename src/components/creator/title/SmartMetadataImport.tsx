// Smart Metadata Import — dialog reused inside the Title Workspace (Details tab).
//
// Flow: search → pick candidate → preview normalized fields → import.
// The dialog only writes to fields listed in IMPORTABLE_FIELDS, and by default
// never overwrites values the creator has already entered — the creator can
// opt into per-field overwrite from the preview screen. Nothing here submits,
// approves or bypasses the existing Draft → Submit → QC → Legal workflow.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TitleMetadata } from "@/lib/creator/titleSchema";
import {
  searchMetadata,
  previewMetadata,
  type MetadataSearchResult,
  type MetadataPreview,
} from "@/lib/creator/metadataProviders";

type FieldRow = {
  key: keyof MetadataPreview;
  label: string;
  currentDisplay: string;
  incomingDisplay: string;
  hasIncoming: boolean;
  currentEmpty: boolean;
};

export function SmartMetadataImportButton({
  meta,
  currentTitle,
  onApply,
  disabled,
}: {
  meta: TitleMetadata;
  currentTitle: string;
  onApply: (next: {
    title?: string;
    metadataPatch: Partial<TitleMetadata> & { release_date?: string };
  }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10",
          "px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Smart Metadata Import
      </button>
      {open && (
        <SmartMetadataImportDialog
          meta={meta}
          currentTitle={currentTitle}
          onClose={() => setOpen(false)}
          onApply={(next) => {
            onApply(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SmartMetadataImportDialog({
  meta,
  currentTitle,
  onClose,
  onApply,
}: {
  meta: TitleMetadata;
  currentTitle: string;
  onClose: () => void;
  onApply: (next: {
    title?: string;
    metadataPatch: Partial<TitleMetadata> & { release_date?: string };
  }) => void;
}) {
  const [query, setQuery] = useState(currentTitle || "");
  const [year, setYear] = useState<string>(meta.production_year ? String(meta.production_year) : "");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MetadataSearchResult[] | null>(null);
  const [selecting, setSelecting] = useState<string | number | null>(null);
  const [preview, setPreview] = useState<MetadataPreview | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      toast.info("Enter a title to search.");
      return;
    }
    setSearching(true);
    setResults(null);
    setPreview(null);
    try {
      const y = year.trim() ? Number(year.trim()) : undefined;
      const list = await searchMetadata(q, { year: y && Number.isFinite(y) ? y : undefined });
      setResults(list);
      if (list.length === 0) toast.info("No matches found. Try a different title or year.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(r: MetadataSearchResult) {
    setSelecting(r.id);
    setPreview(null);
    try {
      const p = await previewMetadata(r.id, r.kind);
      setPreview(p);
      // Default: pre-check fields that add info without overwriting.
      const rows = computeRows(meta, currentTitle, p);
      const initial: Record<string, boolean> = {};
      for (const row of rows) {
        initial[row.key] = row.hasIncoming && row.currentEmpty;
      }
      setSelection(initial);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load details. Please try another result.");
    } finally {
      setSelecting(null);
    }
  }

  const rows = useMemo(
    () => (preview ? computeRows(meta, currentTitle, preview) : []),
    [preview, meta, currentTitle],
  );

  function applyImport() {
    if (!preview) return;
    const patch: Partial<TitleMetadata> & { release_date?: string } = {};
    let nextTitle: string | undefined;
    for (const row of rows) {
      if (!selection[row.key]) continue;
      const val = (preview as any)[row.key];
      if (row.key === "title") nextTitle = String(val || "");
      else (patch as any)[row.key] = val;
    }
    if (!nextTitle && Object.keys(patch).length === 0) {
      toast.info("Pick at least one field to import.");
      return;
    }
    onApply({ title: nextTitle, metadataPatch: patch });
    toast.success("Imported. Saved as Draft — review and submit when ready.");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-background shadow-2xl flex flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Smart Metadata Import</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 border-b border-border/60 flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[200px] block">
            <span className="text-xs text-muted-foreground">Title</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); runSearch(); }
              }}
              placeholder="e.g. Dune, The Kashmir Files"
              className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="w-24 block">
            <span className="text-xs text-muted-foreground">Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!results && !preview && (
            <p className="p-6 text-sm text-muted-foreground">
              Search for your title to import verified metadata. You'll review each field before anything is applied.
            </p>
          )}

          {results && !preview && (
            <ul className="divide-y divide-border/50">
              {results.length === 0 && (
                <li className="p-6 text-sm text-muted-foreground">
                  No matches. Try a different spelling or add the release year.
                </li>
              )}
              {results.map((r) => (
                <li key={`${r.provider}:${r.kind}:${r.id}`} className="p-3 flex gap-3 items-start hover:bg-secondary/30">
                  <div className="w-14 h-20 bg-secondary/50 rounded overflow-hidden flex-shrink-0">
                    {r.poster_url ? <img src={r.poster_url} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {r.title}
                      {r.year ? <span className="text-muted-foreground font-normal"> · {r.year}</span> : null}
                      <span className="ml-2 text-[10px] uppercase tracking-wide rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                        {r.kind === "tv" ? "TV" : "Film"}
                      </span>
                    </div>
                    {r.original_title && r.original_title !== r.title && (
                      <div className="text-xs text-muted-foreground truncate">{r.original_title}</div>
                    )}
                    {r.overview && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.overview}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={selecting !== null}
                    onClick={() => pick(r)}
                    className="text-xs rounded-md border border-border px-2.5 py-1 hover:bg-secondary/60 disabled:opacity-50"
                  >
                    {selecting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Use this"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {preview && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Pick the fields to import. Fields you've already filled are unchecked — tick to overwrite.
                Rights, licensing, commercial and legal fields are never touched.
              </p>
              <div className="rounded-lg border border-border/60 divide-y divide-border/50">
                {rows.map((row) => (
                  <label key={String(row.key)} className="flex gap-3 items-start p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selection[row.key]}
                      disabled={!row.hasIncoming}
                      onChange={(e) => setSelection((s) => ({ ...s, [row.key]: e.target.checked }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{row.label}</div>
                      <div className="mt-1 grid sm:grid-cols-2 gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</div>
                          <div className="truncate">{row.currentDisplay || <span className="text-muted-foreground">Empty</span>}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">From provider</div>
                          <div className="truncate">
                            {row.hasIncoming
                              ? row.incomingDisplay
                              : <span className="text-muted-foreground">Not available. Please enter manually.</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {preview.poster_url && (
                <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <img src={preview.poster_url} alt="" className="w-14 h-20 rounded object-cover" />
                  <div className="text-xs text-muted-foreground">
                    A reference poster is available from the provider. Upload your own licensed poster on the Files tab — we don't re-host third-party artwork on your title.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 px-4 py-3 flex justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Nothing is submitted — imported data is saved to your Draft.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-md border border-border px-3 py-1.5 hover:bg-secondary/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyImport}
              disabled={!preview}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Import selected
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ---------- Field diff helpers ---------- */

function joinPeople(list: { name: string; role: string }[] | undefined): string {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list.slice(0, 4).map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join(", ") +
    (list.length > 4 ? ` +${list.length - 4} more` : "");
}

function computeRows(meta: TitleMetadata, currentTitle: string, p: MetadataPreview): FieldRow[] {
  const releaseDate = (meta as any).release_date ?? "";
  const originalTitle = (meta as any).original_title ?? "";
  const trailerUrl = (meta as any).trailer_url ?? "";
  const defs: Array<{
    key: keyof MetadataPreview;
    label: string;
    current: unknown;
    incoming: unknown;
    display: (v: unknown) => string;
    hasIncoming: (v: unknown) => boolean;
  }> = [
    { key: "title", label: "Title", current: currentTitle, incoming: p.title,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "original_title", label: "Original title", current: originalTitle, incoming: p.original_title,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "synopsis", label: "Synopsis", current: meta.synopsis, incoming: p.synopsis,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "genres", label: "Genres", current: meta.genres, incoming: p.genres,
      display: (v) => Array.isArray(v) ? v.join(", ") : "", hasIncoming: (v) => Array.isArray(v) && v.length > 0 },
    { key: "runtime_minutes", label: "Runtime (minutes)", current: meta.runtime_minutes, incoming: p.runtime_minutes,
      display: (v) => v ? `${v} min` : "", hasIncoming: (v) => Number(v) > 0 },
    { key: "original_language", label: "Original language", current: meta.original_language, incoming: p.original_language,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "country_of_origin", label: "Country of origin", current: meta.country_of_origin, incoming: p.country_of_origin,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "production_year", label: "Production year", current: meta.production_year, incoming: p.production_year,
      display: (v) => v ? String(v) : "", hasIncoming: (v) => !!v },
    { key: "release_date", label: "Release date", current: releaseDate, incoming: p.release_date,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "production_company", label: "Production company", current: meta.production_company, incoming: p.production_company,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "cast", label: "Cast", current: meta.cast, incoming: p.cast,
      display: (v) => joinPeople(v as any), hasIncoming: (v) => Array.isArray(v) && v.length > 0 },
    { key: "crew", label: "Crew (Directors, Producers, Writers)", current: meta.crew, incoming: p.crew,
      display: (v) => joinPeople(v as any), hasIncoming: (v) => Array.isArray(v) && v.length > 0 },
    { key: "imdb_id", label: "IMDb ID", current: meta.imdb_id, incoming: p.imdb_id,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "tmdb_id", label: "TMDb ID", current: meta.tmdb_id, incoming: p.tmdb_id,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
    { key: "trailer_url", label: "Trailer URL", current: trailerUrl, incoming: p.trailer_url,
      display: (v) => String(v ?? ""), hasIncoming: (v) => !!String(v ?? "").trim() },
  ];

  const isEmpty = (v: unknown) => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    if (typeof v === "number") return v === 0;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  };

  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    currentDisplay: d.display(d.current),
    incomingDisplay: d.display(d.incoming),
    hasIncoming: d.hasIncoming(d.incoming),
    currentEmpty: isEmpty(d.current),
  }));
}
