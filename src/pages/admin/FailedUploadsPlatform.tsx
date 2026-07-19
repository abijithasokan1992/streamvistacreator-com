import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Search, X } from "lucide-react";
import RoleGate from "@/components/RoleGate";
import { supabase } from "@/integrations/supabase/client";

/**
 * Platform-wide Failed Uploads page.
 *
 * Renders the same result set as the `ctrl_list_failed_uploads` MCP tool:
 * failed `ingest_job_items` joined to their parent `ingest_jobs` so admins
 * see the owning workspace_id and project_id across every studio, not just
 * the caller's own uploads.
 *
 * Read-only. Gated to founder / platform_owner / super_admin — mirrors the
 * `authorize(...)` check in the tool. RLS at the DB is the real boundary.
 */

type Row = {
  id: string;
  job_id: string;
  file_name: string;
  size_bytes: number | null;
  status: string;
  error_message: string | null;
  updated_at: string;
  workspace_id: string | null;
  project_id: string | null;
};

function humanBytes(n: number | null): string {
  if (!n || !Number.isFinite(n) || n <= 0) return "—";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Page() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobIdInput, setJobIdInput] = useState("");
  const [jobIdFilter, setJobIdFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = (supabase as any)
        .from("ingest_job_items")
        .select(
          "id, job_id, file_name, size_bytes, status, error_message, updated_at, ingest_jobs!inner(workspace_id, project_id)",
        )
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(Math.max(1, Math.min(limit, 200)));
      if (jobIdFilter) q = q.eq("job_id", jobIdFilter);
      const { data, error } = await q;
      if (error) throw error;
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        job_id: r.job_id,
        file_name: r.file_name,
        size_bytes: r.size_bytes,
        status: r.status,
        error_message: r.error_message,
        updated_at: r.updated_at,
        workspace_id: r.ingest_jobs?.workspace_id ?? null,
        project_id: r.ingest_jobs?.project_id ?? null,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [jobIdFilter, limit]);

  useEffect(() => { load(); }, [load]);

  const applyJobFilter = () => {
    const v = jobIdInput.trim();
    if (!v) { setJobIdFilter(null); return; }
    if (!UUID_RE.test(v)) { setError("Job ID must be a UUID."); return; }
    setError(null);
    setJobIdFilter(v);
  };
  const clearJobFilter = () => { setJobIdInput(""); setJobIdFilter(null); setError(null); };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Failed Uploads · Platform-wide
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every failed <code className="font-mono text-xs">ingest_job_items</code> row across all workspaces,
            joined to its parent job for workspace and project context. Mirrors the
            <code className="font-mono text-xs"> ctrl_list_failed_uploads</code> MCP tool.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/50 hover:bg-secondary/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <section className="glass rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Filter by ingest job ID
          </label>
          <div className="flex gap-2">
            <input
              value={jobIdInput}
              onChange={(e) => setJobIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyJobFilter()}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="flex-1 bg-background border border-border/60 rounded-md px-3 py-1.5 text-sm font-mono"
            />
            <button
              onClick={applyJobFilter}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90"
            >
              <Search className="w-3.5 h-3.5" /> Apply
            </button>
            {jobIdFilter && (
              <button
                onClick={clearJobFilter}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-xs hover:bg-secondary/40"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm"
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">{error}</div>
      )}

      <div className="text-xs text-muted-foreground">
        {loading ? "Loading…" : `${rows?.length ?? 0} failed item${(rows?.length ?? 0) === 1 ? "" : "s"}`}
        {jobIdFilter && <> · filtered to job <span className="font-mono">{jobIdFilter.slice(0, 8)}…</span></>}
      </div>

      {loading && rows === null ? (
        <div className="rounded-lg border border-border/40 p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading failed uploads…
        </div>
      ) : (rows?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-300">
          No failed uploads match this filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows!.map((r) => (
            <li key={r.id} className="rounded-lg border border-border/40 bg-card/50 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-red-500/15 text-red-300 border-red-500/30">
                  {r.status}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(r.updated_at)}</span>
              </div>
              <div className="text-sm font-medium truncate">{r.file_name}</div>
              <div className="text-[11px] text-muted-foreground grid sm:grid-cols-2 gap-x-4 gap-y-1">
                <span>Size: <span className="font-mono">{humanBytes(r.size_bytes)}</span></span>
                <span>Item: <span className="font-mono">{r.id.slice(0, 8)}…</span></span>
                <span>Job: <span className="font-mono">{r.job_id.slice(0, 8)}…</span></span>
                <span>Workspace: <span className="font-mono">{r.workspace_id ? `${r.workspace_id.slice(0, 8)}…` : "—"}</span></span>
                <span className="sm:col-span-2">Project: <span className="font-mono">{r.project_id ? `${r.project_id.slice(0, 8)}…` : "—"}</span></span>
              </div>
              {r.error_message && (
                <div className="text-xs bg-secondary/20 border border-border/30 rounded p-2 leading-relaxed whitespace-pre-wrap break-all font-mono">
                  {r.error_message}
                </div>
              )}
              {!jobIdFilter && (
                <button
                  onClick={() => { setJobIdInput(r.job_id); setJobIdFilter(r.job_id); }}
                  className="text-[11px] text-accent hover:underline"
                >
                  Filter to this job →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function FailedUploadsPlatformPage() {
  return (
    <RoleGate allow={["super_admin", "admin"]}>
      <Page />
    </RoleGate>
  );
}
