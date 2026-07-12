import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, Loader2, FileCheck2, AlertTriangle, CheckCircle2, ShieldCheck, FileWarning, HardDrive, Copy, RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { uploadTitleAsset, UploadValidationError } from "@/lib/creator/titleApi";
import type { AssetCategory } from "@/lib/creator/titleSchema";
import { mapUploadError, type UploadTelemetry } from "@/lib/ociMultipartUpload";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceStorage } from "@/hooks/useWorkspaceStorage";
import { supabase } from "@/integrations/supabase/client";
import { AssetPreviewModal, canPreview } from "./AssetPreview";

// ---------- Allowed-format & size matrix (client-side preflight) ----------
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const ACCEPT_MAP: Record<string, { exts: string[]; mimes: string[]; maxBytes: number; label: string }> = {
  trailer:             { exts: ["mp4","mov"],                   mimes: ["video/mp4","video/quicktime"],                            maxBytes: 5 * GB,   label: "Trailer" },
  feature_film:        { exts: ["mp4","mov","mxf","mov"],       mimes: ["video/mp4","video/quicktime","application/mxf","video/x-prores"], maxBytes: 50 * GB,  label: "Main Film" },
  poster:              { exts: ["png","jpg","jpeg","webp"],     mimes: ["image/png","image/jpeg","image/webp"],                    maxBytes: 500 * MB, label: "Poster" },
  censor_certificate:  { exts: ["pdf"],                         mimes: ["application/pdf"],                                        maxBytes: 10 * MB,  label: "Censor Certificate" },
  ownership_documents: { exts: ["pdf"],                         mimes: ["application/pdf"],                                        maxBytes: 20 * MB,  label: "Ownership Documents" },
};
const FORBIDDEN_EXTS = new Set(["exe","bat","dll","sh","cmd","js","msi","jar","vbs"]);

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}
function humanSpeed(bps: number): string {
  if (!bps || bps <= 0) return "—";
  if (bps >= MB) return `${(bps / MB).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}
function humanEta(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

type PreflightResult =
  | { ok: true; format: string; size: number; maxBytes: number; categoryLabel: string }
  | { ok: false; reason: string };

function preflight(file: File, category: AssetCategory): PreflightResult {
  const ext = fileExt(file.name);
  if (FORBIDDEN_EXTS.has(ext)) {
    return { ok: false, reason: `File type .${ext} is not permitted.` };
  }
  const cfg = ACCEPT_MAP[category as keyof typeof ACCEPT_MAP];
  if (!cfg) {
    return { ok: true, format: ext.toUpperCase() || "FILE", size: file.size, maxBytes: file.size, categoryLabel: category };
  }
  if (file.size <= 0) return { ok: false, reason: "File is empty." };
  if (!cfg.exts.includes(ext) && !(file.type && cfg.mimes.includes(file.type))) {
    return { ok: false, reason: `Allowed formats: ${cfg.exts.join(", ").toUpperCase()}.` };
  }
  if (file.size > cfg.maxBytes) {
    return { ok: false, reason: `Your file is ${humanBytes(file.size)}. Maximum allowed: ${humanBytes(cfg.maxBytes)}.` };
  }
  return { ok: true, format: ext.toUpperCase(), size: file.size, maxBytes: cfg.maxBytes, categoryLabel: cfg.label };
}

const STAGE_LABEL: Record<UploadTelemetry["stage"], string> = {
  initializing: "Initializing Upload",
  signing:      "Generating Secure OCI Session",
  uploading:    "Uploading Parts",
  verifying:    "Verifying Uploaded Parts",
  completing:   "Completing Upload",
  registering:  "Registering Asset",
  metadata:     "Updating Metadata",
  complete:     "Upload Complete",
};

export function AssetUploader({
  titleId, category, locked, onUploaded, accept, label,
  singleSlot = false, existingActiveCount = 0,
}: {
  titleId: string;
  category: AssetCategory;
  locked: boolean;
  onUploaded?: () => void;
  accept?: string;
  label?: string;
  /**
   * Enforce a single active version for slotted categories (Primary Poster,
   * Trailer, Main Master). Uploading a new file creates a version and demotes
   * the current active one. Non-slotted categories allow multiple actives.
   */
  singleSlot?: boolean;
  /** Count of currently-active (is_primary) assets for this category on this title. */
  existingActiveCount?: number;
}) {
  const { active } = useWorkspaces();
  const storage = useWorkspaceStorage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [telemetry, setTelemetry] = useState<UploadTelemetry | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [success, setSuccess] = useState<{ name: string; size: number; format: string } | null>(null);

  /**
   * Duplicate detection state — SHA-256 is the authoritative identity.
   *   - "clean"                  → hash confirmed unique in workspace
   *   - "preliminary"            → name+size matches something in workspace; hashing in progress (warning only)
   *   - "checking"               → hash computing / query in flight
   *   - "block-same-title"       → SHA-256 match on this title → BLOCK
   *   - "warn-same-workspace"    → SHA-256 match elsewhere in this workspace → offer "Use Existing" / replace
   *   - "hash-skipped"           → file too large to hash in-browser (>1.5GB); fall back to name+size heuristic
   *
   * Cross-workspace duplicates are NEVER surfaced to creators.
   */
  type DupState =
    | { kind: "clean" }
    | { kind: "checking" }
    | { kind: "preliminary" }
    | { kind: "hash-skipped" }
    | { kind: "block-same-title"; name: string }
    | { kind: "warn-same-workspace"; name: string; existingUploadId?: string };
  const [dup, setDup] = useState<DupState>({ kind: "clean" });

  const stagedPreflight = useMemo(
    () => (stagedFile ? preflight(stagedFile, category) : null),
    [stagedFile, category],
  );

  const cancelStaged = useCallback(() => {
    setStagedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const runUpload = useCallback(async (file: File) => {
    if (!active) {
      toast.error("Workspace not ready. Try again in a moment.");
      return;
    }
    setBusy(true);
    setPct(0);
    setTelemetry({ stage: "initializing", loaded: 0, total: file.size, partsDone: 0, totalParts: 1, speedBps: 0, etaSeconds: null });
    try {
      await uploadTitleAsset({
        file,
        category,
        titleId,
        workspaceId: active.id,
        onProgress: (loaded, total) => setPct(total ? Math.round((loaded / total) * 100) : 0),
        onTelemetry: (t) => setTelemetry(t),
      });
      setSuccess({ name: file.name, size: file.size, format: fileExt(file.name).toUpperCase() });
      toast.success(`${file.name} uploaded.`);
      setStagedFile(null);
      onUploaded?.();
    } catch (e) {
      const safe = e instanceof UploadValidationError ? e.message : mapUploadError(e);
      toast.error(safe);
    } finally {
      setBusy(false);
      setPct(0);
      setTelemetry(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [active, category, titleId, onUploaded]);

  // Quota preflight — computed synchronously from the shared storage hook.
  const quotaTotalBytes = Math.max(0, Math.round((storage.totalGb ?? 0) * GB));
  const quotaUsedBytes = Math.max(0, Math.round(storage.usedBytes ?? 0));
  const quotaRemainingBytes = Math.max(0, quotaTotalBytes - quotaUsedBytes);
  const wouldExceedQuota = useCallback(
    (size: number) => quotaTotalBytes > 0 && (quotaUsedBytes + size) > quotaTotalBytes,
    [quotaTotalBytes, quotaUsedBytes],
  );

  // Per founder policy: never hash the entire file in the browser. Preflight
  // is a lightweight name+size heuristic only. Authoritative SHA-256
  // reconciliation happens server-side (OCI pipeline persists file_sha256 on
  // upload_sessions), and duplicate objects are collapsed post-finalize.
  const sha256Hex = useCallback(async (_file: File): Promise<string | null> => null, []);
  const devLog = useCallback((...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug("[uploader]", ...args);
  }, []);

  // Preliminary check (name+size) — returns a warning only, hashing overrides.
  const preliminaryMatch = useCallback(async (file: File): Promise<boolean> => {
    if (!active) return false;
    try {
      const { data } = await (supabase as any)
        .from("recent_uploads")
        .select("id")
        .eq("workspace_id", active.id)
        .eq("file_name", file.name)
        .eq("file_size", file.size)
        .in("status", ["success", "completed", "ready"])
        .limit(1);
      return !!(data && data.length);
    } catch { return false; }
  }, [active]);

  // Authoritative SHA-256 dedup. Queries upload_sessions by workspace+hash,
  // resolves matching recent_uploads rows via oci_upload_id, then determines
  // same-title vs same-workspace by inspecting title_assets. Cross-workspace
  // duplicates are never returned by the query (workspace_id is scoped).
  const runShaDedup = useCallback(async (file: File, shaHex: string | null): Promise<DupState> => {
    if (!active) return { kind: "clean" };
    if (!shaHex) {
      // Fallback for >1.5GB — name+size heuristic scoped to this title only.
      try {
        const { data } = await (supabase as any)
          .from("recent_uploads")
          .select("id, oci_upload_id")
          .eq("workspace_id", active.id)
          .eq("file_name", file.name)
          .eq("file_size", file.size)
          .in("status", ["success", "completed", "ready"])
          .limit(20);
        const ids = (data ?? []).map((r: any) => r.id);
        if (ids.length === 0) return { kind: "hash-skipped" };
        const { data: ta } = await (supabase as any)
          .from("title_assets")
          .select("upload_id, title_id")
          .in("upload_id", ids)
          .eq("title_id", titleId)
          .limit(1);
        if (ta && ta.length) return { kind: "block-same-title", name: file.name };
        return { kind: "warn-same-workspace", name: file.name };
      } catch { return { kind: "hash-skipped" }; }
    }
    try {
      const { data: sessions } = await (supabase as any)
        .from("upload_sessions")
        .select("id, oci_upload_id")
        .eq("workspace_id", active.id)
        .eq("file_sha256", shaHex)
        .in("status", ["completed", "success"])
        .limit(50);
      const ociIds = (sessions ?? []).map((s: any) => s.oci_upload_id).filter(Boolean);
      if (ociIds.length === 0) return { kind: "clean" };
      const { data: uploads } = await (supabase as any)
        .from("recent_uploads")
        .select("id")
        .eq("workspace_id", active.id)
        .in("oci_upload_id", ociIds)
        .limit(50);
      const uploadIds = (uploads ?? []).map((u: any) => u.id);
      if (uploadIds.length === 0) return { kind: "clean" };
      const { data: ta } = await (supabase as any)
        .from("title_assets")
        .select("upload_id, title_id")
        .in("upload_id", uploadIds)
        .limit(50);
      const onThisTitle = (ta ?? []).find((r: any) => r.title_id === titleId);
      if (onThisTitle) return { kind: "block-same-title", name: file.name };
      const otherInWorkspace = (ta ?? []).find((r: any) => r.title_id && r.title_id !== titleId);
      if (otherInWorkspace) {
        return { kind: "warn-same-workspace", name: file.name, existingUploadId: otherInWorkspace.upload_id };
      }
      // Match exists in workspace but not attached to any title — treat as workspace-level warn.
      return { kind: "warn-same-workspace", name: file.name };
    } catch { return { kind: "clean" }; }
  }, [active, titleId]);

  const handlePicked = useCallback(async (f: File) => {
    setSuccess(null);
    setDup({ kind: "clean" });
    devLog("picked", { name: f.name, size: f.size, category });
    const pre = preflight(f, category);
    if (!pre.ok) {
      setStagedFile(f);
      devLog("preflight-fail", pre);
      toast.error((pre as { ok: false; reason: string }).reason);
      return;
    }
    if (locked) {
      toast.error("This title is locked — uploads are disabled.");
      return;
    }
    if (wouldExceedQuota(f.size)) {
      setStagedFile(f);
      devLog("quota-block", { size: f.size, remaining: quotaRemainingBytes });
      toast.error("Not enough storage on your current plan.");
      return;
    }
    setStagedFile(f);
    setDup({ kind: "checking" });

    // Lightweight preflight only (name+size). Authoritative checksum
    // reconciliation happens server-side after upload finalizes.
    const prelimP = preliminaryMatch(f);
    const shaP = sha256Hex(f); // always resolves null under founder policy
    prelimP.then((hit) => {
      setDup((cur) => (cur.kind === "checking" && hit ? { kind: "preliminary" } : cur));
    });
    const shaHex = await shaP;
    const d = await runShaDedup(f, shaHex);
    devLog("dedup", d.kind);
    setDup(d);
    if (d.kind === "block-same-title") return; // require replace/version action
    if (d.kind === "warn-same-workspace") return; // require explicit user action
    if (d.kind === "hash-skipped") return;         // require user confirm
    void runUpload(f);
  }, [category, locked, runUpload, wouldExceedQuota, preliminaryMatch, runShaDedup, sha256Hex, devLog, quotaRemainingBytes]);

  const startUpload = useCallback(() => {
    if (!stagedFile) return;
    if (dup.kind === "block-same-title") return;
    if (wouldExceedQuota(stagedFile.size)) {
      toast.error("Not enough storage on your current plan.");
      return;
    }
    void runUpload(stagedFile);
  }, [stagedFile, runUpload, dup, wouldExceedQuota]);

  // Drag-and-drop (works on desktop; touch devices fall back to the Choose-file button).
  const [drag, setDrag] = useState(false);
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (locked || busy) return;
    e.preventDefault();
    setDrag(true);
  }, [locked, busy]);
  const onDragLeave = useCallback(() => setDrag(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (locked || busy) return;
    const f = e.dataTransfer.files?.[0];
    if (f) handlePicked(f);
  }, [locked, busy, handlePicked]);

  // Warn the user before they navigate away or close the tab during an active upload.
  // Without this, abandoned uploads leak as "uploading" rows + OCI multipart parts
  // until the reclaim sweeper runs.
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "An upload is still in progress. Leaving now will interrupt it.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  const cfg = ACCEPT_MAP[category as keyof typeof ACCEPT_MAP];
  const acceptAttr = accept ?? (cfg ? cfg.exts.map((e) => `.${e}`).join(",") : undefined);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-lg border border-dashed p-4 space-y-3 transition ${drag ? "border-accent bg-accent/5" : "border-border/50"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label ?? "Upload file"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locked
              ? "This title is locked — uploads are disabled."
              : cfg
                ? `Allowed: ${cfg.exts.join(", ").toUpperCase()} · Max ${humanBytes(cfg.maxBytes)}`
                : "Files go to Oracle Object Storage and are recorded in Oracle Database."}
          </p>
          {singleSlot && existingActiveCount > 0 && !locked && (
            <p className="text-[11px] text-amber-300 mt-1 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              This slot only holds one active version — uploading will supersede the current file.
            </p>
          )}
          {!locked && quotaTotalBytes > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              Storage: {humanBytes(quotaUsedBytes)} used · {humanBytes(quotaRemainingBytes)} free of {humanBytes(quotaTotalBytes)}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePicked(f);
          }}
        />
        {!busy && !stagedFile && (
          <button
            type="button"
            disabled={locked}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" /> Choose file
          </button>
        )}
      </div>

      {/* Preflight card */}
      {stagedFile && !busy && stagedPreflight && (
        <div className="rounded-md border border-border/60 bg-card/50 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            {stagedPreflight.ok ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <FileWarning className="w-4 h-4 text-rose-400" />
            )}
            <span className="font-medium">
              {stagedPreflight.ok ? "Ready to Upload" : "Upload Not Allowed"}
            </span>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-0.5 text-muted-foreground">
            <dt>Category</dt>     <dd className="text-foreground">{cfg?.label ?? category}</dd>
            <dt>Filename</dt>     <dd className="text-foreground truncate">{stagedFile.name}</dd>
            <dt>Format</dt>       <dd className="text-foreground">{fileExt(stagedFile.name).toUpperCase() || "—"}</dd>
            <dt>Size</dt>         <dd className="text-foreground">{humanBytes(stagedFile.size)}</dd>
            {cfg && <><dt>Maximum</dt><dd className="text-foreground">{humanBytes(cfg.maxBytes)}</dd></>}
          </dl>
          {!stagedPreflight.ok && (
            <p className="text-rose-400">{(stagedPreflight as { ok: false; reason: string }).reason}</p>
          )}
          {stagedPreflight.ok && wouldExceedQuota(stagedFile.size) && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-rose-200 space-y-1">
              <p className="font-medium inline-flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Not enough storage on your current plan</p>
              <p>
                This file needs {humanBytes(stagedFile.size)} but only {humanBytes(quotaRemainingBytes)} of {humanBytes(quotaTotalBytes)} is free.
              </p>
              <Link to="/dashboard?tab=storage" className="underline text-rose-100 hover:text-white">Upgrade or add storage →</Link>
            </div>
          )}
          {stagedPreflight.ok && !wouldExceedQuota(stagedFile.size) && dup.kind === "checking" && (
            <p className="text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Running preflight fingerprint (name + size)…</p>
          )}
          {dup.kind === "preliminary" && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-amber-200/90 space-y-1">
              <p className="font-medium inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Preflight match</p>
              <p>A file with the same name and size exists in your workspace. Server will reconcile the exact checksum after upload and collapse duplicates.</p>
            </div>
          )}
          {dup.kind === "hash-skipped" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-amber-200 space-y-1">
              <p className="font-medium inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Possible duplicate</p>
              <p>A file with the same name and size exists elsewhere in your workspace. Upload anyway if this is a new revision — exact-checksum reconciliation happens server-side.</p>
            </div>
          )}
          {dup.kind === "block-same-title" && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-rose-200 space-y-1">
              <p className="font-medium inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Duplicate on this title</p>
              <p>A file with the same name and size is already uploaded to this title. Replace the existing version or choose a different file. Server-side checksum will confirm identity.</p>
            </div>
          )}
          {dup.kind === "warn-same-workspace" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-amber-200 space-y-1">
              <p className="font-medium inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Possible duplicate in your workspace</p>
              <p>A matching file exists in your workspace. You can reuse the existing asset or upload this copy as a new version on this title — server will reconcile exact checksum after upload.</p>
            </div>
          )}
          {singleSlot && stagedPreflight.ok && existingActiveCount > 0 && (
            <p className="text-amber-300 inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> The current active version will be superseded when this upload completes.</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={startUpload}
              disabled={!stagedPreflight.ok || locked || wouldExceedQuota(stagedFile.size) || dup.kind === "block-same-title" || dup.kind === "checking" || dup.kind === "preliminary"}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" /> {dup.kind === "warn-same-workspace" || dup.kind === "hash-skipped" ? "Upload as new version" : "Start upload"}
            </button>
            <button
              type="button"
              onClick={cancelStaged}
              className="rounded-md border border-border/60 px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Choose another file
            </button>
          </div>
        </div>
      )}

      {/* Cinematic progress card */}
      {busy && telemetry && (
        <div
          className="rounded-md border border-border/60 bg-card/50 p-3 space-y-2 text-xs"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              {STAGE_LABEL[telemetry.stage]}
            </span>
            <span className="tabular-nums text-foreground">{pct}%</span>
          </div>
          <div
            className="h-1.5 rounded-full bg-border/40 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${STAGE_LABEL[telemetry.stage]}: ${pct} percent complete`}
          >
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-y-0.5 text-muted-foreground">
            <dt>Uploaded</dt>
            <dd className="text-right text-foreground tabular-nums">
              {humanBytes(telemetry.loaded)} / {humanBytes(telemetry.total)}
            </dd>
            <dt>Speed</dt>
            <dd className="text-right text-foreground tabular-nums">{humanSpeed(telemetry.speedBps)}</dd>
            <dt>Time remaining</dt>
            <dd className="text-right text-foreground tabular-nums">{humanEta(telemetry.etaSeconds)}</dd>
            <dt>Parts uploaded</dt>
            <dd className="text-right text-foreground tabular-nums">
              {telemetry.partsDone} / {telemetry.totalParts}
            </dd>
          </dl>
        </div>
      )}


      {/* Success card */}
      {success && !busy && (
        <div
          className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 font-medium text-emerald-300">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Upload Complete
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-0.5 text-muted-foreground">
            <dt>Filename</dt> <dd className="text-foreground truncate">{success.name}</dd>
            <dt>Size</dt>     <dd className="text-foreground">{humanBytes(success.size)}</dd>
          </dl>
          <p className="text-emerald-300 pt-1">Ready for submission.</p>
        </div>
      )}

    </div>
  );
}

export function AssetList({
  assets, emptyHint,
}: { assets: { id: string; upload: any; is_primary: boolean; category?: string }[]; emptyHint?: string }) {
  const [previewing, setPreviewing] = useState<{
    file_name: string; mime_type: string | null; par_url: string | null;
    par_expires_at: string | null; category_label?: string; upload_id?: string | null;
  } | null>(null);


  if (!assets.length) {
    return (
      <p className="text-xs text-muted-foreground mt-3">
        {emptyHint ?? "No files uploaded yet."}
      </p>
    );
  }
  const fmt = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch { return "—"; }
  };
  return (
    <>
      <ul className="mt-3 space-y-1.5">
        {assets.map((a) => {
          const u = a.upload ?? {};
          const ok = u.status !== "error" && u.status !== "failed";
          const previewable = canPreview(u.mime_type ?? null, u.file_name ?? "");
          return (
            <li
              key={a.id}
              className="text-xs border border-border/40 rounded-md px-3 py-2 grid grid-cols-[16px_1fr_auto] gap-2 items-center"
            >
              {ok ? (
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <div className="min-w-0">
                <div className="truncate flex items-center gap-2">
                  <span className="truncate font-medium">{u.file_name ?? "—"}</span>
                  {a.is_primary && (
                    <span className="text-[9px] uppercase tracking-wider text-accent">Current</span>
                  )}
                  {!ok && (
                    <span className="text-[9px] uppercase tracking-wider text-rose-400">Retry needed</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                  <span>Uploaded {fmt(u.created_at ?? u.updated_at)}</span>
                  <span>{u.file_size ? humanBytes(Number(u.file_size)) : "—"}</span>
                </div>
              </div>
              {ok && previewable && u.id && (
                <button
                  type="button"
                  onClick={() => setPreviewing({
                    file_name: u.file_name ?? "File",
                    mime_type: u.mime_type ?? null,
                    par_url: u.par_url ?? null,
                    par_expires_at: u.par_expires_at ?? null,
                    category_label: a.category,
                    upload_id: u.id ?? null,
                  })}
                  className="text-[11px] rounded-md border border-border/60 px-2 py-1 hover:bg-secondary/30"
                >
                  Preview
                </button>
              )}

            </li>
          );
        })}
      </ul>
      {previewing && (
        <AssetPreviewModal asset={previewing} onClose={() => setPreviewing(null)} />
      )}
    </>
  );
}
