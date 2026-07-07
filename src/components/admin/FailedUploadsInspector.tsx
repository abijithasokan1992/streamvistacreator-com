import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Loader2, ShieldAlert, Clock, KeyRound, WifiOff, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UPLOAD_CATEGORY_LABELS, type UploadErrorCategory } from "@/lib/uploads/classifyUploadError";

/**
 * Admin Failed-Uploads Inspector.
 *
 * Reads `ingest_job_items` rows where `status = 'failed'` (or stale in-flight)
 * and surfaces the structural diagnostic that the client persisted onto
 * `metadata.upload_diagnostic`. This is the authoritative admin view for the
 * "Failed Uploads" tile.
 */

type Row = {
  id: string;
  job_id: string;
  file_name: string;
  size_bytes: number;
  status: string;
  error_message: string | null;
  updated_at: string;
  metadata: Record<string, any> | null;
};

const CATEGORY_ICON: Record<UploadErrorCategory, JSX.Element> = {
  csp_violation: <ShieldAlert className="w-3.5 h-3.5" />,
  signed_url_expired: <Clock className="w-3.5 h-3.5" />,
  auth_token: <KeyRound className="w-3.5 h-3.5" />,
  network_timeout: <WifiOff className="w-3.5 h-3.5" />,
  other: <FileWarning className="w-3.5 h-3.5" />,
};

const CATEGORY_TONE: Record<UploadErrorCategory, string> = {
  csp_violation: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  signed_url_expired: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  auth_token: "bg-red-500/15 text-red-300 border-red-500/30",
  network_timeout: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  other: "bg-secondary/40 text-muted-foreground border-border/40",
};

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const GB = 1024 ** 3, MB = 1024 ** 2;
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}
function timeAgo(iso: string): string {
  const d = Date.now() - Date.parse(iso);
  if (Number.isNaN(d)) return "—";
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FailedUploadsInspector() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | UploadErrorCategory>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("ingest_job_items")
        .select("id, job_id, file_name, size_bytes, status, error_message, updated_at, metadata")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => {
    return (rows ?? []).map((r) => {
      const diag = r.metadata?.upload_diagnostic;
      const category: UploadErrorCategory = (diag?.category as UploadErrorCategory) ?? "other";
      return {
        row: r,
        category,
        code: (diag?.code as string) ?? "UNCLASSIFIED",
        detail: (diag?.detail as string) ?? r.error_message ?? "No structural diagnostic recorded.",
        httpStatus: (diag?.http_status as number | null) ?? null,
        stage: (diag?.stage as string) ?? null,
        surface: (diag?.surface as string) ?? null,
        classifiedAt: (diag?.classified_at as string) ?? null,
      };
    });
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<UploadErrorCategory | "all", number> = {
      all: enriched.length, csp_violation: 0, signed_url_expired: 0, auth_token: 0, network_timeout: 0, other: 0,
    };
    for (const e of enriched) c[e.category] += 1;
    return c;
  }, [enriched]);

  const visible = filter === "all" ? enriched : enriched.filter((e) => e.category === filter);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Failed Uploads · Structural Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every failure classified into one of five structural causes and persisted to the asset record.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/50 hover:bg-secondary/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Hard refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All · ${counts.all}`} tone="bg-secondary/40 text-foreground border-border/40" />
        {(Object.keys(UPLOAD_CATEGORY_LABELS) as UploadErrorCategory[]).map((k) => (
          <FilterChip
            key={k}
            active={filter === k}
            onClick={() => setFilter(k)}
            label={`${UPLOAD_CATEGORY_LABELS[k]} · ${counts[k]}`}
            tone={CATEGORY_TONE[k]}
            icon={CATEGORY_ICON[k]}
          />
        ))}
      </div>

      {loading && rows === null ? (
        <div className="rounded-lg border border-border/40 p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading failed uploads…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-300">
          No failed uploads in this category.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((e) => (
            <li key={e.row.id} className="rounded-lg border border-border/40 bg-card/50 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${CATEGORY_TONE[e.category]}`}>
                  {CATEGORY_ICON[e.category]}
                  {UPLOAD_CATEGORY_LABELS[e.category]}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{e.code}</span>
                {e.httpStatus != null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground">HTTP {e.httpStatus}</span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(e.row.updated_at)}</span>
              </div>
              <div className="text-sm font-medium truncate">{e.row.file_name}</div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                <span>{humanBytes(e.row.size_bytes)}</span>
                {e.surface && <span>Surface: <span className="font-mono">{e.surface}</span></span>}
                {e.stage && <span>Stage: <span className="font-mono">{e.stage}</span></span>}
                <span className="font-mono">job {e.row.job_id.slice(0, 8)}…</span>
              </div>
              <div className="text-xs bg-secondary/20 border border-border/30 rounded p-2 leading-relaxed">
                {e.detail}
              </div>
              {e.row.error_message && e.row.error_message !== `[${e.code}] ${e.detail}` && (
                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Raw error message</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px] bg-black/30 rounded p-2">{e.row.error_message}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, tone, icon }: {
  active: boolean; onClick: () => void; label: string; tone: string; icon?: JSX.Element;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition ${tone} ${active ? "ring-2 ring-offset-1 ring-offset-background ring-accent/60" : "opacity-70 hover:opacity-100"}`}
    >
      {icon}
      {label}
    </button>
  );
}
