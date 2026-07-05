/**
 * AutoIngestPanel
 * ================
 * A three-state, one-button ingest surface that lives on top of the existing
 * StudioIngest tabs. The goal is to let the user do only three things:
 *
 *   1. Connect a card / SSD / HDD (browser picker).
 *   2. Confirm the auto-detected production (or pick a different one).
 *   3. Start Import.
 *
 * Everything after that — checksums, dedupe, resume, proxy queue, thumbnails,
 * metadata extraction, retries — runs against the existing ingest_jobs /
 * ingest_job_items / upload_sessions tables and the existing OCI multipart
 * driver. No shell redesign, no replacement of the existing manual dialogs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, HardDrive, Loader2, CheckCircle2, AlertTriangle, PlayCircle,
  FolderInput, Camera, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  scanDirectoryHandle, scanFileList, supportsDirectoryPicker,
  formatBytes, type ScanResult,
} from "@/lib/ingest/deviceScanner";
import {
  uploadFileMultipart, MULTIPART_THRESHOLD, ResumableUploadInterrupted,
  mapUploadError,
} from "@/lib/ociMultipartUpload";
import { classifyFile, enrichFile } from "@/lib/ingest/mediaIntelligence";

type Project = { id: string; name: string };

type Phase = "idle" | "detected" | "importing" | "done" | "error" | "paused";

type LiveState = {
  phase: Phase;
  currentFile: string;
  transferred: number;
  total: number;
  speedBps: number;
  completed: number;
  failed: number;
  totalFiles: number;
  jobId?: string;
  message?: string;
};

const INITIAL_LIVE: LiveState = {
  phase: "idle",
  currentFile: "",
  transferred: 0,
  total: 0,
  speedBps: 0,
  completed: 0,
  failed: 0,
  totalFiles: 0,
};

function etaLabel(bytesLeft: number, speedBps: number): string {
  if (!speedBps || speedBps <= 0) return "—";
  const s = Math.round(bytesLeft / speedBps);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export function AutoIngestPanel() {
  const { user } = useAuth();
  const { activeId: activeWorkspaceId } = useWorkspaces();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load productions to auto-select the newest active one.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("productions")
        .select("id, title, status, created_at")
        .eq("workspace_id", activeWorkspaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data ?? []) as Array<{ id: string; title: string; status: string | null }>;
      const mapped: Project[] = rows.map((r) => ({ id: r.id, name: r.title }));
      setProjects(mapped);
      const active = rows.find((r) => (r.status ?? "").toLowerCase() === "active");
      setProjectId((active ?? rows[0])?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  const connectDevice = useCallback(async () => {
    try {
      if (supportsDirectoryPicker()) {
        const win = window as unknown as { showDirectoryPicker: (o?: { mode?: string }) => Promise<FileSystemDirectoryHandle> };
        const handle = await win.showDirectoryPicker({ mode: "read" });
        const result = await scanDirectoryHandle(handle);
        if (result.files.length === 0) {
          toast.error("No supported media files found on this device.");
          return;
        }
        setScan(result);
        setLive({ ...INITIAL_LIVE, phase: "detected", totalFiles: result.files.length, total: result.totalBytes });
      } else {
        fileInputRef.current?.click();
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error(`Could not read device: ${(e as Error).message}`);
    }
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const result = scanFileList(files);
    if (result.files.length === 0) {
      toast.error("No supported media files found.");
      return;
    }
    setScan(result);
    setLive({ ...INITIAL_LIVE, phase: "detected", totalFiles: result.files.length, total: result.totalBytes });
    // Reset the input so re-picking the same folder still fires change.
    e.target.value = "";
  }, []);

  const reset = useCallback(() => {
    setScan(null);
    setLive(INITIAL_LIVE);
  }, []);

  const startImport = useCallback(async () => {
    if (!scan || !user || !activeWorkspaceId) return;
    if (!projectId) {
      toast.error("Select a production first.");
      return;
    }
    setBusy(true);
    try {
      // 1. Source row.
      const { data: src, error: srcErr } = await supabase
        .from("ingest_sources")
        .insert({
          workspace_id: activeWorkspaceId,
          created_by: user.id,
          source_type: "camera_card",
          label: scan.rootLabel,
          path_hint: scan.rootLabel,
          metadata: {
            file_count: scan.files.length,
            total_bytes: scan.totalBytes,
            top_level_folders: scan.topLevelFolders,
            camera_family: scan.cameraFamily,
            media_formats: scan.mediaFormats,
            mode: "auto_ingest",
          },
        })
        .select("id")
        .single();
      if (srcErr || !src) throw srcErr ?? new Error("Failed to create ingest source");

      // 2. Job row.
      const { data: job, error: jobErr } = await supabase
        .from("ingest_jobs")
        .insert({
          workspace_id: activeWorkspaceId,
          created_by: user.id,
          source_id: src.id,
          project_id: projectId,
          job_mode: "camera_card",
          destination_type: "production_media",
          preserve_structure: true,
          camera_label: scan.cameraFamilyLabel,
          status: "ready",
          total_files: scan.files.length,
          total_bytes: scan.totalBytes,
          source_summary: {
            root_label: scan.rootLabel,
            top_level_folders: scan.topLevelFolders,
            camera_family: scan.cameraFamily,
            media_formats: scan.mediaFormats,
            auto_ingest: true,
          },
        })
        .select("id")
        .single();
      if (jobErr || !job) throw jobErr ?? new Error("Failed to create ingest job");

      // 3. Item rows (batched).
      const items = scan.files.map((f) => {
        const c = classifyFile(f.file, f.relativePath);
        return {
          job_id: job.id,
          relative_path: f.relativePath,
          file_name: f.file.name,
          size_bytes: f.file.size,
          mime_guess: f.file.type || null,
          asset_class: c.assetClass,
          status: "queued",
          progress_percent: 0,
          metadata: {
            detected_type: c.detectedType,
            container: c.container,
            codec_hint: c.codecHint,
            device_hint: c.deviceHint,
            confidence: c.confidence,
          },
        };
      });
      const itemIdByPath = new Map<string, string>();
      for (let i = 0; i < items.length; i += 100) {
        const chunk = items.slice(i, i + 100);
        const { data: rows, error: itemErr } = await supabase
          .from("ingest_job_items")
          .insert(chunk)
          .select("id, relative_path");
        if (itemErr) throw itemErr;
        for (const r of (rows ?? []) as Array<{ id: string; relative_path: string }>) {
          itemIdByPath.set(r.relative_path, r.id);
        }
      }

      // 4. Kick job to running.
      await supabase.from("ingest_jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
      }).eq("id", job.id);

      // 5. Upload loop.
      setLive({
        phase: "importing", currentFile: "", transferred: 0,
        total: scan.totalBytes, speedBps: 0, completed: 0, failed: 0,
        totalFiles: scan.files.length, jobId: job.id,
      });

      let transferredBaseline = 0;
      let completed = 0;
      let failed = 0;
      const tStart = performance.now();

      for (const f of scan.files) {
        const itemId = itemIdByPath.get(f.relativePath);
        const pendingId = `auto-${job.id}-${itemId ?? f.file.name}`
          .replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 120);

        setLive((p) => ({ ...p, currentFile: f.relativePath }));
        if (itemId) await supabase.from("ingest_job_items")
          .update({ status: "uploading" }).eq("id", itemId);

        try {
          if (f.file.size > MULTIPART_THRESHOLD) {
            await uploadFileMultipart({
              file: f.file,
              workspaceId: activeWorkspaceId,
              projectId,
              pendingId,
              subpath: f.subpath || null,
              onProgress: (loaded) => {
                const elapsed = (performance.now() - tStart) / 1000;
                const totalNow = transferredBaseline + loaded;
                const speed = elapsed > 0 ? totalNow / elapsed : 0;
                setLive((p) => ({ ...p, transferred: totalNow, speedBps: speed }));
                if (itemId) {
                  const pct = Math.max(1, Math.min(99, Math.round((loaded / f.file.size) * 100)));
                  void supabase.from("ingest_job_items")
                    .update({ progress_percent: pct }).eq("id", itemId);
                }
              },
            });
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in");
            const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;
            const form = new FormData();
            form.append("file", f.file);
            form.append("workspaceId", activeWorkspaceId);
            form.append("pendingId", pendingId);
            if (f.subpath) form.append("subpath", f.subpath);
            if (projectId) form.append("projectId", projectId);
            const resp = await fetch(url, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: form,
            });
            if (!resp.ok) throw new Error(`oci-upload ${resp.status}`);
          }
          transferredBaseline += f.file.size;
          completed += 1;

          // Fire-and-forget enrichment — never blocks the upload pump.
          if (itemId) {
            void (async () => {
              try {
                const enriched = await enrichFile(f.file, f.relativePath);
                await supabase.from("ingest_job_items").update({
                  status: "completed",
                  progress_percent: 100,
                  technical_metadata: enriched,
                  proxy_status: "queued",
                  thumbnail_status: "queued",
                }).eq("id", itemId);
              } catch {
                await supabase.from("ingest_job_items").update({
                  status: "completed", progress_percent: 100,
                }).eq("id", itemId);
              }
            })();
          }
          await supabase.from("ingest_jobs").update({
            transferred_bytes: transferredBaseline,
            completed_files: completed,
          }).eq("id", job.id);
          setLive((p) => ({ ...p, completed }));
        } catch (e) {
          const msg = mapUploadError(e);
          const paused = e instanceof ResumableUploadInterrupted;
          if (itemId) await supabase.from("ingest_job_items").update({
            status: paused ? "paused" : "failed",
            error_message: msg,
          }).eq("id", itemId);
          if (paused) {
            setLive((p) => ({ ...p, phase: "paused", message: msg }));
            await supabase.from("ingest_jobs").update({
              status: "paused",
              error_message: `Paused at ${f.relativePath}: ${msg}`,
            }).eq("id", job.id);
            toast.message("Ingest paused — reconnect the device to resume.");
            return;
          }
          failed += 1;
          setLive((p) => ({ ...p, failed }));
          await supabase.from("ingest_jobs")
            .update({ failed_files: failed }).eq("id", job.id);
        }
      }

      const finalStatus = failed === 0 ? "completed" : (completed > 0 ? "completed" : "failed");
      await supabase.from("ingest_jobs").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      setLive((p) => ({ ...p, phase: failed === 0 ? "done" : "error" }));
      if (failed === 0) toast.success(`Import complete — ${completed} files uploaded.`);
      else toast.warning(`Import finished with ${failed} failure${failed === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
      setLive((p) => ({ ...p, phase: "error", message: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }, [scan, user, activeWorkspaceId, projectId]);

  const bytesLeft = Math.max(0, live.total - live.transferred);
  const pct = live.total > 0 ? Math.min(100, Math.round((live.transferred / live.total) * 100)) : 0;

  const activeProduction = useMemo(
    () => projects.find((p) => p.id === projectId)?.name ?? "—",
    [projects, projectId],
  );

  return (
    <Card className="p-6 border-accent/30 bg-gradient-to-br from-accent/5 via-background to-background">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is a non-standard attribute for folder picking
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={onFileInput}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-accent">
            <Sparkles className="w-3.5 h-3.5" /> Auto Ingest
          </div>
          <h3 className="text-xl font-semibold mt-1">Connect a device — we handle the rest</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Original camera files are never modified. Checksums, deduplication,
            resume, proxy generation, thumbnails, and metadata all run
            automatically in the background.
          </p>
        </div>
        {live.phase !== "idle" && live.phase !== "importing" && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> New import
          </Button>
        )}
      </div>

      {/* Phase 1 — idle */}
      {live.phase === "idle" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-dashed border-border/60 p-6">
          <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Waiting for a device…</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Insert a camera card, SSD, HDD, or Thunderbolt drive, then click Connect.
              Supports SD, microSD, CFexpress A/B, CFast, XQD, USB SSD, external HDD, and RAID.
            </div>
          </div>
          <Button onClick={connectDevice} className="gap-2">
            <FolderInput className="w-4 h-4" /> Connect device
          </Button>
        </div>
      )}

      {/* Phase 2 — detected */}
      {live.phase === "detected" && scan && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Device" value={scan.rootLabel} icon={<HardDrive className="w-3.5 h-3.5" />} />
            <Stat label="Camera" value={scan.cameraFamilyLabel} icon={<Camera className="w-3.5 h-3.5" />} />
            <Stat label="Clips" value={`${scan.files.length}`} />
            <Stat label="Size" value={formatBytes(scan.totalBytes)} />
          </div>
          {scan.mediaFormats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scan.mediaFormats.map((fmt) => (
                <span key={fmt} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                  {fmt}
                </span>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Production
              </label>
              <Select
                value={projectId ?? undefined}
                onValueChange={(v) => setProjectId(v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={projects.length ? "Select a production" : "No productions yet"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={startImport} disabled={busy || !projectId} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Start Import
            </Button>
          </div>
        </div>
      )}

      {/* Phase 3 — importing / paused / done / error */}
      {(live.phase === "importing" || live.phase === "paused" || live.phase === "done" || live.phase === "error") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              {live.phase === "importing" && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
              {live.phase === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              {(live.phase === "error" || live.phase === "paused") && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              <span className="truncate">
                {live.phase === "importing" && (live.currentFile || "Preparing…")}
                {live.phase === "done" && `Import complete — ${live.completed}/${live.totalFiles} files to “${activeProduction}”`}
                {live.phase === "paused" && (live.message ?? "Paused — reconnect device to resume")}
                {live.phase === "error" && (live.message ?? "One or more files could not be uploaded")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums shrink-0 ml-3">
              {live.completed}/{live.totalFiles} · {formatBytes(live.speedBps)}/s · ETA {etaLabel(bytesLeft, live.speedBps)}
            </div>
          </div>
          <Progress value={pct} />
          <div className="text-[11px] text-muted-foreground">
            {formatBytes(live.transferred)} of {formatBytes(live.total)} · {pct}%
            {live.failed > 0 && <span className="text-destructive"> · {live.failed} failed</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-1 font-medium truncate">{value}</div>
    </div>
  );
}
