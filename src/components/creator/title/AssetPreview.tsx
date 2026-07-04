import { useEffect, useRef, useState } from "react";
import {
  X, Loader2, FileText, Image as ImageIcon, Film, Music,
  ExternalLink, ShieldCheck, PictureInPicture2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AssetPreview — secure, in-app preview for images, PDFs, video and audio.
 *
 * Reuses the existing signed PAR URL already stored on `recent_uploads.par_url`
 * (minted by the upload pipeline). Does NOT create new URLs, does NOT touch
 * storage or permissions. Streaming is progressive over the same signed URL,
 * relying on the browser's native HTTP Range support for low-latency playback.
 * When no signed URL is available (older uploads or the PAR has been rotated
 * away), the modal shows a friendly fallback instead of leaking object keys.
 */
export type PreviewableAsset = {
  file_name: string;
  mime_type: string | null;
  par_url: string | null;
  par_expires_at: string | null;
  category_label?: string;
};

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "other";

export function inferPreviewKind(mime: string | null, fileName: string): PreviewKind {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "mov", "webm", "m4v", "mxf"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg", "oga"].includes(ext)) return "audio";
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
  const [pipSupported, setPipSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = asset.par_url;

  // Detect PiP support once mounted.
  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
      (document as any).pictureInPictureEnabled === true,
    );
  }, []);

  // Global keyboard: close on Escape, and media shortcuts for video/audio.
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement).isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (isEditable(e.target)) return;

      const v = videoRef.current;
      if (!v || (kind !== "video" && kind !== "audio")) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (v.paused) v.play().catch(() => {}); else v.pause();
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "m":
          v.muted = !v.muted;
          break;
        case "f":
          if (kind === "video") {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            else v.requestFullscreen?.().catch(() => {});
          }
          break;
        case "p":
          if (kind === "video" && pipSupported) {
            const anyDoc = document as any;
            const anyV = v as any;
            if (anyDoc.pictureInPictureElement) anyDoc.exitPictureInPicture?.().catch(() => {});
            else anyV.requestPictureInPicture?.().catch(() => {});
          }
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, kind, pipSupported]);

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v || !pipSupported) return;
    try {
      const anyDoc = document as any;
      const anyV = v as any;
      if (anyDoc.pictureInPictureElement) await anyDoc.exitPictureInPicture();
      else await anyV.requestPictureInPicture?.();
    } catch { /* no-op */ }
  };

  const Icon =
    kind === "image" ? ImageIcon :
    kind === "video" ? Film :
    kind === "audio" ? Music :
    FileText;
  const kindLabel =
    kind === "image" ? "Image" :
    kind === "video" ? "Video" :
    kind === "audio" ? "Audio" :
    kind === "pdf" ? "Document" : "File";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm grid place-items-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${asset.file_name}`}
    >
      <div
        className="w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] rounded-xl border border-border/50 bg-card shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — business info first */}
        <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/40 bg-secondary/10">
          <Icon className="w-4 h-4 text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{asset.file_name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
              {asset.category_label && (<><span className="truncate">{asset.category_label}</span><span aria-hidden>·</span></>)}
              <span>{kindLabel} preview</span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <ShieldCheck className="w-3 h-3" /> Secure link
              </span>
            </div>
          </div>
          {kind === "video" && pipSupported && url && (
            <button
              type="button"
              onClick={togglePip}
              className="hidden sm:inline-flex p-1.5 rounded hover:bg-secondary/40"
              aria-label="Toggle Picture-in-Picture"
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}
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
        <div className="relative flex-1 min-h-[240px] sm:min-h-[320px] bg-black/40 grid place-items-center overflow-auto">
          {!url ? (
            <FallbackNotice message="Preview not available yet. The secure link is still being prepared — try again in a moment." />
          ) : kind === "image" ? (
            <>
              {loading && <Loader2 className="absolute w-5 h-5 animate-spin text-accent" />}
              <img
                src={url}
                alt={asset.file_name}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                className={cn("max-h-[75vh] max-w-full object-contain", loading && "opacity-0")}
              />
            </>
          ) : kind === "video" ? (
            <div className="relative w-full grid place-items-center">
              {loading && <Loader2 className="absolute w-5 h-5 animate-spin text-accent z-10" />}
              <video
                ref={videoRef}
                src={url}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onLoadedData={() => setLoading(false)}
                onError={() => setLoading(false)}
                className="max-h-[75vh] w-full bg-black"
              />
            </div>
          ) : kind === "audio" ? (
            <div className="w-full max-w-xl px-6 py-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/30 grid place-items-center">
                <Music className="w-7 h-7 text-accent" />
              </div>
              <div className="text-sm text-center text-muted-foreground truncate max-w-full">
                {asset.file_name}
              </div>
              <audio
                ref={videoRef as unknown as React.RefObject<HTMLAudioElement>}
                src={url}
                controls
                preload="metadata"
                controlsList="nodownload"
                onLoadedData={() => setLoading(false)}
                onError={() => setLoading(false)}
                className="w-full"
              />
            </div>
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

        {/* Footer */}
        {url && (
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-t border-border/40 bg-secondary/10">
            <div className="hidden sm:block text-[10px] text-muted-foreground">
              {(kind === "video" || kind === "audio")
                ? "Shortcuts: Space play · ←/→ seek · ↑/↓ volume · M mute" + (kind === "video" ? " · F fullscreen · P PiP" : "")
                : "Secure preview — link expires automatically."}
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-xs rounded-md border border-border/60 px-3 py-1.5 hover:bg-secondary/30"
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
