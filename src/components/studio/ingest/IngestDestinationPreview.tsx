/**
 * IngestDestinationPreview
 * ========================
 * Read-only preview shown after a source is scanned and before the ingest
 * job is created. Confirms the exact metadata the ingest engine will attach
 * to the job (Production, Shoot Day, Unit, Camera, Card) plus the resolved
 * destination path, file count and total size. When "Preserve source folder
 * structure" is active, we also render the top of the source tree so DITs
 * can see the hierarchy that will land in the vault.
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderTree, FileVideo, HardDrive } from "lucide-react";

type PreviewFile = { relativePath: string; subpath: string; file: { size: number; name: string } };

export function IngestDestinationPreview({
  files,
  totalBytes,
  productionName,
  shootDay,
  unit,
  camera,
  card,
  destinationBase,
  layoutMode,
  buildSubpath,
}: {
  files: PreviewFile[];
  totalBytes: number;
  productionName: string | null;
  shootDay: string | null;
  unit: string | null;
  camera: string | null;
  card: string | null;
  destinationBase: string;
  layoutMode: "preserve" | "metadata" | "custom";
  buildSubpath: (f: PreviewFile) => string;
}) {
  // Build a top-level folder tree (max 40 unique paths) so DITs can eyeball
  // the resolved layout without waiting for upload.
  const treeSample = useMemo(() => {
    const seen = new Map<string, number>();
    for (const f of files) {
      const sub = buildSubpath(f) || "(root)";
      seen.set(sub, (seen.get(sub) ?? 0) + 1);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 40);
  }, [files, buildSubpath]);

  const meta: Array<[string, string | null]> = [
    ["Production", productionName],
    ["Shoot Day", shootDay],
    ["Unit", unit],
    ["Camera", camera],
    ["Camera Card", card],
  ];

  const fmt = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    if (n < 1099511627776) return `${(n / 1073741824).toFixed(2)} GB`;
    return `${(n / 1099511627776).toFixed(2)} TB`;
  };

  return (
    <Card className="p-4 space-y-3 border-accent/20 bg-secondary/5">
      <div className="flex items-center gap-2 text-xs">
        <FolderTree className="w-4 h-4 text-accent" />
        <span className="font-semibold text-foreground">Destination preview</span>
        <Badge variant="outline" className="text-[10px] uppercase">read-only</Badge>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5 text-[11px]">
        {meta.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <div className="text-muted-foreground">{label}</div>
            <div className={`truncate font-medium ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
              {value || "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] pt-2 border-t border-border/40">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <HardDrive className="w-3 h-3" />
          Destination base:
          <code className="font-mono text-foreground/90 text-[10px] bg-background/60 px-1.5 py-0.5 rounded">
            {destinationBase || "/"}
          </code>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <FileVideo className="w-3 h-3" /> {files.length} files
        </span>
        <span className="text-muted-foreground">Est. size: <strong className="text-foreground">{fmt(totalBytes)}</strong></span>
        <span className="text-muted-foreground">Layout: <strong className="text-foreground capitalize">{layoutMode}</strong></span>
      </div>

      {layoutMode === "preserve" && treeSample.length > 0 && (
        <div className="rounded-md border border-border/40 bg-background/40 p-2 max-h-48 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">
            Preserved folder hierarchy
          </div>
          <ul className="text-[11px] font-mono space-y-0.5">
            {treeSample.map(([path, count]) => (
              <li key={path} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground/90">{path || "(root)"}</span>
                <span className="text-muted-foreground shrink-0">{count} {count === 1 ? "file" : "files"}</span>
              </li>
            ))}
            {files.length > treeSample.length && (
              <li className="text-muted-foreground italic">
                …and {files.length - treeSample.length} more files
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
