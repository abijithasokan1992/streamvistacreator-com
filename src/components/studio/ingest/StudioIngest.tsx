/**
 * StudioIngest
 * ============
 * Unified ingest surface that exposes the four professional ingest modes inside
 * the existing Studio dashboard shell — no shell redesign, no replacement of
 * the OCI multipart uploader. Each mode produces a real `ingest_jobs` row plus
 * `ingest_sources` / `ingest_job_items` records so the source structure is
 * preserved and the queue is honest.
 *
 *   1. Connected Drive Import   — local attached drive / folder
 *   2. Camera Card Intake       — DIT shoot-day card offload (repeatable)
 *   3. Watch Folder / Near-live — rescan-on-click MVP + agent-ready copy
 *   4. Archive Intake           — destination = archive_vault, creates archive_jobs
 *
 * Uploads route through the existing `uploadFileMultipart` driver, passing
 * the file's source-relative folder as `subpath` so professional folder trees
 * (A_CAM / B_CAM / SOUND / day_01 …) are preserved instead of flattened.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HardDrive, Camera, FolderClock, Snowflake, FolderOpen, Loader2, ListChecks,
  CheckCircle2, AlertTriangle, Cloud, Gauge, RefreshCw, Building2, FileVideo,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useStorageQuota, StorageWarningBanner } from "@/hooks/useStorageQuota";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  uploadFileMultipart, MULTIPART_THRESHOLD, ResumableUploadInterrupted,
  mapUploadError,
} from "@/lib/ociMultipartUpload";
import HardDiskIntakeDialog from "@/components/studio/HardDiskIntakeDialog";
import IngestDiagnosticsPanel from "@/components/studio/ingest/IngestDiagnosticsPanel";

type IngestMode = "connected_drive" | "camera_card" | "watch_folder" | "archive";

type ScannedFile = {
  file: File;
  relativePath: string; // full path relative to drop root, including filename
  subpath: string;      // directory only, relative to drop root (no filename)
};

type ScanSummary = {
  rootLabel: string;
  files: ScannedFile[];
  totalBytes: number;
  topLevelFolders: string[];
};

type Project = { id: string; name: string };

type JobRow = {
  id: string;
  job_mode: string;
  status: string;
  destination_type: string;
  total_bytes: number;
  transferred_bytes: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  preserve_structure: boolean;
  notes: string | null;
  created_at: string;
  source_summary: any;
};

const MODES: { id: IngestMode; label: string; icon: any; blurb: string }[] = [
  { id: "connected_drive", label: "Connected Drive Import", icon: HardDrive,
    blurb: "Locally attached drives, shuttle disks and folders selected from this browser." },
  { id: "camera_card",     label: "Camera Card Intake",     icon: Camera,
    blurb: "DIT-friendly card offload — repeatable per project / shoot day, preserves card structure." },
  { id: "watch_folder",    label: "Watch Folder / Near-live", icon: FolderClock,
    blurb: "Rescan a folder for new media as the shoot continues. Background watch is powered by the Crayons Bridge Ingest Engine." },
  { id: "archive",         label: "Archive Intake",         icon: Snowflake,
    blurb: "Master archive bundles, project backup drives and archive vault hand-offs." },
];

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  if (n < 1099511627776) return `${(n / 1073741824).toFixed(2)} GB`;
  return `${(n / 1099511627776).toFixed(2)} TB`;
}

function fileToScanned(file: File): ScannedFile {
  // Vite types don't include webkitRelativePath on the File interface, but the
  // DOM exposes it on directory selections. Fall back to the bare filename
  // when the picker did not provide a relative path (single file pickers).
  const wkRel = (file as any).webkitRelativePath as string | undefined;
  const rel = wkRel && wkRel.length > 0 ? wkRel : file.name;
  const lastSlash = rel.lastIndexOf("/");
  const subpath = lastSlash >= 0 ? rel.slice(0, lastSlash) : "";
  return { file, relativePath: rel, subpath };
}

function summarize(files: ScannedFile[], fallbackLabel: string): ScanSummary {
  const total = files.reduce((s, f) => s + f.file.size, 0);
  const tops = new Set<string>();
  let rootLabel = fallbackLabel;
  for (const f of files) {
    const first = f.relativePath.split("/")[0];
    if (first && first !== f.file.name) tops.add(first);
  }
  // If every file shares one root folder, use it as the source label.
  if (tops.size === 1) {
    const only = Array.from(tops)[0];
    if (only) rootLabel = only;
  }
  return {
    rootLabel,
    files,
    totalBytes: total,
    topLevelFolders: Array.from(tops).slice(0, 24),
  };
}

/* ============================================================
 * Hook: ingest queue
 * ============================================================ */
function useIngestQueue(workspaceId: string | null) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!workspaceId) { setJobs([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("ingest_jobs")
      .select("id,job_mode,status,destination_type,total_bytes,transferred_bytes,total_files,completed_files,failed_files,preserve_structure,notes,created_at,source_summary")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs((data as JobRow[]) ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { jobs, loading, refresh };
}

/* ============================================================
 * Source / Project selectors
 * ============================================================ */
function useWorkspaceProjects(workspaceId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    if (!workspaceId) { setProjects([]); return; }
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      setProjects((data as Project[]) ?? []);
    })();
  }, [workspaceId]);
  return projects;
}

/* ============================================================
 * Main component
 * ============================================================ */
export default function StudioIngest() {
  const { user } = useAuth();
  const { workspaces, activeId, setActiveId, canWriteActive } = useWorkspaces();
  const quota = useStorageQuota();
  const projects = useWorkspaceProjects(activeId ?? null);
  const queue = useIngestQueue(activeId ?? null);

  const [mode, setMode] = useState<IngestMode>("connected_drive");
  const [scan, setScan] = useState<ScanSummary | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [shootDay, setShootDay] = useState("");
  const [cameraLabel, setCameraLabel] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [notes, setNotes] = useState("");
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liveProgress, setLiveProgress] = useState<{
    jobId: string | null;
    currentFile: string;
    transferred: number;
    total: number;
    speedBps: number;
    completed: number;
    failed: number;
    totalFiles: number;
    state: "idle" | "uploading" | "done" | "paused" | "error";
  }>({ jobId: null, currentFile: "", transferred: 0, total: 0, speedBps: 0, completed: 0, failed: 0, totalFiles: 0, state: "idle" });

  const folderInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const watchInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const destinationType: "working_vault" | "archive_vault" =
    mode === "archive" ? "archive_vault" : "working_vault";

  const onFiles = useCallback((files: FileList | null, fallbackLabel: string) => {
    if (!files || files.length === 0) return;
    const scanned = Array.from(files).map(fileToScanned);
    setScan(summarize(scanned, fallbackLabel));
  }, []);

  const openPicker = (m: IngestMode) => {
    setMode(m);
    setScan(null);
    if (m === "connected_drive") folderInputRef.current?.click();
    else if (m === "camera_card") cardInputRef.current?.click();
    else if (m === "watch_folder") watchInputRef.current?.click();
    else if (m === "archive") archiveInputRef.current?.click();
  };

  const rescan = () => {
    // For watch-folder MVP, asking the user to re-pick is the honest browser-
    // only behaviour: there is no OS-level watcher inside a tab.
    setScan(null);
    openPicker("watch_folder");
  };

  const startIngest = useCallback(async () => {
    if (!scan || !activeId || !user) return;
    if (!canWriteActive) { toast.error("You only have viewer access to this workspace"); return; }
    if (!quota.checkOrPaywall()) return;
    setSubmitting(true);
    try {
      // 1. Source row (label + summary metadata so future agent can reattach).
      const { data: src, error: srcErr } = await supabase
        .from("ingest_sources")
        .insert({
          workspace_id: activeId,
          created_by: user.id,
          source_type: mode === "connected_drive" ? "external_drive"
                     : mode === "camera_card"    ? "camera_card"
                     : mode === "watch_folder"   ? "watch_folder"
                                                 : "archive_drive",
          label: scan.rootLabel,
          path_hint: scan.rootLabel,
          metadata: {
            file_count: scan.files.length,
            total_bytes: scan.totalBytes,
            top_level_folders: scan.topLevelFolders,
          },
        })
        .select("id")
        .single();
      if (srcErr || !src) throw srcErr ?? new Error("Failed to create ingest source");

      // 2. Job row.
      const { data: job, error: jobErr } = await supabase
        .from("ingest_jobs")
        .insert({
          workspace_id: activeId,
          created_by: user.id,
          source_id: src.id,
          project_id: projectId || null,
          job_mode: mode,
          destination_type: destinationType,
          preserve_structure: preserveStructure,
          shoot_day: shootDay || null,
          camera_label: cameraLabel || null,
          asset_class: assetClass || null,
          notes: notes || null,
          status: "ready",
          total_files: scan.files.length,
          total_bytes: scan.totalBytes,
          source_summary: {
            root_label: scan.rootLabel,
            top_level_folders: scan.topLevelFolders,
          },
        })
        .select("id")
        .single();
      if (jobErr || !job) throw jobErr ?? new Error("Failed to create ingest job");

      // 3. Job item rows (relative_path preserved per file).
      const itemsPayload = scan.files.map((f) => ({
        job_id: job.id,
        relative_path: f.relativePath,
        file_name: f.file.name,
        size_bytes: f.file.size,
        mime_guess: f.file.type || null,
        asset_class: assetClass || null,
      }));
      // Insert in chunks to stay under PostgREST payload limits.
      for (let i = 0; i < itemsPayload.length; i += 200) {
        const chunk = itemsPayload.slice(i, i + 200);
        const { data: ins, error: itemErr } = await supabase
          .from("ingest_job_items").insert(chunk).select("id");
        if (itemErr) throw itemErr;
        // Attach ids back to our local files in order
        if (ins) for (let j = 0; j < ins.length; j++) (scan.files[i + j] as any)._itemId = (ins[j] as any).id;
      }

      // 4. Archive Intake: also create a tracked archive_jobs row so the
      //    archive workflow is real and not just a cosmetic label.
      let archiveJobId: string | null = null;
      if (mode === "archive") {
        const { data: aj } = await supabase
          .from("archive_jobs")
          .insert({
            workspace_id: activeId,
            requested_by: user.id,
            source_tier: "standard",
            target_tier: "archive",
            total_bytes: scan.totalBytes,
            status: "queued",
            metadata: { ingest_job_id: job.id, source_label: scan.rootLabel },
          })
          .select("id")
          .single();
        archiveJobId = (aj as any)?.id ?? null;
      }

      await supabase.from("ingest_jobs").update({
        status: "uploading", started_at: new Date().toISOString(),
        metadata: archiveJobId ? { archive_job_id: archiveJobId } : {},
      }).eq("id", job.id);

      // 5. Upload loop — reuse existing multipart driver.
      setLiveProgress({
        jobId: job.id, currentFile: "", transferred: 0, total: scan.totalBytes,
        speedBps: 0, completed: 0, failed: 0, totalFiles: scan.files.length, state: "uploading",
      });
      queue.refresh();

      let transferredBaseline = 0;
      let completed = 0;
      let failed = 0;
      const tStart = performance.now();

      for (const f of scan.files) {
        const itemId = (f as any)._itemId as string | undefined;
        const pendingId = `ingest-${job.id}-${itemId ?? f.file.name}`.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 120);
        const subpath = preserveStructure ? f.subpath : "";
        setLiveProgress((p) => ({ ...p, currentFile: f.relativePath, state: "uploading" }));
        if (itemId) await supabase.from("ingest_job_items").update({ status: "uploading" }).eq("id", itemId);

        try {
          if (f.file.size > MULTIPART_THRESHOLD) {
            await uploadFileMultipart({
              file: f.file,
              workspaceId: activeId,
              projectId: projectId || null,
              pendingId,
              subpath: subpath || null,
              onProgress: (loaded, total) => {
                const elapsed = (performance.now() - tStart) / 1000;
                const totalNow = transferredBaseline + loaded;
                const speed = elapsed > 0 ? totalNow / elapsed : 0;
                setLiveProgress((p) => ({
                  ...p,
                  transferred: totalNow,
                  speedBps: speed,
                }));
                if (itemId) {
                  const pct = Math.max(1, Math.min(99, Math.round((loaded / total) * 100)));
                  // Fire-and-forget; avoid blocking upload pump.
                  void supabase.from("ingest_job_items").update({ progress_percent: pct }).eq("id", itemId);
                }
              },
            });
          } else {
            // Tiny files — go through the small-object oci-upload edge route.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in");
            const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;
            const form = new FormData();
            form.append("file", f.file);
            form.append("workspaceId", activeId);
            form.append("pendingId", pendingId);
            if (subpath) form.append("subpath", subpath);
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
          if (itemId) await supabase.from("ingest_job_items").update({
            status: "completed", progress_percent: 100,
          }).eq("id", itemId);
          await supabase.from("ingest_jobs").update({
            transferred_bytes: transferredBaseline,
            completed_files: completed,
          }).eq("id", job.id);
          setLiveProgress((p) => ({ ...p, completed }));
        } catch (e) {
          const msg = mapUploadError(e);
          const paused = e instanceof ResumableUploadInterrupted;
          if (itemId) await supabase.from("ingest_job_items").update({
            status: paused ? "paused" : "failed",
            error_message: msg,
          }).eq("id", itemId);
          if (paused) {
            // Surface as paused — rest of the queue can resume on re-pick.
            setLiveProgress((p) => ({ ...p, state: "paused" }));
            await supabase.from("ingest_jobs").update({
              status: "paused", error_message: `Paused at ${f.relativePath}: ${msg}`,
            }).eq("id", job.id);
            toast.message("Ingest paused — pick the same source folder again to resume.");
            queue.refresh();
            return;
          }
          failed += 1;
          setLiveProgress((p) => ({ ...p, failed }));
          await supabase.from("ingest_jobs").update({
            failed_files: failed,
          }).eq("id", job.id);
        }
      }

      const finalStatus = failed === 0 ? "completed" : (completed > 0 ? "completed" : "failed");
      await supabase.from("ingest_jobs").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (archiveJobId) await supabase.from("archive_jobs").update({
        status: finalStatus === "completed" ? "completed" : "failed",
        transferred_bytes: transferredBaseline,
        progress_percent: scan.totalBytes > 0 ? Math.round((transferredBaseline / scan.totalBytes) * 100) : 100,
        completed_at: new Date().toISOString(),
      }).eq("id", archiveJobId);

      setLiveProgress((p) => ({ ...p, state: failed === 0 ? "done" : "error" }));
      toast.success(`Ingest job complete — ${completed} of ${scan.files.length} files`);
      setScan(null);
      queue.refresh();
      quota.refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Ingest failed");
      setLiveProgress((p) => ({ ...p, state: "error" }));
    } finally {
      setSubmitting(false);
    }
  }, [scan, activeId, user, canWriteActive, quota, mode, destinationType, preserveStructure,
      projectId, shootDay, cameraLabel, assetClass, notes, queue]);

  const currentModeMeta = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  return (
    <div className="space-y-6">
      {/* Workspace + mode header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl">Studio Ingest</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Bring footage into your studio vault from local drives, camera cards, watch folders or archive
            bundles. Source folder structure is preserved by default — A_CAM / B_CAM / SOUND / day_01 stays intact.
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 tracking-wide">
            Powered by Crayons Bridge Ingest Engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          {workspaces.length > 0 && (
            <Select value={activeId ?? ""} onValueChange={(v) => setActiveId(v)}>
              <SelectTrigger className="h-9 w-[220px] text-xs">
                <Building2 className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Pick a workspace…" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">{w.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={queue.refresh} disabled={queue.loading || !activeId}>
            <RefreshCw className={`h-4 w-4 mr-2 ${queue.loading ? "animate-spin" : ""}`} />
            Refresh queue
          </Button>
        </div>
      </div>

      <StorageWarningBanner />

      {/* Mode selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setScan(null); }}
              className={`text-left rounded-xl border p-4 transition-colors ${
                active
                  ? "border-accent/60 bg-accent/10 ring-1 ring-accent/40"
                  : "border-border/40 bg-secondary/10 hover:bg-secondary/20"
              }`}
            >
              <div className="flex items-center gap-2 text-accent">
                <Icon className="w-4 h-4" />
                <span className="font-medium text-foreground">{m.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{m.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Picker / scan / submit panel */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <currentModeMeta.icon className="w-4 h-4 text-accent" />
          <h3 className="font-semibold">{currentModeMeta.label}</h3>
        </div>

        {/* Hidden inputs — webkitdirectory captures source structure */}
        <input
          ref={folderInputRef} type="file" multiple
          // @ts-expect-error - non-standard but supported in Chromium/WebKit
          webkitdirectory="" directory=""
          className="hidden"
          onChange={(e) => onFiles(e.target.files, "Connected drive")}
        />
        <input
          ref={cardInputRef} type="file" multiple
          // @ts-expect-error - non-standard but supported in Chromium/WebKit
          webkitdirectory="" directory=""
          className="hidden"
          onChange={(e) => onFiles(e.target.files, cameraLabel || "Camera card")}
        />
        <input
          ref={watchInputRef} type="file" multiple
          // @ts-expect-error - non-standard but supported in Chromium/WebKit
          webkitdirectory="" directory=""
          className="hidden"
          onChange={(e) => onFiles(e.target.files, "Watch folder")}
        />
        <input
          ref={archiveInputRef} type="file" multiple
          // @ts-expect-error - non-standard but supported in Chromium/WebKit
          webkitdirectory="" directory=""
          className="hidden"
          onChange={(e) => onFiles(e.target.files, "Archive bundle")}
        />

        {mode === "watch_folder" && (
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            Browsers can't background-watch a folder. This MVP rescans the folder when you click <strong>Rescan source</strong>.
            Continuous background watch arrives with the Crayons Bridge Ingest Engine.
          </p>
        )}

        {mode === "connected_drive" && (
          <p className="text-[11px] text-muted-foreground">
            For drives that are <em>physically shipped</em> to StreamVista (not attached to this browser), use{" "}
            <span className="inline-flex items-center gap-1 text-foreground"><Truck className="w-3 h-3" /> Ship a physical drive</span> below.
          </p>
        )}

        {/* Optional project / asset context */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Project / Title (optional)</Label>
            <Select value={projectId || "__none"} onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No project</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shoot day / batch</Label>
            <Input value={shootDay} onChange={(e) => setShootDay(e.target.value)} className="h-9 text-xs"
                   placeholder={mode === "camera_card" ? "Day 03" : "Optional"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Camera / source label</Label>
            <Input value={cameraLabel} onChange={(e) => setCameraLabel(e.target.value)} className="h-9 text-xs"
                   placeholder={mode === "camera_card" ? "A_CAM_001" : "Optional"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Asset class</Label>
            <Select value={assetClass || "__none"} onValueChange={(v) => setAssetClass(v === "__none" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Auto-detect</SelectItem>
                <SelectItem value="rushes">Rushes</SelectItem>
                <SelectItem value="masters">Masters</SelectItem>
                <SelectItem value="proxies">Proxies</SelectItem>
                <SelectItem value="audio">Audio / sound</SelectItem>
                <SelectItem value="reports">Reports / sidecars</SelectItem>
                <SelectItem value="project_bundle">Project bundle</SelectItem>
                <SelectItem value="archive">Archive bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch checked={preserveStructure} onCheckedChange={setPreserveStructure} id="preserve" />
            <Label htmlFor="preserve" className="text-xs">Preserve source folder structure</Label>
          </div>
          <div className="flex gap-2">
            {mode === "watch_folder" && scan && (
              <Button variant="outline" size="sm" onClick={rescan}>
                <RefreshCw className="w-4 h-4 mr-2" /> Rescan source
              </Button>
            )}
            <Button onClick={() => openPicker(mode)} disabled={!activeId} variant="outline">
              <FolderOpen className="w-4 h-4 mr-2" />
              {scan ? "Choose a different source" : mode === "camera_card" ? "Choose card" : "Choose source folder"}
            </Button>
          </div>
        </div>

        {/* Scan summary */}
        {scan && (
          <Card className="p-4 bg-secondary/10 border-accent/20">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Source summary</p>
                <h4 className="font-display text-lg mt-0.5">{scan.rootLabel}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {scan.files.length} files · {fmtBytes(scan.totalBytes)} · destination:{" "}
                  <strong>{destinationType === "archive_vault" ? "Archive Vault" : "Working Vault"}</strong>
                  {projectId && projects.find((p) => p.id === projectId) && (
                    <> · project: <strong>{projects.find((p) => p.id === projectId)!.name}</strong></>
                  )}
                </p>
                {scan.topLevelFolders.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {scan.topLevelFolders.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}/</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Button onClick={startIngest} disabled={submitting || !canWriteActive}
                        className="bg-gradient-primary text-primary-foreground glow-primary">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cloud className="w-4 h-4 mr-2" />}
                  Start ingest
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  {preserveStructure ? "Folder tree preserved" : "Files flattened to root"}
                </p>
              </div>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for this ingest job (DIT comments, shoot context, archive intent)…"
                      className="mt-3 text-xs min-h-[64px]" />
          </Card>
        )}

        {/* Live upload meter */}
        {liveProgress.state !== "idle" && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-accent" />
                {liveProgress.state === "uploading" && "Uploading"}
                {liveProgress.state === "done" && "Complete"}
                {liveProgress.state === "paused" && "Paused — resumable"}
                {liveProgress.state === "error" && "Some files failed"}
              </span>
              <span className="font-mono text-muted-foreground">
                {fmtBytes(liveProgress.transferred)} / {fmtBytes(liveProgress.total)} ·{" "}
                {fmtBytes(liveProgress.speedBps)}/s
                {liveProgress.speedBps > 0 && liveProgress.total > liveProgress.transferred && (
                  <> · ETA {Math.max(1, Math.round((liveProgress.total - liveProgress.transferred) / Math.max(1, liveProgress.speedBps)))}s</>
                )}
              </span>
            </div>
            {liveProgress.total > 0 && (
              <Progress className="h-1.5 mt-2"
                        value={Math.min(100, Math.round((liveProgress.transferred / liveProgress.total) * 100))} />
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span className="truncate">{liveProgress.currentFile}</span>
              <span>{liveProgress.completed}/{liveProgress.totalFiles} files · {liveProgress.failed} failed</span>
            </div>
          </Card>
        )}
      </Card>

      {/* Hard-disk ship-in lane (Option C) — distinct from local Connected Drive Import */}
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3 border-border/40 bg-secondary/5">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-accent" /> Ship a physical drive
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            For shoots that can't upload over network — courier or hand over a drive and our team ingests it
            into your studio vault. This is a founder-assisted intake, separate from local Connected Drive Import.
          </p>
        </div>
        <HardDiskIntakeDialog />
      </Card>

      {/* Ingest queue */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-accent" /> Ingest queue
          </h3>
          {queue.loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {queue.jobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ingest jobs yet for this workspace.</p>
        ) : (
          <ul className="divide-y divide-border/30 text-sm">
            {queue.jobs.map((j) => {
              const pct = j.total_bytes > 0 ? Math.min(100, Math.round((j.transferred_bytes / j.total_bytes) * 100)) : 0;
              const tone =
                j.status === "completed" ? "text-emerald-300" :
                j.status === "failed" ? "text-destructive" :
                j.status === "paused" ? "text-amber-300" :
                j.status === "uploading" || j.status === "verifying" || j.status === "retrying" ? "text-accent" :
                "text-muted-foreground";
              return (
                <li key={j.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <FileVideo className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="font-medium truncate">{j.source_summary?.root_label ?? "(unnamed source)"}</span>
                        <Badge variant="outline" className="text-[10px]">{j.job_mode}</Badge>
                        <Badge variant="outline" className="text-[10px]">{j.destination_type === "archive_vault" ? "archive" : "working"}</Badge>
                        {j.preserve_structure && <Badge variant="outline" className="text-[10px]">preserve</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {j.completed_files}/{j.total_files} files · {fmtBytes(j.transferred_bytes)} / {fmtBytes(j.total_bytes)}
                        {j.failed_files > 0 && <> · <span className="text-destructive">{j.failed_files} failed</span></>}
                        {" "}· {new Date(j.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] uppercase tracking-widest font-mono ${tone}`}>{j.status}</span>
                      <div className="w-32 mt-1.5">
                        <Progress value={pct} className="h-1" />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
