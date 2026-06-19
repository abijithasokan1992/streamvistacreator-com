import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Trash2, RefreshCw, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StuckRow = {
  id: string;
  file_name: string;
  file_size: number;
  object_key: string;
  oci_upload_id: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}
function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function UploadDiagnostics() {
  const [rows, setRows] = useState<StuckRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("oci-multipart-reclaim", {
        body: { action: "scan_mine" },
      });
      if (error) throw error;
      setRows(((data as any)?.rows ?? []) as StuckRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load uploads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);

  const cancel = useCallback(async (id: string) => {
    setCancelling(id);
    try {
      const { data, error } = await supabase.functions.invoke("oci-multipart-reclaim", {
        body: { action: "cancel", uploadRowId: id },
      });
      if (error) throw error;
      const verdict = (data as any)?.report?.verdict;
      toast.success(verdict === "aborted" ? "Upload cancelled and storage cleaned up." : "Upload marked failed.");
      await scan();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel upload");
    } finally {
      setCancelling(null);
    }
  }, [scan]);

  if (rows === null && loading) {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your in-flight uploads…
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Upload Health
          </span>
          <button
            type="button" onClick={scan} disabled={loading}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <p className="text-muted-foreground">No in-flight or stuck uploads. You're clear to start a new upload.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          {rows.length} in-flight upload{rows.length === 1 ? "" : "s"}
        </span>
        <button
          type="button" onClick={scan} disabled={loading}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <p className="text-muted-foreground">
        These uploads were started but never completed. Drop the same file back into the uploader to resume,
        or cancel to free the slot and clean up Oracle storage.
      </p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const idleMin = Math.floor((Date.now() - Date.parse(r.last_activity_at)) / 60000);
          const stale = idleMin >= 30;
          return (
            <li key={r.id} className="rounded-md border border-border/40 bg-card/50 p-3 grid grid-cols-[1fr_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.file_name}</div>
                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                  <span>{humanBytes(r.file_size)}</span>
                  <span>Started {timeAgo(r.created_at)}</span>
                  <span className={stale ? "text-amber-300" : "text-emerald-400"}>
                    Last activity {timeAgo(r.last_activity_at)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => cancel(r.id)}
                disabled={cancelling === r.id}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 disabled:opacity-50"
              >
                {cancelling === r.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Cancel
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
