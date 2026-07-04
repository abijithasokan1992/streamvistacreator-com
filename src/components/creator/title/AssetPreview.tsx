import { useEffect, useState } from "react";
import { X, Loader2, FileText, Image as ImageIcon, Film, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AssetPreview — secure, in-app preview for images, PDFs and videos.
 *
 * Reuses the existing signed PAR URL already stored on `recent_uploads.par_url`
 * (minted by the upload pipeline). Does NOT create new URLs, does NOT touch
 * storage or permissions. When no signed URL is available (older uploads or
 * the PAR has been rotated away), the modal shows a friendly fallback instead
 * of leaking object keys.
 */
export type PreviewableAsset = {
  file_name: string;
  mime_type: string | null;
  par_url: string | null;
  par_expires_at: string | null;
  category_label?: string;
};

export type PreviewKind = "image" | "pdf" | "video" | "other";

export function inferPreviewKind(mime: string | null, fileName: string): PreviewKind {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  return "other";
}

export function canPreview(mime: string | null, fileName: string): boolean {
  return inferPreviewKind(mime, fileName) !== "other";
}

export function AssetPreviewModal({
  asset, onClose,
}: {
  asset: PreviewableAsset;
  onClose: () => void;
}) {
  const kind = inferPreviewKind(asset.mime_type, asset.file_name);
  const [loading, setLoading] = useState(true);
  const url = asset.par_url;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while modal open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : FileText;
  const kindLabel = kind === "image" ? "Image" : kind === "video" ? "Video" : kind === "pdf" ? "Document" : "File";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${asset.file_name}`}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] rounded-xl border border-border/50 bg-card shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — business info only */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-secondary/10">
          <Icon className="w-4 h-4 text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{asset.file_name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
              {asset.category_label && <span>{asset.category_label}</span>}
              <span>·</span>
              <span>{kindLabel} preview</span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <ShieldCheck className="w-3 h-3" /> Secure link
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-secondary/40"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 min-h-[320px] bg-black/40 grid place-items-center overflow-auto">
          {!url ? (
            <FallbackNotice message="Preview not available yet. The secure link is still being prepared — try again in a moment." />
          ) : kind === "image" ? (
            <>
              {loading && <Loader2 className="absolute w-5 h-5 animate-spin text-accent" />}
              <img
                src={url}
                alt={asset.file_name}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                className={cn("max-h-[75vh] max-w-full object-contain", loading && "opacity-0")}
              />
            </>
          ) : kind === "video" ? (
            <video
              src={url}
              controls
              playsInline
              controlsList="nodownload"
              onLoadedData={() => setLoading(false)}
              className="max-h-[75vh] w-full bg-black"
            />
          ) : kind === "pdf" ? (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              title={asset.file_name}
              onLoad={() => setLoading(false)}
              className="w-full h-[75vh] bg-white"
            />
          ) : (
            <FallbackNotice message="This file type can't be previewed in the browser. Ask reviewers to open it directly." />
          )}
        </div>

        {/* Footer — open in new tab (uses same signed URL) */}
        {url && (
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border/40 bg-secondary/10">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border/60 px-3 py-1.5 hover:bg-secondary/30"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function FallbackNotice({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-muted-foreground max-w-md">
      {message}
    </div>
  );
}
