import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck2, AlertTriangle } from "lucide-react";
import { uploadTitleAsset, UploadValidationError } from "@/lib/creator/titleApi";
import type { AssetCategory } from "@/lib/creator/titleSchema";
import { useWorkspaces } from "@/hooks/useWorkspaces";

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

  const handleFile = useCallback(async (file: File) => {
    if (!active) {
      toast.error("Workspace not ready. Try again in a moment.");
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      await uploadTitleAsset({
        file,
        category,
        titleId,
        workspaceId: active.id,
        onProgress: (loaded, total) => setPct(total ? Math.round((loaded / total) * 100) : 0),
      });
      toast.success(`${file.name} uploaded.`);
      onUploaded?.();
    } catch (e) {
      const msg = e instanceof UploadValidationError ? e.message : e instanceof Error ? e.message : "Upload Failed";
      toast.error(msg.startsWith("Upload Failed") ? msg : `Upload Failed — ${msg}`);
    } finally {
      setBusy(false);
      setPct(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [active, category, titleId, onUploaded]);

  return (
    <div className="rounded-lg border border-dashed border-border/50 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label ?? "Upload file"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locked
            ? "This title is locked — uploads are disabled."
            : "Files go to Oracle Object Storage and are recorded in Oracle Database."}
        </p>
        {busy && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Uploading… {pct}%</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={locked || busy}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {busy ? "Uploading" : "Upload"}
      </button>
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
  return (
    <ul className="mt-3 space-y-1.5">
      {assets.map((a) => (
        <li key={a.id} className="text-xs flex items-center gap-2 border border-border/40 rounded-md px-3 py-2">
          {a.upload?.status === "error" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="truncate flex-1">{a.upload?.file_name ?? "—"}</span>
          <span className="text-muted-foreground">
            {a.upload?.file_size ? `${(a.upload.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
          </span>
          {a.is_primary && (
            <span className="text-[9px] uppercase tracking-wider text-accent">Current</span>
          )}
        </li>
      ))}
    </ul>
  );
}
