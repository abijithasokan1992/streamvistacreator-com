/**
 * AutoIngestPanel
 * ================
 * Three-state, one-button ingest surface with a persistent background
 * queue. Each queued transfer supports Cancel + Retry, dedupes against
 * files already uploaded to the same production, and is restored from
 * the backend after a page refresh so interrupted jobs are never lost.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, HardDrive, Loader2, CheckCircle2, AlertTriangle, PlayCircle,
  FolderInput, Camera, RefreshCw, Minimize2, X, StopCircle, RotateCw, PlugZap,
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

type Phase = "detected" | "importing" | "done" | "error" | "paused" | "cancelled";

type JobEntry = {
  id: string;                     // local uid
  dbJobId?: string;               // ingest_jobs.id once persisted
  scan: ScanResult | null;        // null when restored from DB without files
  projectId: string | null;
  projectName: string;
  phase: Phase;
  currentFile: string;
  transferred: number;
  total: number;
  speedBps: number;
  completed: number;
  failed: number;
  skipped: number;
  totalFiles: number;
  message?: string;
  minimized: boolean;
  needsReconnect: boolean;        // true when File objects are missing (post-refresh)
  rootLabel: string;
  cameraFamilyLabel: string;
  mediaFormats: string[];
};

function jobFromScan(scan: ScanResult, projectId: string | null, projectName: string): JobEntry {
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
    skipped: 0,
    totalFiles: scan.files.length,
    minimized: false,
    needsReconnect: false,
    rootLabel: scan.rootLabel,
    cameraFamilyLabel: scan.cameraFamilyLabel,
    mediaFormats: scan.mediaFormats,
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

/**
 * Build a stable dedupe key for a file without hashing the whole payload.
 * `size + lower(name) + lastModified` catches accidental duplicate ingests
 * from the same card and survives cross-session re-selection because those
 * three attributes are stable per file on disk.
 */
function dedupeKeyFor(file: File, relativePath: string): string {
  const name = (relativePath || file.name).toLowerCase();
  return `${file.size}-${file.lastModified}-${name}`;
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
  const reconnectForJobIdRef = useRef<string | null>(null);
  const jobsRef = useRef<JobEntry[]>([]);
  jobsRef.current = jobs;
  // AbortController per running job — lets Cancel abort the loop between files.
  const abortRef = useRef<Map<string, AbortController>>(new Map());

  const updateJob = useCallback((id: string, patch: Partial<JobEntry> | ((j: JobEntry) => Partial<JobEntry>)) => {
    setJobs((prev) => prev.map((j) => {
      if (j.id !== id) return j;
      const p = typeof patch === "function" ? patch(j) : patch;
      return { ...j, ...p };
    }));
  }, []);

  // Load productions.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("workspace_id", activeWorkspaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data ?? []) as Array<{ id: string; name: string | null }>;
      const mapped: Project[] = rows
        .filter((r) => !!r.id)
        .map((r) => ({ id: r.id, name: r.name ?? "Untitled production" }));
      setProjects(mapped);
      const remembered = typeof window !== "undefined"
        ? window.localStorage.getItem(`sv:activeProjectId:${activeWorkspaceId}`)
        : null;
      const preferred = mapped.find((p) => p.id === remembered) ?? mapped[0];
      setDefaultProjectId(preferred?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  // Restore paused / running / errored jobs from the backend on mount so a
  // page refresh does not lose in-flight transfers.
  useEffect(() => {
    if (!activeWorkspaceId || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ingest_jobs")
        .select("id, project_id, camera_label, status, total_files, total_bytes, transferred_bytes, completed_files, failed_files, error_message, source_summary")
        .eq("workspace_id", activeWorkspaceId)
        .in("status", ["running", "paused", "ready"])
        .order("started_at", { ascending: false })
        .limit(10);
      if (cancelled || error || !data) return;
      const restored: JobEntry[] = data.map((row) => {
        type SourceSummary = {
          root_label?: string;
          camera_family?: string;
          media_formats?: string[];
        } | null;
        const summary = (row.source_summary ?? null) as SourceSummary;
        const projName = projects.find((p) => p.id === row.project_id)?.name ?? "Production";
        return {
          id: `restored-${row.id}`,
          dbJobId: row.id,
          scan: null,
          projectId: row.project_id,
          projectName: projName,
          phase: "paused",
          currentFile: "",
          transferred: row.transferred_bytes ?? 0,
          total: row.total_bytes ?? 0,
          speedBps: 0,
          completed: row.completed_files ?? 0,
          failed: row.failed_files ?? 0,
          skipped: 0,
          totalFiles: row.total_files ?? 0,
          message: row.error_message ?? "Reconnect the device to resume this transfer.",
          minimized: true,
          needsReconnect: true,
          rootLabel: summary?.root_label ?? "Previous ingest",
          cameraFamilyLabel: row.camera_label ?? "",
          mediaFormats: Array.isArray(summary?.media_formats) ? summary!.media_formats! : [],
        };
      });
      if (restored.length > 0) {
        setJobs((prev) => [...restored, ...prev]);
      }
    })();
    return () => { cancelled = true; };
    // projects is intentionally left out — first pass gives generic names,
    // subsequent renders resolve them via projectNameOf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, user]);

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
        onScanReady(result);
      } else {
        fileInputRef.current?.click();
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error(`Could not read device: ${(e as Error).message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProjectId, projectNameOf]);

  // Common path for both the FS Access API and the <input webkitdirectory>
  // fallback. If the scan was triggered by "Reconnect" on an existing paused
  // job, replay the scan onto that job instead of creating a new one.
  const onScanReady = useCallback((result: ScanResult) => {
    const reconnectId = reconnectForJobIdRef.current;
    reconnectForJobIdRef.current = null;
    if (reconnectId) {
      const target = jobsRef.current.find((j) => j.id === reconnectId);
      if (target) {
        updateJob(reconnectId, {
          scan: result,
          rootLabel: result.rootLabel,
          cameraFamilyLabel: result.cameraFamilyLabel,
          mediaFormats: result.mediaFormats,
          totalFiles: result.files.length,
          total: result.totalBytes,
          needsReconnect: false,
          minimized: false,
          phase: "detected",
          message: undefined,
        });
        setForegroundId(reconnectId);
        toast.message("Device reconnected — press Start Import to resume.");
        return;
      }
    }
    const entry = jobFromScan(result, defaultProjectId, projectNameOf(defaultProjectId));
    setJobs((prev) => [...prev, entry]);
    setForegroundId(entry.id);
  }, [defaultProjectId, projectNameOf, updateJob]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const result = scanFileList(files);
    if (result.files.length === 0) {
      toast.error("No files found.");
      return;
    }
    onScanReady(result);
    e.target.value = "";
  }, [onScanReady]);

  const runImport = useCallback(async (entryId: string) => {
    const entry = jobsRef.current.find((j) => j.id === entryId);
    if (!entry || !user || !activeWorkspaceId) return;
    if (!entry.projectId) {
      toast.error("Select a production first.");
      return;
    }
    if (!entry.scan) {
      toast.error("Reconnect the device to resume this transfer.");
      return;
    }
    const scan = entry.scan;
    const projectId = entry.projectId;
    const ac = new AbortController();
    abortRef.current.set(entryId, ac);

    try {
      // Ingest source row.
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

      // Ingest job row. Reuse an existing dbJobId when resuming so per-item
      // history is preserved across the retry.
      let dbJobId = entry.dbJobId;
      if (!dbJobId) {
        const { data: job, error: jobErr } = await supabase
          .from("ingest_jobs")
          .insert({
            workspace_id: activeWorkspaceId,
            created_by: user.id,
            source_id: src.id,
            project_id: projectId,
            job_mode: "camera_card",
            destination_type: "working_vault",
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
        dbJobId = job.id;
        updateJob(entryId, { dbJobId });
      }

      // Pre-compute per-file dedupe keys.
      const dedupeKeys = scan.files.map((f) => dedupeKeyFor(f.file, f.relativePath));

      // Server-side dedupe: any item already `completed` in this production
      // for the same dedupe_key is skipped without re-uploading.
      const { data: alreadyDone } = await supabase
        .from("ingest_job_items")
        .select("dedupe_key")
        .in("dedupe_key", dedupeKeys.filter(Boolean))
        .eq("status", "completed")
        .limit(scan.files.length);
      const doneSet = new Set(
        ((alreadyDone ?? []) as Array<{ dedupe_key: string | null }>)
          .map((r) => r.dedupe_key)
          .filter((k): k is string => !!k),
      );

      // Insert item rows (idempotent via dedupe_key).
      const items = scan.files.map((f, i) => {
        const c = classifyFile(f.file.name, f.relativePath);
        return {
          job_id: dbJobId,
          relative_path: f.relativePath,
          file_name: f.file.name,
          size_bytes: f.file.size,
          mime_guess: f.file.type || null,
          asset_class: c.assetClass,
          status: doneSet.has(dedupeKeys[i]) ? "skipped" : "queued",
          progress_percent: doneSet.has(dedupeKeys[i]) ? 100 : 0,
          dedupe_key: dedupeKeys[i],
          client_checksum: null,
          metadata: {
            detected_type: c.detectedType,
            container: c.container,
            codec_hint: c.codecHint,
            device_hint: c.deviceHint,
            confidence: c.confidence,
            deduped: doneSet.has(dedupeKeys[i]),
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
      }).eq("id", dbJobId);

      let skippedCount = 0;
      for (let i = 0; i < scan.files.length; i++) {
        if (doneSet.has(dedupeKeys[i])) skippedCount += 1;
      }
      updateJob(entryId, {
        phase: "importing",
        skipped: skippedCount,
        completed: skippedCount,
        transferred: scan.files.reduce((s, f, i) => doneSet.has(dedupeKeys[i]) ? s + f.file.size : s, 0),
      });

      let transferredBaseline = scan.files.reduce(
        (s, f, i) => doneSet.has(dedupeKeys[i]) ? s + f.file.size : s, 0,
      );
      let completed = skippedCount;
      let failed = 0;
      const tStart = performance.now();

      for (let i = 0; i < scan.files.length; i++) {
        if (ac.signal.aborted) break;
        const f = scan.files[i];
        const dedupeKey = dedupeKeys[i];
        if (doneSet.has(dedupeKey)) continue; // already uploaded — skip
        const itemId = itemIdByPath.get(f.relativePath);
        const pendingId = `auto-${dbJobId}-${itemId ?? f.file.name}`
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
                if (ac.signal.aborted) return;
                const elapsed = (performance.now() - tStart) / 1000;
                const totalNow = transferredBaseline + loaded;
                const speed = elapsed > 0 ? (totalNow - (transferredBaseline - loaded)) / Math.max(elapsed, 0.001) : 0;
                updateJob(entryId, { transferred: totalNow, speedBps: Math.max(0, speed) });
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
              signal: ac.signal,
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
          }).eq("id", dbJobId);
          updateJob(entryId, { completed, transferred: transferredBaseline });
        } catch (e) {
          if (ac.signal.aborted || (e as Error)?.name === "AbortError") break;
          const msg = mapUploadError(e);
          const paused = e instanceof ResumableUploadInterrupted;
          if (itemId) await supabase.from("ingest_job_items").update({
            status: paused ? "paused" : "failed",
            error_message: msg,
          }).eq("id", itemId);
          if (paused) {
            updateJob(entryId, { phase: "paused", message: msg, needsReconnect: true });
            await supabase.from("ingest_jobs").update({
              status: "paused",
              error_message: `Paused at ${f.relativePath}: ${msg}`,
            }).eq("id", dbJobId);
            toast.message("Ingest paused — reconnect the device to resume.");
            abortRef.current.delete(entryId);
            return;
          }
          failed += 1;
          updateJob(entryId, { failed });
          await supabase.from("ingest_jobs")
            .update({ failed_files: failed }).eq("id", dbJobId);
        }
      }

      if (ac.signal.aborted) {
        await supabase.from("ingest_jobs").update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        }).eq("id", dbJobId);
        updateJob(entryId, { phase: "cancelled", message: "Cancelled by user" });
        toast.message("Ingest cancelled.");
      } else {
        const finalStatus = failed === 0 ? "completed" : (completed > 0 ? "completed" : "failed");
        await supabase.from("ingest_jobs").update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        }).eq("id", dbJobId);
        updateJob(entryId, { phase: failed === 0 ? "done" : "error" });
        if (failed === 0) {
          const dedupedSuffix = skippedCount > 0 ? ` (${skippedCount} already on server)` : "";
          toast.success(`Import complete — ${completed} files to “${entry.projectName}”${dedupedSuffix}.`);
        } else {
          toast.warning(`Import finished with ${failed} failure${failed === 1 ? "" : "s"}.`);
        }
      }
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
      updateJob(entryId, { phase: "error", message: (e as Error).message });
    } finally {
      abortRef.current.delete(entryId);
    }
  }, [user, activeWorkspaceId, updateJob]);

  const startForegroundImport = useCallback(async () => {
    if (!foregroundId) return;
    setStarting(true);
    try {
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

  const cancelJob = useCallback(async (id: string) => {
    const ac = abortRef.current.get(id);
    if (ac) ac.abort();
    const j = jobsRef.current.find((x) => x.id === id);
    if (j?.dbJobId) {
      await supabase.from("ingest_jobs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", j.dbJobId);
    }
    updateJob(id, { phase: "cancelled", message: "Cancelled by user", speedBps: 0 });
  }, [updateJob]);

  const retryJob = useCallback((id: string) => {
    const j = jobsRef.current.find((x) => x.id === id);
    if (!j) return;
    if (!j.scan || j.needsReconnect) {
      // Ask the user to reselect the device so we can rebuild File handles.
      reconnectForJobIdRef.current = id;
      void connectDevice();
      return;
    }
    updateJob(id, {
      phase: "detected",
      message: undefined,
      failed: 0,
      speedBps: 0,
      currentFile: "",
    });
    setForegroundId(id);
    void runImport(id);
  }, [connectDevice, runImport, updateJob]);

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
            Files already uploaded to this production are skipped automatically.
            Cancel or retry any transfer from the queue below — interrupted
            transfers survive a page refresh and resume when you reconnect the
            device.
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
      {foreground && foreground.phase === "detected" && foreground.scan && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Device" value={foreground.rootLabel} icon={<HardDrive className="w-3.5 h-3.5" />} />
            <Stat label="Camera" value={foreground.cameraFamilyLabel} icon={<Camera className="w-3.5 h-3.5" />} />
            <Stat label="Files" value={`${foreground.totalFiles}`} />
            <Stat label="Size" value={formatBytes(foreground.total)} />
          </div>
          {foreground.mediaFormats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {foreground.mediaFormats.slice(0, 20).map((fmt) => (
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

      {/* Foreground: importing / paused / done / error / cancelled */}
      {foreground && foreground.phase !== "detected" && (
        <ForegroundProgress
          job={foreground}
          onMinimize={minimizeForeground}
          onCancel={() => cancelJob(foreground.id)}
          onRetry={() => retryJob(foreground.id)}
          onDismiss={() => dismissJob(foreground.id)}
          onNewImport={() => { updateJob(foreground.id, { minimized: true }); setForegroundId(null); }}
        />
      )}

      {/* Background queue */}
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
                onCancel={() => cancelJob(j.id)}
                onRetry={() => retryJob(j.id)}
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
  job, onMinimize, onCancel, onRetry, onDismiss, onNewImport,
}: {
  job: JobEntry;
  onMinimize: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onNewImport: () => void;
}) {
  const bytesLeft = Math.max(0, job.total - job.transferred);
  const pct = job.total > 0 ? Math.min(100, Math.round((job.transferred / job.total) * 100)) : 0;
  const eta = etaSeconds(bytesLeft, job.speedBps);
  const active = job.phase === "importing";
  const done = job.phase === "done";
  const retryable = job.phase === "error" || job.phase === "paused" || job.phase === "cancelled";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {active && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
          {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {(job.phase === "error" || job.phase === "paused" || job.phase === "cancelled") && (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className="truncate">
            {active && (job.currentFile || "Preparing…")}
            {done && `Import complete — ${job.completed}/${job.totalFiles} files to “${job.projectName}”`}
            {job.phase === "paused" && (job.message ?? "Paused — reconnect device to resume")}
            {job.phase === "cancelled" && (job.message ?? "Cancelled")}
            {job.phase === "error" && (job.message ?? "One or more files could not be uploaded")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <>
              <Button size="sm" variant="outline" onClick={onMinimize} className="gap-1.5">
                <Minimize2 className="w-3.5 h-3.5" /> Minimise
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1.5 text-destructive hover:text-destructive">
                <StopCircle className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          )}
          {retryable && (
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
              {job.needsReconnect ? <PlugZap className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
              {job.needsReconnect ? "Reconnect" : "Retry"}
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
          sub={
            job.failed > 0
              ? `${job.failed} failed${job.skipped ? ` · ${job.skipped} deduped` : ""}`
              : job.skipped
                ? `${job.skipped} deduped`
                : "0 failed"
          }
          danger={job.failed > 0}
        />
      </div>
    </div>
  );
}

function QueueRow({
  job, onOpen, onCancel, onRetry, onDismiss,
}: {
  job: JobEntry;
  onOpen: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const pct = job.total > 0 ? Math.min(100, Math.round((job.transferred / job.total) * 100)) : 0;
  const eta = etaSeconds(Math.max(0, job.total - job.transferred), job.speedBps);
  const active = job.phase === "importing";
  const retryable = job.phase === "error" || job.phase === "paused" || job.phase === "cancelled";
  return (
    <div className="rounded-md border border-border/40 bg-background/60 p-3 flex items-center gap-3">
      <div className="shrink-0">
        {active && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
        {job.phase === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {job.phase === "detected" && <FolderInput className="w-4 h-4 text-muted-foreground" />}
        {(job.phase === "error" || job.phase === "paused" || job.phase === "cancelled") && (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">{job.rootLabel}</span>
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
          {job.skipped > 0 && <span>{job.skipped} deduped</span>}
          {job.failed > 0 && <span className="text-destructive">{job.failed} failed</span>}
          {job.phase === "paused" && <span className="text-amber-500">Paused</span>}
          {job.phase === "cancelled" && <span className="text-amber-500">Cancelled</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {active && (
          <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1 text-destructive hover:text-destructive">
            <StopCircle className="w-3.5 h-3.5" /> Cancel
          </Button>
        )}
        {retryable && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
            {job.needsReconnect ? <PlugZap className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
            {job.needsReconnect ? "Reconnect" : "Retry"}
          </Button>
        )}
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
