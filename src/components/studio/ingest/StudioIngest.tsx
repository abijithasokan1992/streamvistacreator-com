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
  Truck, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, Sparkles,
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
import { classifyFile, enrichFile } from "@/lib/ingest/mediaIntelligence";
import HardDiskIntakeDialog from "@/components/studio/HardDiskIntakeDialog";
import { IngestDestinationPreview } from "./IngestDestinationPreview";
import { IngestTimeline } from "./IngestTimeline";
// IngestDiagnosticsPanel is rendered on the Advanced Settings page, not inline.

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
  started_at: string | null;
  completed_at: string | null;
  source_summary: any;
  metadata: any;
};

// UI labels only — every mode routes through the same ingest engine
// (Upload → Checksum → Primary Backup → OCI Sync → Proxy → Library → Editorial).
// Adding a new source type in future = another tile with the same `id`
// semantics; no new pipeline, no backend redesign.
const MODES: { id: IngestMode; label: string; icon: any; blurb: string }[] = [
  { id: "connected_drive", label: "Browser Upload", icon: HardDrive,
    blurb: "Drag & drop files or a full folder from your computer. Also handles bulk uploads." },
  { id: "camera_card",     label: "Camera Card",    icon: Camera,
    blurb: "Offload a camera card or mag straight from the DIT cart." },
  { id: "watch_folder",    label: "Camera-to-Cloud", icon: FolderClock,
    blurb: "Live-scan a folder as the shoot continues — near-real-time ingest." },
  { id: "archive",         label: "Archive Intake", icon: Snowflake,
    blurb: "Master bundles and completed projects for long-term vault." },
];

const CAMERA_BRANDS = [
  "ARRI", "RED", "Sony", "Blackmagic", "Canon Cinema EOS",
  "Panasonic", "DJI", "GoPro", "Nikon", "Fujifilm", "Leica", "Phantom", "Other",
];

/** Business-friendly auto-classification from filename / folder path. */
function autoClassify(relativePath: string): "rushes" | "proxies" | "audio" | "reports" | "project_bundle" {
  const p = relativePath.toLowerCase();
  if (/\.(wav|aif|aiff|mp3|flac|bwf|m4a)$/.test(p)) return "audio";
  if (/\/(proxy|proxies|prores_proxy|avid_proxy)\//.test(p) || /_proxy\.|\.proxy\./.test(p)) return "proxies";
  if (/\.(pdf|csv|xml|xmp|ale|edl|txt|md|json|log)$/.test(p) || /\/(reports?|sidecars?|metadata)\//.test(p)) return "reports";
  if (/\.(r3d|ari|arx|braw|mxf|dng|cdng|crm|rmf|mov|mp4|mts|m2ts)$/.test(p)) return "rushes";
  return "project_bundle";
}

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
      .select("id,job_mode,status,destination_type,total_bytes,transferred_bytes,total_files,completed_files,failed_files,preserve_structure,notes,created_at,started_at,completed_at,source_summary,metadata")
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
export default function StudioIngest({
  activeProjectId,
  activeProjectDefaults,
  onCompleted,
}: {
  /** When provided, the ingest form is pre-bound to this Production so Upload
   *  inherits the Active Production without asking the user to re-pick it. */
  activeProjectId?: string;
  /** Optional metadata inherited from the Active Production (crew JSONB). */
  activeProjectDefaults?: {
    cameraBrand?: string;
    unit?: string;
    cameraPackages?: Array<{
      id: string;
      name: string;
      camera_system?: string;
      camera_model?: string;
      recording_format?: string;
      codec?: string;
      resolution?: string;
      frame_rate?: string;
      color_space?: string;
      lut?: string;
      card_prefix?: string;
    }>;
    /** Read-only display in the ingest header. */
    productionNumber?: string;
    projectName?: string;
  };
  /** Fires once an ingest job reaches its terminal status. Parent dialogs
   *  (e.g. IngestMediaDialog) use this to auto-close after Save. */
  onCompleted?: (result: { jobId: string; status: "completed" | "failed" }) => void;
} = {}) {
  const { user } = useAuth();
  const { workspaces, activeId, active, setActiveId, canWriteActive } = useWorkspaces();
  const quota = useStorageQuota();
  const projects = useWorkspaceProjects(activeId ?? null);
  const queue = useIngestQueue(activeId ?? null);

  // RLS on ingest_jobs requires workspace admin/owner AND a premium storage
  // entitlement (or global admin). Pre-flight this on the client so the user
  // gets a clear, actionable message instead of a raw RLS violation.
  const [isPremiumEligible, setIsPremiumEligible] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (!user) { setIsPremiumEligible(null); return; }
    (async () => {
      const { data } = await (supabase as any).rpc("has_premium_storage_entitlement", { _user_id: user.id });
      if (alive) setIsPremiumEligible(Boolean(data));
    })();
    return () => { alive = false; };
  }, [user?.id]);
  const isWorkspaceAdmin = active?.role === "owner" || active?.role === "admin";
  const canIngest = isWorkspaceAdmin && isPremiumEligible !== false;

  const [mode, setMode] = useState<IngestMode>("connected_drive");
  const [scan, setScan] = useState<ScanSummary | null>(null);
  const [projectId, setProjectId] = useState<string>(activeProjectId ?? "");
  const [shootDay, setShootDay] = useState("");
  const [unitLabel, setUnitLabel] = useState(activeProjectDefaults?.unit ?? "");
  const [cameraBrand, setCameraBrand] = useState(activeProjectDefaults?.cameraBrand ?? "");
  const [cameraLabel, setCameraLabel] = useState("");
  const [cardLabel, setCardLabel] = useState("");
  const [cameraPackageId, setCameraPackageId] = useState<string>("");
  const [assetClass, setAssetClass] = useState("");
  const [notes, setNotes] = useState("");
  // Upload layout mode — replaces the old boolean "preserve" checkbox with a
  // required 3-way choice. Camera Card intake always defaults to `preserve`
  // because DIT card layouts must match 1:1 with the physical card for
  // relinking, checksum verification, and archive restoration.
  const [layoutMode, setLayoutMode] = useState<"preserve" | "metadata" | "custom">("preserve");
  const [customBasePath, setCustomBasePath] = useState<string>("");
  const preserveStructure = layoutMode !== "metadata"; // kept for the existing DB column
  const [submitting, setSubmitting] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const cameraPackages = activeProjectDefaults?.cameraPackages ?? [];
  const selectedPackage = useMemo(
    () => cameraPackages.find((p) => p.id === cameraPackageId) ?? null,
    [cameraPackages, cameraPackageId],
  );

  // Auto-select the first Camera Package on mount / project change so the DIT
  // only has to touch it when swapping rigs.
  useEffect(() => {
    if (cameraPackages.length > 0 && !cameraPackageId) {
      setCameraPackageId(cameraPackages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, cameraPackages.length]);

  // Inherit technical defaults from the selected Camera Package. Only overwrite
  // fields the user hasn't already edited for this job.
  useEffect(() => {
    if (!selectedPackage) return;
    setCameraBrand((prev) => prev || selectedPackage.camera_system || activeProjectDefaults?.cameraBrand || "");
    setCameraLabel((prev) => prev || selectedPackage.name || "");
    setCardLabel((prev) => prev || (selectedPackage.card_prefix ? `${selectedPackage.card_prefix}001` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackage?.id]);

  // Keep the ingest form synchronized with the Active Production selected in
  // the dashboard. We only override an empty value so a per-job change sticks.
  useEffect(() => {
    if (activeProjectId && activeProjectId !== projectId) setProjectId(activeProjectId);
    if (activeProjectDefaults?.cameraBrand && !cameraBrand) setCameraBrand(activeProjectDefaults.cameraBrand);
    if (activeProjectDefaults?.unit && !unitLabel) setUnitLabel(activeProjectDefaults.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, activeProjectDefaults?.cameraBrand, activeProjectDefaults?.unit]);
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

  // Camera card ingest → force "preserve" as the safe default so the card
  // layout survives 1:1. Users can still switch modes for their session, but
  // switching *into* camera_card resets the choice back to preserve.
  useEffect(() => {
    if (mode === "camera_card") setLayoutMode("preserve");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Slugify a metadata token so it is safe inside an object key. Empty parts
  // collapse away so we never emit `//` or leading slashes.
  const slug = (s: string) =>
    (s ?? "").toString().trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");

  // Map the intelligent classification to the asset-type folder buckets the
  // user requested (RAW, Audio, Stills, Documents, Graphics, LUTs, VFX,
  // Master Files). This is only used for the "metadata" layout mode.
  const assetTypeFolder = (relPath: string, hintClass?: string): string => {
    const cls = (hintClass || autoClassify(relPath)) as string;
    const p = relPath.toLowerCase();
    if (/\.(cube|3dl|look)$/.test(p) || /\/(luts?|colou?r)\//.test(p)) return "LUTs";
    if (/\/(vfx|plates?|comps?)\//.test(p)) return "VFX";
    if (/\/(masters?|deliverables?)\//.test(p) || /_master[._-]|final_master/.test(p)) return "Master Files";
    if (/\/(graphics?|art|design|logos?|posters?|thumbnails?)\//.test(p)) return "Graphics";
    if (/\.(jpg|jpeg|png|tif|tiff|heic|heif|webp|dng)$/.test(p) && !/\.(r3d|ari|arx|braw|crm|rmf)$/.test(p)) return "Stills";
    if (cls === "audio") return "Audio";
    if (cls === "reports") return "Documents";
    if (cls === "rushes") return "RAW";
    return "Media";
  };

  // Compute the object-key subpath for a scanned file according to the active
  // layout mode. Filenames are NEVER rewritten and files are NEVER duplicated —
  // only the directory prefix changes.
  const buildSubpath = (f: ScannedFile): string => {
    if (layoutMode === "preserve") return f.subpath;
    if (layoutMode === "custom") {
      const base = customBasePath.replace(/^\/+|\/+$/g, "");
      return [base, f.subpath].filter(Boolean).join("/");
    }
    // metadata mode → Shoot Day / Camera / Card / Asset Type
    const parts = [
      shootDay && `day_${slug(shootDay)}`,
      cameraLabel && slug(cameraLabel),
      cardLabel && slug(cardLabel),
      assetTypeFolder(f.relativePath, assetClass),
    ].filter(Boolean) as string[];
    return parts.join("/");
  };

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
    if (!isWorkspaceAdmin) {
      toast.error("Only workspace owners or admins can start an ingest. Ask an admin to promote you.");
      return;
    }
    if (isPremiumEligible === false) {
      toast.error("A premium storage plan is required to start uploads. Please activate a storage plan.");
      quota.checkOrPaywall();
      return;
    }
    if (!quota.checkOrPaywall()) return;

    // Server-side preflight — runs the same checks as the RLS policy but
    // returns a structured reason code so we can render a friendly message
    // instead of a raw "row-level security policy" error.
    try {
      const { data: pf, error: pfErr } = await supabase.functions.invoke(
        "ingest-preflight",
        { body: { workspace_id: activeId, project_id: projectId || null } },
      );
      const reason = (pf as any)?.reason as string | undefined;
      const message = (pf as any)?.message as string | undefined;
      if (pfErr || !pf || (pf as any).ok !== true) {
        if (reason === "PREMIUM_REQUIRED" || reason === "STORAGE_REQUIRED") {
          quota.checkOrPaywall();
        }
        toast.error(message ?? "Could not verify ingest permissions.");
        console.warn("[ingest] preflight blocked", { reason, workspace_id: activeId });
        return;
      }
    } catch (e) {
      console.warn("[ingest] preflight failed", (e as Error).message);
      toast.error("Could not verify ingest permissions. Please try again.");
      return;
    }

    // Synchronization pre-check — look for existing jobs on the same
    // Production + Card so we can (a) resume a paused job, (b) reuse the
    // destination safely, and (c) warn on duplicate filenames from a card
    // that has already been offloaded. Never overwrites — always prompts.
    try {
      const cardKey = cardLabel.trim();
      if (cardKey) {
        let priorQuery = supabase
          .from("ingest_jobs")
          .select("id,status,total_files,completed_files,source_summary,created_at")
          .eq("workspace_id", activeId)
          .in("status", ["paused", "completed", "failed"])
          .order("created_at", { ascending: false })
          .limit(10);
        if (projectId) priorQuery = priorQuery.eq("project_id", projectId);
        const { data: priorJobs } = await priorQuery;
        const sameCard = (priorJobs ?? []).filter(
          (j: any) => (j.source_summary?.card ?? "").toLowerCase() === cardKey.toLowerCase(),
        );
        const pausedMatch = sameCard.find((j: any) => j.status === "paused");
        if (pausedMatch) {
          // Structured client telemetry — reason code matches the server-side
          // taxonomy so log pipelines can grep across both surfaces.
          console.log(JSON.stringify({
            level: "warn", event: "ingest_preflight_denied",
            reason: "UPLOAD_RESUME_REQUIRED",
            workspace_id: activeId, project_id: projectId || null,
            prior_job_id: pausedMatch.id,
          }));
          const ok = window.confirm(
            `A previous ingest for card "${cardKey}" was paused mid-upload. ` +
            `Continue this new ingest anyway? Cancel to open the paused job and resume it instead.`,
          );
          if (!ok) return;
        }
        const priorCompleted = sameCard.find((j: any) => j.status === "completed");
        if (priorCompleted) {
          // Fetch item filenames+sizes so we can detect duplicates via existing
          // checksum / file metadata without creating anything new.
          const { data: priorItems } = await supabase
            .from("ingest_job_items")
            .select("file_name,size_bytes,metadata")
            .eq("job_id", priorCompleted.id)
            .limit(2000);
          const priorSet = new Map<string, number>();
          for (const it of (priorItems ?? []) as any[]) {
            priorSet.set(`${it.file_name}::${it.size_bytes}`, 1);
          }
          const dupes = scan.files.filter(
            (f) => priorSet.has(`${f.file.name}::${f.file.size}`),
          );
          if (dupes.length > 0) {
            console.log(JSON.stringify({
              level: "warn", event: "ingest_preflight_denied",
              reason: "DUPLICATE_MEDIA",
              workspace_id: activeId, project_id: projectId || null,
              prior_job_id: priorCompleted.id, duplicate_count: dupes.length,
            }));
            const ok = window.confirm(
              `${dupes.length} file${dupes.length === 1 ? "" : "s"} on this source already exist ` +
              `in a prior ingest for card "${cardKey}". Existing media will NOT be overwritten. ` +
              `Continue anyway? (Duplicates will be recorded as new items you can reconcile in Production Media.)`,
            );
            if (!ok) return;
          }
        }
      }
    } catch {
      // Pre-check is best-effort — never block the DIT if the lookup itself fails.
      // Original exception is intentionally NOT surfaced to keep internal error
      // messages out of the browser console in production builds.
      console.log(JSON.stringify({
        level: "warn", event: "ingest_precheck_error",
        workspace_id: activeId,
      }));
    }

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
          camera_label: [cameraBrand, cameraLabel, cardLabel].filter(Boolean).join(" · ") || null,
          asset_class: assetClass || null,
          notes: [unitLabel ? `Unit: ${unitLabel}` : "", notes].filter(Boolean).join("\n") || null,
          status: "ready",
          total_files: scan.files.length,
          total_bytes: scan.totalBytes,
          source_summary: {
            root_label: scan.rootLabel,
            top_level_folders: scan.topLevelFolders,
            unit: unitLabel || null,
            camera_brand: cameraBrand || null,
            camera: cameraLabel || null,
            card: cardLabel || null,
            // Camera Package inheritance — codec / resolution / LUT / color space
            // flow from Production Settings without extra typing.
            camera_package: selectedPackage
              ? {
                  id: selectedPackage.id,
                  name: selectedPackage.name,
                  camera_system: selectedPackage.camera_system ?? null,
                  camera_model: selectedPackage.camera_model ?? null,
                  recording_format: selectedPackage.recording_format ?? null,
                  codec: selectedPackage.codec ?? null,
                  resolution: selectedPackage.resolution ?? null,
                  frame_rate: selectedPackage.frame_rate ?? null,
                  color_space: selectedPackage.color_space ?? null,
                  lut: selectedPackage.lut ?? null,
                  card_prefix: selectedPackage.card_prefix ?? null,
                }
              : null,
          },
        })
        .select("id")
        .single();
      if (jobErr || !job) {
        // Map RLS violations to an actionable message instead of the raw
        // "new row violates row-level security policy" string.
        const msg = String((jobErr as any)?.message ?? "");
        if (/row-level security|row level security/i.test(msg)) {
          throw new Error(
            "You don't have permission to start an ingest. This requires workspace admin access and an active premium storage plan.",
          );
        }
        throw jobErr ?? new Error("Failed to create ingest job");
      }

      // 3. Job item rows — intelligent classification + legacy asset_class.
      //    The 14-way `detected_type` and confidence live in metadata JSONB so
      //    the existing pipeline keeps consuming asset_class unchanged.
      const classifications = scan.files.map((f) => classifyFile(f.file.name, f.relativePath));
      const lowConfidence = classifications.filter((c) => c.confidence < 0.6).length;
      if (lowConfidence > 0 && !assetClass) {
        toast.message(`${lowConfidence} file${lowConfidence === 1 ? "" : "s"} need review`, {
          description: "Auto-detection was uncertain — pick an Asset Class above to override, or continue and confirm later in Production Media.",
        });
      }
      const itemsPayload = scan.files.map((f, idx) => {
        const cls = classifications[idx];
        return {
          job_id: job.id,
          relative_path: f.relativePath,
          file_name: f.file.name,
          size_bytes: f.file.size,
          mime_guess: f.file.type || null,
          asset_class: assetClass || cls.assetClass,
          metadata: {
            detected_type: cls.detectedType,
            confidence: cls.confidence,
            reason: cls.reason,
            container: cls.container,
            codec_hint: cls.codecHint,
            device_hint: cls.deviceHint,
          },
        };
      });
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
        const subpath = buildSubpath(f);
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
          // Intelligent enrichment — probes dims/duration and (for small
          // files) computes a client checksum. Fire-and-forget; the upload
          // pump must not wait on it.
          if (itemId) {
            void (async () => {
              try {
                const enriched = await enrichFile(f.file, f.relativePath);
                await supabase.from("ingest_job_items").update({
                  status: "completed",
                  progress_percent: 100,
                  metadata: {
                    ...(itemsPayload.find((it) => (it as any).relative_path === f.relativePath)?.metadata ?? {}),
                    ...enriched,
                  },
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
      onCompleted?.({ jobId: job.id, status: finalStatus as "completed" | "failed" });
    } catch (e) {
      // Route every terminal ingest failure through mapUploadError so raw
      // internal exception text, OCI response bodies, or edge-function stack
      // traces never surface in the UI. Known-friendly errors we throw
      // ourselves (already vetted for production copy) pass through verbatim.
      const rawMsg = String((e as Error)?.message ?? "");
      const SAFE_PATTERN = /^(You don't have permission|A premium storage|This upload session|Please sign in|Storage upload failed|Network interruption|Couldn't reach the storage)/;
      const friendly = SAFE_PATTERN.test(rawMsg) ? rawMsg : mapUploadError(e);
      console.log(JSON.stringify({
        level: "error", event: "ingest_job_failed",
        workspace_id: activeId, code: rawMsg.slice(0, 60),
      }));
      toast.error(friendly);
      setLiveProgress((p) => ({ ...p, state: "error" }));
    } finally {
      setSubmitting(false);
    }
  }, [scan, activeId, user, canWriteActive, quota, mode, destinationType, layoutMode, customBasePath,
      projectId, shootDay, unitLabel, cameraBrand, cameraLabel, cardLabel, assetClass, notes, queue, onCompleted,
      isWorkspaceAdmin, isPremiumEligible]);

  const currentModeMeta = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  const contextReady =
    !!projectId && !!shootDay.trim() && !!unitLabel.trim() && !!cameraLabel.trim() && !!cardLabel.trim();

  return (
    <div className="space-y-6">
      {/* Workspace + mode header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl">Studio Ingest</h2>
          {(activeProjectDefaults?.projectName || activeProjectDefaults?.productionNumber) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {activeProjectDefaults?.projectName && (
                <span className="text-foreground truncate">{activeProjectDefaults.projectName}</span>
              )}
              {activeProjectDefaults?.productionNumber && (
                <span className="text-[10px] font-mono border rounded-full px-2 py-0.5 bg-accent/10 text-accent border-accent/30">
                  {activeProjectDefaults.productionNumber}
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Bring in footage from drives, camera cards or live folders. Files are auto-sorted into RAW, Proxy, Audio, Documents and Reports.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workspaces.length > 0 && (
            <Select value={activeId ?? ""} onValueChange={(v) => setActiveId(v)}>
              <SelectTrigger className="h-9 w-full sm:w-[220px] text-xs">
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
            Refresh
          </Button>
        </div>
      </div>

      <StorageWarningBanner />

      {/* Auto Ingest — the one-button, three-step surface. Advanced modes below remain available. */}
      <AutoIngestPanel />

      <LiveIngestStrip />



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
          <p className="text-[11px] text-muted-foreground">
            Click <strong>Rescan source</strong> to pick up new media as the shoot continues.
          </p>
        )}

        {/* Required shoot context: Project → Shoot Day → Unit → Camera → Card */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Project</Label>
            <Select value={projectId || "__none"} onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Select project</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shoot day</Label>
            <Input value={shootDay} onChange={(e) => setShootDay(e.target.value)} className="h-9 text-xs" placeholder="Day 03" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit / Team</Label>
            <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} className="h-9 text-xs" placeholder="Main Unit" />
          </div>
          {cameraPackages.length > 0 ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Camera Package</Label>
                <Select value={cameraPackageId || "__none"} onValueChange={(v) => setCameraPackageId(v === "__none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select camera" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Select camera</SelectItem>
                    {cameraPackages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.camera_system || p.camera_model ? ` — ${[p.camera_system, p.camera_model].filter(Boolean).join(" ")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Card / Mag</Label>
                <Input value={cardLabel} onChange={(e) => setCardLabel(e.target.value)} className="h-9 text-xs"
                  placeholder={selectedPackage?.card_prefix ? `${selectedPackage.card_prefix}001` : "A001"} />
              </div>
              <div className="space-y-1.5 col-span-full">
                <p className="text-[11px] text-muted-foreground">
                  {selectedPackage
                    ? <>Inherited from <strong>{selectedPackage.name}</strong>: {[selectedPackage.camera_system, selectedPackage.camera_model, selectedPackage.codec, selectedPackage.resolution, selectedPackage.color_space].filter(Boolean).join(" · ") || "no defaults set yet"}.</>
                    : <>Select a Camera Package to inherit codec, resolution, LUT and folder rules automatically.</>}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Camera brand</Label>
                <Select value={cameraBrand || "__none"} onValueChange={(v) => setCameraBrand(v === "__none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brand</SelectItem>
                    {CAMERA_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Camera</Label>
                <Input value={cameraLabel} onChange={(e) => setCameraLabel(e.target.value)} className="h-9 text-xs" placeholder="A-Cam" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Card / Mag</Label>
                <Input value={cardLabel} onChange={(e) => setCardLabel(e.target.value)} className="h-9 text-xs" placeholder="A001" />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Files auto-organize into <strong>RAW · Proxy · Audio · Documents · Reports</strong>.
          </p>
          <Select value={assetClass || "__auto"} onValueChange={(v) => setAssetClass(v === "__auto" ? "" : v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Auto-organize" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto">Auto-organize</SelectItem>
              <SelectItem value="rushes">All as RAW</SelectItem>
              <SelectItem value="proxies">All as Proxy</SelectItem>
              <SelectItem value="audio">All as Audio</SelectItem>
              <SelectItem value="reports">All as Documents / Reports</SelectItem>
              <SelectItem value="archive">All as Archive</SelectItem>
            </SelectContent>
          </Select>
        </div>


        {/* Upload layout mode — required 3-way choice. */}
        <Card className="p-3 space-y-2 border-border/40">
          <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
            Upload layout
          </Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "preserve" as const, title: "Preserve Original Folder Structure",
                desc: "Recommended. Keeps the exact source tree — required for camera cards, relinking and archive restoration." },
              { id: "metadata" as const, title: "Organize by Production Metadata",
                desc: "Auto-file into Shoot Day / Camera / Card / Asset Type." },
              { id: "custom" as const, title: "Custom Destination",
                desc: "Advanced. Prefix a custom base path, source subfolders are kept underneath." },
            ].map((opt) => {
              const isActive = layoutMode === opt.id;
              const locked = mode === "camera_card" && opt.id !== "preserve";
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setLayoutMode(opt.id)}
                  className={`text-left rounded-md border p-3 transition ${
                    isActive ? "border-accent bg-accent/10" : "border-border/40 hover:border-border"
                  } ${locked ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={locked ? "Camera Card intake must preserve the exact card layout" : undefined}
                >
                  <div className="text-xs font-medium">{opt.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              );
            })}
          </div>
          {layoutMode === "custom" && (
            <div className="flex items-center gap-2 pt-1">
              <Label className="text-xs shrink-0">Base path</Label>
              <Input value={customBasePath} onChange={(e) => setCustomBasePath(e.target.value)}
                     placeholder="e.g. dailies/day_03/cam_a" className="h-8 text-xs" />
            </div>
          )}
          {mode === "camera_card" && (
            <p className="text-[11px] text-muted-foreground">
              Camera Card intake locks to Preserve to keep card structure intact for verification.
            </p>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex gap-2">
            {mode === "watch_folder" && scan && (
              <Button variant="outline" size="sm" onClick={rescan}>
                <RefreshCw className="w-4 h-4 mr-2" /> Rescan source
              </Button>
            )}
            <Button onClick={() => openPicker(mode)} disabled={!activeId || !contextReady} variant="outline"
                    title={!contextReady ? "Select Project · Shoot Day · Unit · Camera · Card first" : undefined}>
              <FolderOpen className="w-4 h-4 mr-2" />
              {scan ? "Choose a different source" : mode === "camera_card" ? "Choose card" : "Drop or choose folder"}
            </Button>
          </div>
        </div>

        {/* Scan summary */}
        {scan && !canIngest && (
          <Card className="p-3 border-amber-500/40 bg-amber-500/5 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              {!isWorkspaceAdmin
                ? "Only workspace owners or admins can start an ingest job. Ask an admin to promote your role."
                : "A premium storage plan is required to start uploads. Activate a storage plan to continue."}
            </div>
          </Card>
        )}
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
                <Button onClick={startIngest} disabled={submitting || !canWriteActive || !contextReady || !canIngest}
                        className="bg-gradient-primary text-primary-foreground glow-primary">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cloud className="w-4 h-4 mr-2" />}
                  Start ingest
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  {layoutMode === "preserve" ? "Folder tree preserved"
                    : layoutMode === "metadata" ? "Organized by Shoot Day / Camera / Card / Asset Type"
                    : `Custom prefix: ${customBasePath || "(root)"}`}
                </p>
              </div>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for this ingest job (DIT comments, shoot context, archive intent)…"
                      className="mt-3 text-xs min-h-[64px]" />

            {/* Destination Preview — read-only, computed from the same helpers
                the upload loop uses so what you see is what will be written. */}
            <div className="mt-3">
              <IngestDestinationPreview
                files={scan.files}
                totalBytes={scan.totalBytes}
                productionName={projects.find((p) => p.id === projectId)?.name ?? null}
                shootDay={shootDay || null}
                unit={unitLabel || null}
                camera={[cameraBrand, cameraLabel].filter(Boolean).join(" ") || null}
                card={cardLabel || null}
                destinationBase={
                  destinationType === "archive_vault" ? "archive_vault/" : "working_vault/"
                }
                layoutMode={layoutMode}
                buildSubpath={buildSubpath}
              />
            </div>
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

      {/* Hard-disk Import — physical courier-in lane. Reuses the same ingest
          pipeline (Upload → Checksum → Primary Backup → OCI Sync → Proxy →
          Library → Editorial) once the drive is received. */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-border/40 bg-secondary/5">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-accent" /> Hard-disk Import
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Can't upload over the network? Courier or hand over a drive and our team ingests it into your studio vault.
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
              const isOpen = expandedJobs.has(j.id);
              const toggle = () => {
                setExpandedJobs((prev) => {
                  const next = new Set(prev);
                  if (next.has(j.id)) next.delete(j.id); else next.add(j.id);
                  return next;
                });
              };
              return (
                <li key={j.id} className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <button
                          type="button"
                          onClick={toggle}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Hide detected items" : "Show detected items"}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <FileVideo className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="font-medium truncate">{j.source_summary?.root_label ?? "(unnamed source)"}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{j.job_mode.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className="text-[10px]">{j.destination_type === "archive_vault" ? "Archive" : "Working"}</Badge>
                        {j.preserve_structure && <Badge variant="outline" className="text-[10px]">Structure kept</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {j.completed_files}/{j.total_files} files · {fmtBytes(j.transferred_bytes)} / {fmtBytes(j.total_bytes)}
                        {j.failed_files > 0 && <> · <span className="text-destructive">{j.failed_files} failed</span></>}
                        {" "}· {new Date(j.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <span className={`text-[10px] uppercase tracking-widest font-mono ${tone}`}>{j.status}</span>
                      <div className="w-24 sm:w-32">
                        <Progress value={pct} className="h-1" />
                      </div>
                    </div>
                  </div>
                  {isOpen && <IngestTimeline job={j} />}
                  {isOpen && <DetectedItemsPanel jobId={j.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Advanced diagnostics moved to Settings → Advanced. Not shown here to
          keep the Ingest Workspace focused on production work. */}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DetectedItemsPanel                                                 */
/*  Lazy-loads ingest_job_items for a job and renders the intelligent  */
/*  media-pipeline enrichment: detected type, confidence, codec/device */
/*  hints, resolution / duration, and checksum status.                 */
/* ------------------------------------------------------------------ */

type ItemRow = {
  id: string;
  file_name: string;
  relative_path: string;
  size_bytes: number;
  status: string;
  asset_class: string | null;
  mime_guess: string | null;
  metadata: Record<string, any> | null;
};

const DETECTED_LABEL: Record<string, string> = {
  raw_camera: "RAW Camera",
  audio: "Audio",
  still_image: "Still Image",
  document: "Document",
  graphic: "Graphic",
  vfx_plate: "VFX Plate",
  music: "Music",
  sfx: "SFX",
  subtitle: "Subtitle",
  dubbing: "Dubbing",
  master_file: "Master File",
  finished_film: "Finished Film",
  proxy: "Proxy",
  project_bundle: "Project Bundle",
  unknown: "Unknown",
};

function fmtDuration(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function confidenceTone(c: number): string {
  if (c >= 0.85) return "text-emerald-300 border-emerald-500/40";
  if (c >= 0.6)  return "text-amber-300 border-amber-500/40";
  return "text-destructive border-destructive/40";
}

function DetectedItemsPanel({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from("ingest_job_items")
        .select("id,file_name,relative_path,size_bytes,status,asset_class,mime_guess,metadata")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) setError(error.message);
      else setItems((data as any as ItemRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading detected items…
      </div>
    );
  }
  if (error) {
    return <p className="mt-3 text-[11px] text-destructive">Failed to load items: {error}</p>;
  }
  if (items.length === 0) {
    return <p className="mt-3 text-[11px] text-muted-foreground">No items recorded for this job.</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-border/40 bg-background/40 divide-y divide-border/30">
      {items.map((it) => {
        const md = it.metadata ?? {};
        const detected = String(md.detected_type ?? "unknown");
        const confidence = typeof md.confidence === "number" ? md.confidence : null;
        const width = md.width ?? null;
        const height = md.height ?? null;
        const duration = fmtDuration(md.duration_ms);
        const checksum = md.checksum_sha256 ?? null;
        const checksumScope = md.checksum_scope ?? null;
        const container = md.container ?? null;
        const codec = md.codec_hint ?? null;
        const device = md.device_hint ?? null;
        const reason = md.reason ?? null;

        return (
          <div key={it.id} className="p-3 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-accent shrink-0" />
                <span className="font-mono text-foreground truncate max-w-[280px]" title={it.relative_path || it.file_name}>
                  {it.relative_path || it.file_name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {DETECTED_LABEL[detected] ?? detected}
                </Badge>
                {confidence !== null && (
                  <Badge variant="outline" className={`text-[10px] ${confidenceTone(confidence)}`}>
                    {Math.round(confidence * 100)}% conf
                  </Badge>
                )}
                {it.asset_class && (
                  <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
                    class: {it.asset_class}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {(container || codec) && (
                <span>
                  <span className="text-foreground/70">Codec:</span>{" "}
                  {[container, codec && container !== codec ? codec : null].filter(Boolean).join(" · ")}
                </span>
              )}
              {device && (
                <span>
                  <span className="text-foreground/70">Device:</span> {device}
                </span>
              )}
              {(width && height) && (
                <span>
                  <span className="text-foreground/70">Resolution:</span> {width}×{height}
                </span>
              )}
              {duration && (
                <span>
                  <span className="text-foreground/70">Duration:</span> {duration}
                </span>
              )}
              <span>
                <span className="text-foreground/70">Size:</span> {fmtBytes(it.size_bytes)}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {checksum ? (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <ShieldCheck className="w-3 h-3" />
                  SHA-256 verified
                  <span className="font-mono text-muted-foreground truncate max-w-[220px]" title={checksum}>
                    {checksum.slice(0, 12)}…
                  </span>
                </span>
              ) : checksumScope === "server_pending" ? (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <ShieldAlert className="w-3 h-3" />
                  Server-side checksum in progress
                </span>
              ) : it.status === "completed" ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <ShieldAlert className="w-3 h-3" /> Checksum pending
                </span>
              ) : null}
              {reason && (
                <span className="text-muted-foreground/70 italic truncate max-w-[240px]" title={reason}>
                  — {reason}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

