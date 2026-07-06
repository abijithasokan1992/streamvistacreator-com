/**
 * LiveIngestStrip
 * ===============
 * Beginner-friendly status widget for Storage + Upload activity. Renders
 * one of five states depending on what's actually happening in the
 * workspace:
 *
 *   Loading         → skeleton placeholders while the first snapshot loads
 *   Ready           → Cloud Status: Online, storage + queue metrics
 *   Uploading       → live current-file name, speed, and time remaining
 *   Attention       → clear warning (paused / interrupted / storage low)
 *                     with a recommended action
 *   Offline         → Cloud unreachable — actions temporarily disabled
 *
 * Design principle: plain language, no bucket names, no PAR URLs, no OCI
 * jargon. Any advanced diagnostics stay in Advanced Settings.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cloud, Gauge, Activity, HardDrive, Layers, Clock,
  Image as ImageIcon, CheckCircle2, AlertTriangle, WifiOff, Upload,
} from "lucide-react";
import { formatBytes } from "@/lib/ingest/deviceScanner";

type Snapshot = {
  storageUsedBytes: number;
  storagePercent: number | null; // % used vs. entitlement, when known
  activeUploads: number;
  queueDepth: number;
  currentSpeedBps: number;
  lastUploadAt: string | null;
  proxyPending: number;
  // Live in-flight job details, when one is running.
  currentJob: {
    id: string;
    currentFile: string | null;
    transferred: number;
    total: number;
  } | null;
  // Jobs that need the user's attention.
  attention: {
    paused: number;
    errored: number;
  };
};

const EMPTY: Snapshot = {
  storageUsedBytes: 0,
  storagePercent: null,
  activeUploads: 0,
  queueDepth: 0,
  currentSpeedBps: 0,
  lastUploadAt: null,
  proxyPending: 0,
  currentJob: null,
  attention: { paused: 0, errored: 0 },
};

type WidgetState = "loading" | "ready" | "uploading" | "attention" | "offline";

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function formatEta(bytesLeft: number, bps: number): string {
  if (!bps || bytesLeft <= 0) return "—";
  const secs = Math.round(bytesLeft / bps);
  if (secs < 60) return `${secs}s left`;
  if (secs < 3600) return `${Math.round(secs / 60)}m left`;
  return `${Math.round(secs / 3600)}h left`;
}

export function LiveIngestStrip() {
  const { activeId } = useWorkspaces();
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [state, setState] = useState<WidgetState>("loading");
  // Track browser-level connectivity so we can flip to Offline instantly
  // without waiting for the next poll to fail.
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  // Last transferred_bytes reading for the running job — used to compute
  // a smooth "speed" without exposing anything from the backend pipeline.
  const lastRef = useRef<{ id: string; bytes: number; at: number } | null>(null);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const [usage, entitlement, active, queued, proxy, lastItem, running, paused, errored, currentItem] = await Promise.all([
          supabase.from("workspace_storage_usage")
            .select("display_used_bytes, active_bytes")
            .eq("workspace_id", activeId)
            .maybeSingle(),
          supabase.from("workspace_storage_entitlements")
            .select("total_storage_gb")
            .eq("workspace_id", activeId)
            .maybeSingle(),
          supabase.from("ingest_jobs")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", activeId)
            .in("status", ["running", "uploading"]),
          supabase.from("ingest_job_items")
            .select("id", { count: "exact", head: true })
            .eq("status", "queued"),
          supabase.from("ingest_job_items")
            .select("id", { count: "exact", head: true })
            .eq("proxy_status", "pending"),
          supabase.from("ingest_job_items")
            .select("updated_at")
            .eq("status", "completed")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("ingest_jobs")
            .select("id, transferred_bytes, total_bytes")
            .eq("workspace_id", activeId)
            .in("status", ["uploading", "running"])
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("ingest_jobs")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", activeId)
            .eq("status", "paused"),
          supabase.from("ingest_jobs")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", activeId)
            .eq("status", "failed"),
          // Current filename comes from the item currently uploading — we
          // display the friendly relative path or file name, never any
          // bucket URL or PAR link.
          supabase.from("ingest_job_items")
            .select("relative_path, file_name, updated_at")
            .eq("status", "uploading")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const usedBytes = (usage.data as { display_used_bytes?: number } | null)?.display_used_bytes ?? 0;
        const totalGb = (entitlement.data as { total_storage_gb?: number } | null)?.total_storage_gb ?? null;
        const totalBytes = totalGb != null ? Math.round(Number(totalGb) * 1024 * 1024 * 1024) : null;
        const percent = totalBytes && totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : null;

        const runningRow = running.data as { id: string; transferred_bytes?: number; total_bytes?: number } | null;
        let currentSpeedBps = 0;
        let currentJob: Snapshot["currentJob"] = null;
        if (runningRow) {
          const now = Date.now();
          const transferred = runningRow.transferred_bytes ?? 0;
          const prev = lastRef.current;
          if (prev && prev.id === runningRow.id && now > prev.at) {
            const dt = (now - prev.at) / 1000;
            const db = Math.max(0, transferred - prev.bytes);
            if (dt > 0) currentSpeedBps = db / dt;
          }
          lastRef.current = { id: runningRow.id, bytes: transferred, at: now };
          currentJob = {
            id: runningRow.id,
            currentFile: (() => {
              const row = currentItem.data as { relative_path?: string; file_name?: string } | null;
              return row?.relative_path || row?.file_name || null;
            })(),
            transferred,
            total: runningRow.total_bytes ?? 0,
          };
        } else {
          lastRef.current = null;
        }

        const nextSnap: Snapshot = {
          storageUsedBytes: usedBytes,
          storagePercent: percent,
          activeUploads: active.count ?? 0,
          queueDepth: queued.count ?? 0,
          currentSpeedBps,
          lastUploadAt: (lastItem.data as { updated_at?: string } | null)?.updated_at ?? null,
          proxyPending: proxy.count ?? 0,
          currentJob,
          attention: {
            paused: paused.count ?? 0,
            errored: errored.count ?? 0,
          },
        };

        setSnap(nextSnap);

        // Derive widget state from the snapshot + connectivity.
        if (!browserOnline) {
          setState("offline");
        } else if (currentJob) {
          setState("uploading");
        } else if (
          nextSnap.attention.errored > 0 ||
          nextSnap.attention.paused > 0 ||
          (percent !== null && percent >= 90)
        ) {
          setState("attention");
        } else {
          setState("ready");
        }
      } catch {
        if (cancelled) return;
        // A silent read failure while the browser thinks we're online is
        // the strongest signal we have that the backend can't be reached.
        setState((prev) => (prev === "loading" ? "offline" : prev === "uploading" ? "attention" : "offline"));
      }
    };

    refresh();
    // Poll faster while an upload is active so speed / ETA feel live.
    const tick = () => refresh();
    const fastMs = 4_000;
    const slowMs = 15_000;
    let interval = window.setInterval(tick, slowMs);
    const rebalance = () => {
      window.clearInterval(interval);
      interval = window.setInterval(tick, snap.currentJob ? fastMs : slowMs);
    };
    rebalance();
    return () => { cancelled = true; window.clearInterval(interval); };
    // Intentionally re-run only on workspace change; connectivity is
    // handled by browserOnline via state derivation on the next refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, browserOnline]);

  // ---- Render ----
  if (state === "loading") {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            <Activity className="w-3.5 h-3.5" /> Live ingest
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border/40 bg-background/60 p-2.5 space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const isOffline = state === "offline";
  const isAttention = state === "attention";
  const isUploading = state === "uploading";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          <Activity className="w-3.5 h-3.5" /> Live ingest
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          {isOffline ? (
            <>
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Cloud Status: Offline</span>
            </>
          ) : isAttention ? (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-amber-500">Cloud Status: Attention needed</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">Cloud Status: Online</span>
            </>
          )}
        </div>
      </div>

      {/* Offline banner — actions elsewhere on the page are expected to
          disable while this state is active. */}
      {isOffline && (
        <div className="mb-3 rounded-md border border-border/50 bg-muted/40 p-3 text-xs">
          <div className="font-medium">We can't reach the cloud right now.</div>
          <div className="text-muted-foreground mt-0.5">
            Uploads are paused until the connection is back. Files you've already imported are still available.
          </div>
        </div>
      )}

      {/* Attention banner — one plain-language line + recommended action. */}
      {isAttention && (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <div className="font-medium text-amber-600 dark:text-amber-400">
            {snap.attention.errored > 0
              ? "An upload didn't finish."
              : snap.attention.paused > 0
              ? "You have a paused upload."
              : "Your storage is almost full."}
          </div>
          <div className="text-muted-foreground mt-0.5">
            {snap.attention.errored > 0
              ? "Open the ingest queue below and press Retry to try again."
              : snap.attention.paused > 0
              ? "Reconnect the device to resume where you left off."
              : "Consider archiving finished productions or upgrading your storage plan."}
          </div>
        </div>
      )}

      {/* Uploading detail row — friendly filename, live speed, ETA. */}
      {isUploading && snap.currentJob && (
        <div className="mb-3 rounded-md border border-accent/40 bg-accent/5 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent">
            <Upload className="w-3 h-3" /> Uploading now
          </div>
          <div className="mt-1 text-sm font-medium truncate" title={snap.currentJob.currentFile ?? undefined}>
            {snap.currentJob.currentFile ?? "Preparing next file…"}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span>
              {formatBytes(snap.currentJob.transferred)}{snap.currentJob.total ? ` / ${formatBytes(snap.currentJob.total)}` : ""}
            </span>
            <span>·</span>
            <span>{snap.currentSpeedBps ? `${formatBytes(snap.currentSpeedBps)}/s` : "measuring…"}</span>
            <span>·</span>
            <span>
              {snap.currentJob.total
                ? formatEta(Math.max(0, snap.currentJob.total - snap.currentJob.transferred), snap.currentSpeedBps)
                : "—"}
            </span>
          </div>
          {snap.currentJob.total > 0 && (
            <div className="mt-2 h-1 rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.round((snap.currentJob.transferred / snap.currentJob.total) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 ${isOffline ? "opacity-60" : ""}`}>
        <Tile
          icon={<HardDrive className="w-3 h-3" />}
          label="Storage"
          value={
            snap.storagePercent !== null
              ? `${formatBytes(snap.storageUsedBytes)} · ${snap.storagePercent}%`
              : formatBytes(snap.storageUsedBytes)
          }
          tone={snap.storagePercent !== null && snap.storagePercent >= 90 ? "warn" : undefined}
        />
        <Tile icon={<Activity className="w-3 h-3" />} label="Current Uploads" value={String(snap.activeUploads)} />
        <Tile icon={<Layers className="w-3 h-3" />} label="Queue" value={String(snap.queueDepth)} />
        <Tile icon={<Gauge className="w-3 h-3" />} label="Speed" value={snap.currentSpeedBps ? `${formatBytes(snap.currentSpeedBps)}/s` : "—"} />
        <Tile icon={<Clock className="w-3 h-3" />} label="Last upload" value={relTime(snap.lastUploadAt)} />
        <Tile icon={<ImageIcon className="w-3 h-3" />} label="Review Files" value={snap.proxyPending ? `${snap.proxyPending} queued` : "Ready"} />
        <Tile
          icon={<Cloud className="w-3 h-3" />}
          label="Connection"
          value={isOffline ? "Offline" : "Online"}
          tone={isOffline ? "warn" : undefined}
        />
      </div>
    </Card>
  );
}

function Tile({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-md border p-2.5 ${
      tone === "warn"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border/40 bg-background/60"
    }`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums truncate ${
        tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""
      }`}>{value}</div>
    </div>
  );
}
