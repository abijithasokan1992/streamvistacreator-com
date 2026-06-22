import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, Loader2, FileCheck2, AlertTriangle, CheckCircle2, ShieldCheck, FileWarning,
} from "lucide-react";
import { uploadTitleAsset, UploadValidationError } from "@/lib/creator/titleApi";
import type { AssetCategory } from "@/lib/creator/titleSchema";
import { mapUploadError, type UploadTelemetry } from "@/lib/ociMultipartUpload";
import { useWorkspaces } from "@/hooks/useWorkspaces";

// ---------- Allowed-format & size matrix (client-side preflight) ----------
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const ACCEPT_MAP: Record<string, { exts: string[]; mimes: string[]; maxBytes: number; label: string }> = {
  trailer:             { exts: ["mp4","mov"],                   mimes: ["video/mp4","video/quicktime"],                            maxBytes: 5 * GB,   label: "Trailer" },
  feature_film:        { exts: ["mp4","mov","mxf","mov"],       mimes: ["video/mp4","video/quicktime","application/mxf","video/x-prores"], maxBytes: 50 * GB,  label: "Feature Film" },
  poster:              { exts: ["png","jpg","jpeg","webp"],     mimes: ["image/png","image/jpeg","image/webp"],                    maxBytes: 500 * MB, label: "Poster" },
  censor_certificate:  { exts: ["pdf"],                         mimes: ["application/pdf"],                                        maxBytes: 200 * MB, label: "Censor Certificate" },
  ownership_documents: { exts: ["pdf"],                         mimes: ["application/pdf"],                                        maxBytes: 500 * MB, label: "Ownership Documents" },
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
}: {
  titleId: string;
  category: AssetCategory;
  locked: boolean;
  onUploaded?: () => void;
  accept?: string;
  label?: string;
}) {
  const { active } = useWorkspaces();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [telemetry, setTelemetry] = useState<UploadTelemetry | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [success, setSuccess] = useState<{ name: string; size: number; format: string } | null>(null);

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

  const handlePicked = useCallback((f: File) => {
    setSuccess(null);
    const pre = preflight(f, category);
    if (!pre.ok) {
      // Stage the file so the user sees the precise reason; don't auto-start a bad upload.
      setStagedFile(f);
      toast.error((pre as { ok: false; reason: string }).reason);
      return;
    }
    if (locked) {
      toast.error("This title is locked — uploads are disabled.");
      return;
    }
    // Valid file picked or dropped → start the upload immediately (no extra click).
    setStagedFile(f);
    void runUpload(f);
  }, [category, locked, runUpload]);

  const startUpload = useCallback(() => {
    if (stagedFile) void runUpload(stagedFile);
  }, [stagedFile, runUpload]);

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
    <div className="rounded-lg border border-dashed border-border/50 p-4 space-y-3">
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
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={startUpload}
              disabled={!stagedPreflight.ok || locked}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" /> Start upload
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
        <div className="rounded-md border border-border/60 bg-card/50 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {STAGE_LABEL[telemetry.stage]}
            </span>
            <span className="tabular-nums text-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
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
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-medium text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> Upload Complete
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-0.5 text-muted-foreground">
            <dt>Filename</dt>            <dd className="text-foreground truncate">{success.name}</dd>
            <dt>Format</dt>              <dd className="text-foreground">{success.format}</dd>
            <dt>Size</dt>                <dd className="text-foreground">{humanBytes(success.size)}</dd>
            <dt>OCI Verification</dt>    <dd className="text-emerald-300">Passed</dd>
            <dt>Asset Registration</dt>  <dd className="text-emerald-300">Passed</dd>
            <dt>Metadata Registration</dt><dd className="text-emerald-300">Passed</dd>
          </dl>
          <p className="text-emerald-300 pt-1">Ready for submission.</p>
        </div>
      )}
    </div>
  );
}

export function AssetList({
  assets, emptyHint,
}: { assets: { id: string; upload: any; is_primary: boolean }[]; emptyHint?: string }) {
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
    <ul className="mt-3 space-y-1.5">
      {assets.map((a) => {
        const u = a.upload ?? {};
        const ok = u.status !== "error" && u.status !== "failed";
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
                <span className="truncate">{u.file_name ?? "—"}</span>
                {a.is_primary && (
                  <span className="text-[9px] uppercase tracking-wider text-accent">Current</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                <span>{(fileExt(u.file_name ?? "") || "FILE").toUpperCase()}</span>
                <span>{u.file_size ? humanBytes(Number(u.file_size)) : "—"}</span>
                <span>Uploaded {fmt(u.created_at ?? u.updated_at)}</span>
                <span className={ok ? "text-emerald-400" : "text-rose-400"}>
                  Verification: {ok ? "Verified" : "Failed"}
                </span>
                <span className={ok ? "text-emerald-400" : "text-rose-400"}>
                  OCI: {ok ? "Stored Successfully" : "Pending"}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
