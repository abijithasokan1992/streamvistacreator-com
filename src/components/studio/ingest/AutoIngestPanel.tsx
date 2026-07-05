/**
 * AutoIngestPanel
 * ================
 * Three-state, one-button ingest surface with background queue support.
 *
 * Flow:
 *   1. Connect a card / SSD / HDD (native picker, multi-select via Ctrl+A).
 *   2. Confirm the auto-detected production.
 *   3. Start Import — or Minimise the running import into the background
 *      queue and immediately connect the next card.
 *
 * All uploads run against the existing ingest_jobs / ingest_job_items /
 * upload_sessions tables and the existing OCI multipart driver.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, HardDrive, Loader2, CheckCircle2, AlertTriangle, PlayCircle,
  FolderInput, Camera, RefreshCw, Minimize2, X,
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

type Phase = "detected" | "importing" | "done" | "error" | "paused";

type JobEntry = {
  id: string;               // local uid
  scan: ScanResult;
  projectId: string | null;
  projectName: string;
  phase: Phase;
  currentFile: string;
  transferred: number;
  total: number;
  speedBps: number;
  completed: number;
  failed: number;
  totalFiles: number;
  message?: string;
  minimized: boolean;
  startedAt?: number;
};

function newJobEntry(scan: ScanResult, projectId: string | null, projectName: string): JobEntry {
  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scan,
    projectId,
    projectName,
    phase: "detected",
    currentFile: "",
    transferred: 0,
    total: scan.totalBytes,
    speedBps: 0,
    completed: 0,
    failed: 0,
    totalFiles: scan.files.length,
    minimized: false,
  };
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--:--";
  const s = Math.round(seconds);
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function etaSeconds(bytesLeft: number, speedBps: number): number {
  if (!speedBps || speedBps <= 0) return 0;
  return bytesLeft / speedBps;
}

export function AutoIngestPanel() {
  const { user } = useAuth();
  const { activeId: activeWorkspaceId } = useWorkspaces();
  const [projects, setProjects] = useState<Project[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [foregroundId, setForegroundId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jobsRef = useRef<JobEntry[]>([]);
  jobsRef.current = jobs;

  const updateJob = useCallback((id: string, patch: Partial<JobEntry> | ((j: JobEntry) => Partial<JobEntry>)) => {
    setJobs((prev) => prev.map((j) => {
      if (j.id !== id) return j;
      const p = typeof patch === "function" ? patch(j) : patch;
      return { ...j, ...p };
    }));
  }, []);

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
      setDefaultProjectId((active ?? rows[0])?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  const projectNameOf = useCallback((id: string | null) => {
    if (!id) return "—";
    return projects.find((p) => p.id === id)?.name ?? "—";
  }, [projects]);

  const connectDevice = useCallback(async () => {
    try {
      if (supportsDirectoryPicker()) {
        const win = window as unknown as { showDirectoryPicker: (o?: { mode?: string }) => Promise<FileSystemDirectoryHandle> };
        const handle = await win.showDirectoryPicker({ mode: "read" });
        const result = await scanDirectoryHandle(handle);
        if (result.files.length === 0) {
          toast.error("No files found on this device.");
          return;
        }
        const entry = newJobEntry(result, defaultProjectId, projectNameOf(defaultProjectId));
        setJobs((prev) => [...prev, entry]);
        setForegroundId(entry.id);
      } else {
        fileInputRef.current?.click();
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error(`Could not read device: ${(e as Error).message}`);
    }
  }, [defaultProjectId, projectNameOf]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const result = scanFileList(files);
    if (result.files.length === 0) {
      toast.error("No files found.");
      return;
    }
    const entry = newJobEntry(result, defaultProjectId, projectNameOf(defaultProjectId));
    setJobs((prev) => [...prev, entry]);
    setForegroundId(entry.id);
    e.target.value = "";
  }, [defaultProjectId, projectNameOf]);

  const runImport = useCallback(async (entryId: string) => {
    const entry = jobsRef.current.find((j) => j.id === entryId);
    if (!entry || !user || !activeWorkspaceId) return;
    if (!entry.projectId) {
      toast.error("Select a production first.");
      return;
    }
    const scan = entry.scan;
    const projectId = entry.projectId;

    try {
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

      const items = scan.files.map((f) => {
        const c = classifyFile(f.file.name, f.relativePath);
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

      await supabase.from("ingest_jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
      }).eq("id", job.id);

      updateJob(entryId, {
        phase: "importing",
        startedAt: performance.now(),
      });

      let transferredBaseline = 0;
      let completed = 0;
      let failed = 0;
      const tStart = performance.now();

      for (const f of scan.files) {
        const itemId = itemIdByPath.get(f.relativePath);
        const pendingId = `auto-${job.id}-${itemId ?? f.file.name}`
          .replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 120);

        updateJob(entryId, { currentFile: f.relativePath });
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
                updateJob(entryId, { transferred: totalNow, speedBps: speed });
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
          updateJob(entryId, { completed, transferred: transferredBaseline });
        } catch (e) {
          const msg = mapUploadError(e);
          const paused = e instanceof ResumableUploadInterrupted;
          if (itemId) await supabase.from("ingest_job_items").update({
            status: paused ? "paused" : "failed",
            error_message: msg,
          }).eq("id", itemId);
          if (paused) {
            updateJob(entryId, { phase: "paused", message: msg });
            await supabase.from("ingest_jobs").update({
              status: "paused",
              error_message: `Paused at ${f.relativePath}: ${msg}`,
            }).eq("id", job.id);
            toast.message("Ingest paused — reconnect the device to resume.");
            return;
          }
          failed += 1;
          updateJob(entryId, { failed });
          await supabase.from("ingest_jobs")
            .update({ failed_files: failed }).eq("id", job.id);
        }
      }

      const finalStatus = failed === 0 ? "completed" : (completed > 0 ? "completed" : "failed");
      await supabase.from("ingest_jobs").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      updateJob(entryId, { phase: failed === 0 ? "done" : "error" });
      if (failed === 0) toast.success(`Import complete — ${completed} files to “${entry.projectName}”.`);
      else toast.warning(`Import finished with ${failed} failure${failed === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
      updateJob(entryId, { phase: "error", message: (e as Error).message });
    }
  }, [user, activeWorkspaceId, updateJob]);

  const startForegroundImport = useCallback(async () => {
    if (!foregroundId) return;
    setStarting(true);
    try {
      // Fire and forget — the loop continues even if user minimises.
      void runImport(foregroundId);
    } finally {
      setStarting(false);
    }
  }, [foregroundId, runImport]);

  const minimizeForeground = useCallback(() => {
    if (!foregroundId) return;
    updateJob(foregroundId, { minimized: true });
    setForegroundId(null);
  }, [foregroundId, updateJob]);

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (foregroundId === id) setForegroundId(null);
  }, [foregroundId]);

  const restoreJob = useCallback((id: string) => {
    updateJob(id, { minimized: false });
    setForegroundId(id);
  }, [updateJob]);

  const foreground = useMemo(
    () => jobs.find((j) => j.id === foregroundId) ?? null,
    [jobs, foregroundId],
  );
  const queued = useMemo(
    () => jobs.filter((j) => j.id !== foregroundId),
    [jobs, foregroundId],
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
            Every file on the card is copied. Checksums, deduplication, resume,
            proxy generation, thumbnails, and metadata all run automatically in
            the background. Use <span className="font-medium">Minimise</span> to
            queue another card while this one keeps uploading.
          </p>
        </div>
      </div>

      {/* Foreground: idle */}
      {!foreground && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-dashed border-border/60 p-6">
          <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Waiting for a device…</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Insert a camera card, SSD, HDD, or Thunderbolt drive, then click
              Connect. Press <kbd className="px-1 rounded bg-muted">Ctrl</kbd>+<kbd className="px-1 rounded bg-muted">A</kbd> in the
              picker to select everything on the device.
            </div>
          </div>
          <Button onClick={connectDevice} className="gap-2">
            <FolderInput className="w-4 h-4" /> Connect device
          </Button>
        </div>
      )}

      {/* Foreground: detected */}
      {foreground && foreground.phase === "detected" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Device" value={foreground.scan.rootLabel} icon={<HardDrive className="w-3.5 h-3.5" />} />
            <Stat label="Camera" value={foreground.scan.cameraFamilyLabel} icon={<Camera className="w-3.5 h-3.5" />} />
            <Stat label="Files" value={`${foreground.totalFiles}`} />
            <Stat label="Size" value={formatBytes(foreground.total)} />
          </div>
          {foreground.scan.mediaFormats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {foreground.scan.mediaFormats.slice(0, 20).map((fmt) => (
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
                value={foreground.projectId ?? undefined}
                onValueChange={(v) => updateJob(foreground.id, { projectId: v, projectName: projectNameOf(v) })}
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => dismissJob(foreground.id)}>Cancel</Button>
              <Button size="lg" onClick={startForegroundImport} disabled={starting || !foreground.projectId} className="gap-2">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                Start Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Foreground: importing / paused / done / error */}
      {foreground && foreground.phase !== "detected" && (
        <ForegroundProgress
          job={foreground}
          onMinimize={minimizeForeground}
          onDismiss={() => dismissJob(foreground.id)}
          onNewImport={() => { updateJob(foreground.id, { minimized: true }); setForegroundId(null); }}
        />
      )}

      {/* Background queue strip */}
      {queued.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Ingest queue · {queued.length}
            </div>
            {!foreground && (
              <Button size="sm" variant="outline" onClick={connectDevice} className="gap-2">
                <FolderInput className="w-3.5 h-3.5" /> Connect another device
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {queued.map((j) => (
              <QueueRow
                key={j.id}
                job={j}
                onOpen={() => restoreJob(j.id)}
                onDismiss={() => dismissJob(j.id)}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ForegroundProgress({
  job, onMinimize, onDismiss, onNewImport,
}: {
  job: JobEntry;
  onMinimize: () => void;
  onDismiss: () => void;
  onNewImport: () => void;
}) {
  const bytesLeft = Math.max(0, job.total - job.transferred);
  const pct = job.total > 0 ? Math.min(100, Math.round((job.transferred / job.total) * 100)) : 0;
  const eta = etaSeconds(bytesLeft, job.speedBps);
  const active = job.phase === "importing";
  const done = job.phase === "done";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {active && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
          {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {(job.phase === "error" || job.phase === "paused") && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
          <span className="truncate">
            {active && (job.currentFile || "Preparing…")}
            {done && `Import complete — ${job.completed}/${job.totalFiles} files to “${job.projectName}”`}
            {job.phase === "paused" && (job.message ?? "Paused — reconnect device to resume")}
            {job.phase === "error" && (job.message ?? "One or more files could not be uploaded")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <Button size="sm" variant="outline" onClick={onMinimize} className="gap-1.5">
              <Minimize2 className="w-3.5 h-3.5" /> Minimise
            </Button>
          )}
          {!active && (
            <Button size="sm" variant="outline" onClick={onNewImport} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> New import
            </Button>
          )}
          {!active && (
            <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <Progress value={pct} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Metric label="Progress" value={`${pct}%`} sub={`${formatBytes(job.transferred)} / ${formatBytes(job.total)}`} />
        <Metric label="Speed" value={`${formatBytes(job.speedBps)}/s`} sub={active ? "Live throughput" : "—"} />
        <Metric label="Time needed" value={active ? formatDuration(eta) : "—"} sub={active ? "at current speed" : ""} />
        <Metric
          label="Files"
          value={`${job.completed} of ${job.totalFiles}`}
          sub={job.failed > 0 ? `${job.failed} failed` : "0 failed"}
          danger={job.failed > 0}
        />
      </div>
    </div>
  );
}

function QueueRow({
  job, onOpen, onDismiss,
}: {
  job: JobEntry;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const pct = job.total > 0 ? Math.min(100, Math.round((job.transferred / job.total) * 100)) : 0;
  const eta = etaSeconds(Math.max(0, job.total - job.transferred), job.speedBps);
  const active = job.phase === "importing";
  return (
    <div className="rounded-md border border-border/40 bg-background/60 p-3 flex items-center gap-3">
      <div className="shrink-0">
        {active && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
        {job.phase === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {job.phase === "detected" && <FolderInput className="w-4 h-4 text-muted-foreground" />}
        {(job.phase === "error" || job.phase === "paused") && <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">{job.scan.rootLabel}</span>
          <span className="text-muted-foreground text-xs truncate">→ {job.projectName}</span>
        </div>
        <div className="mt-1.5">
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums flex flex-wrap gap-x-3">
          <span>{pct}%</span>
          <span>{job.completed}/{job.totalFiles} files</span>
          <span>{formatBytes(job.speedBps)}/s</span>
          <span>ETA {active ? formatDuration(eta) : "—"}</span>
          {job.failed > 0 && <span className="text-destructive">{job.failed} failed</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="outline" onClick={onOpen}>Open</Button>
        {!active && (
          <Button size="icon" variant="ghost" onClick={onDismiss} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
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

function Metric({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-medium tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}
