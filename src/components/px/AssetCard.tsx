import { Film, HardDrive, Shield, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIndicator, type StatusKind } from "./StatusIndicator";

/**
 * StreamVista Asset Card — professional, minimal, information-rich.
 *
 * Communicates in one glance:
 *   Identity · Status · Ownership · Storage · Rights · Quality · Availability · Actions
 *
 * Deliberately NOT a video thumbnail card. This is a production asset.
 */
export interface AssetCardData {
  id: string;
  title: string;
  identifier?: string;   // production number, master ID, etc.
  kind: string;          // "Feature Film" / "Episode" / "Master" / "Deliverable"
  owner?: string;
  storage?: string;      // "1.2 TB · OCI Object Storage"
  rights?: string;       // "Worldwide · 2024–2029"
  quality?: string;      // "4K · HDR10 · ProRes 422"
  status: StatusKind;
  posterUrl?: string | null;
  selected?: boolean;
}

export function AssetCard({
  asset,
  onSelect,
  onOpen,
  onAction,
}: {
  asset: AssetCardData;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  onAction?: (id: string) => void;
}) {
  return (
    <article
      aria-labelledby={`asset-${asset.id}-title`}
      className={cn(
        "group relative flex flex-col rounded-xl border transition-colors",
        "focus-within:border-accent/60",
        asset.selected
          ? "border-accent/60 bg-accent/5"
          : "border-border/50 bg-surface/40 hover:border-border",
      )}
    >
      {/* Header: identity + status */}
      <header className="flex items-start justify-between gap-3 p-3 border-b border-border/40">
        <div className="min-w-0">
          <p className="text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground">
            {asset.kind}
            {asset.identifier && <> · <span className="text-foreground/70">{asset.identifier}</span></>}
          </p>
          <button
            type="button"
            id={`asset-${asset.id}-title`}
            onClick={() => onOpen?.(asset.id)}
            className="mt-1 text-left font-display text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-2 focus:outline-none focus-visible:underline"
          >
            {asset.title}
          </button>
        </div>
        <StatusIndicator kind={asset.status} />
      </header>

      {/* Body: metadata rows */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 p-3 text-[11px]">
        {asset.owner && (
          <>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="text-foreground/90 truncate">{asset.owner}</dd>
          </>
        )}
        {asset.quality && (
          <>
            <dt className="text-muted-foreground inline-flex items-center gap-1"><Film className="w-3 h-3" aria-hidden="true" />Quality</dt>
            <dd className="text-foreground/90 truncate font-mono-tech">{asset.quality}</dd>
          </>
        )}
        {asset.storage && (
          <>
            <dt className="text-muted-foreground inline-flex items-center gap-1"><HardDrive className="w-3 h-3" aria-hidden="true" />Storage</dt>
            <dd className="text-foreground/90 truncate">{asset.storage}</dd>
          </>
        )}
        {asset.rights && (
          <>
            <dt className="text-muted-foreground inline-flex items-center gap-1"><Shield className="w-3 h-3" aria-hidden="true" />Rights</dt>
            <dd className="text-foreground/90 truncate">{asset.rights}</dd>
          </>
        )}
      </dl>

      {/* Footer: quick actions */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 px-3 py-2">
        <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!asset.selected}
            onChange={() => onSelect?.(asset.id)}
            aria-label={`Select ${asset.title}`}
            className="rounded border-border/60 bg-transparent text-accent focus:ring-accent"
          />
          Select
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen?.(asset.id)}
            className="text-[11px] rounded-md border border-border/60 px-2 py-1 text-foreground hover:bg-secondary/40"
            aria-label={`Open ${asset.title}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => onAction?.(asset.id)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            aria-label={`More actions for ${asset.title}`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </article>
  );
}
