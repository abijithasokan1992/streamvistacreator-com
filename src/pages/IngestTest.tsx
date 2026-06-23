import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CloudUpload, FileIcon, Loader2, XCircle } from "lucide-react";
import { useSystemMessage } from "@/components/system/SystemMessageProvider";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import {
  uploadFileMultipart,
  MULTIPART_THRESHOLD,
  ResumableUploadInterrupted,
} from "@/lib/ociMultipartUpload";

const PAR_BASE =
  "https://objectstorage.ap-mumbai-1.oraclecloud.com/p/JeKB364pUi17Y_pIPaqVDc_M6XMrsCdj0xUXOHkWJT-2sOgzisRkuAB1KzAtfmym/n/bma8wibnommg/b/bucket-20260526-1544/o/";

/** Map the manual's 4 category IDs onto the canonical 03-RAW-INGEST category tag. */
const INGEST_CATEGORY_LABEL: Record<string, string> = {
  hardware: "Dedicated Hardware",
  mobile: "Mobile Ingest",
  ndi: "NDI / IP Workflow",
  virtual: "Virtual / Software Encoders",
};

function ingestCategoryTag(catId: string | null): string {
  const id = (catId && INGEST_CATEGORY_LABEL[catId]) ? catId : "hardware";
  return `c2c-${id}-raw-ingest`;
}

async function sha256Hex(file: File): Promise<string | null> {
  // Skip very large files to keep the test snappy; the multipart engine still
  // hashes them internally for cross-device resume.
  if (file.size > 256 * 1024 * 1024) return null;
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

async function reportIngest(payload: Record<string, unknown>) {
  // Fire-and-forget; the c2c-ingest-webhook writes to payment_debug_logs.
  try {
    await supabase.functions.invoke("c2c-ingest-webhook", { body: payload });
  } catch (e) {
    // Telemetry must never block a user-visible upload.
    console.warn("c2c telemetry failed", e);
  }
}


type Status = "idle" | "uploading" | "success" | "error";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
  xhr?: XMLHttpRequest;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function sanitize(name: string): string {
  // Keep filename simple & PAR-safe; spaces -> underscores
  return name.replace(/[^\w.\-]+/g, "_");
}

export default function IngestTest() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showMessage } = useSystemMessage();
  const { active } = useWorkspaces();
  const [search] = useSearchParams();

  // Category passed in via the manual's per-card "Test this path" link.
  const ingestPath = (search.get("category") || "hardware").toLowerCase();
  const workspaceIdFromUrl = search.get("workspace");
  const workspaceId = workspaceIdFromUrl || active?.id || null;
  const productionBanner = (active as any)?.production_banner ?? null;
  const categoryTag = useMemo(() => ingestCategoryTag(ingestPath), [ingestPath]);

  // Direct-PAR path for small files (≤ 5MB). Larger files go through the
  // chunked + SHA-256 multipart engine so they're ledgered in
  // upload_sessions + ingest_telemetry.
  const uploadSmallPAR = useCallback((item: UploadItem) => {
    const url = `${PAR_BASE}${encodeURIComponent(sanitize(item.file.name))}`;
    const xhr = new XMLHttpRequest();
    const t0 = performance.now();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, progress: pct } : it)),
      );
    };

    xhr.onload = async () => {
      const dur = Math.round(performance.now() - t0);
      if (xhr.status >= 200 && xhr.status < 300) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "success", progress: 100 } : it,
          ),
        );
        toast.success("Upload complete", {
          description: `${item.file.name} delivered to Crayons Bridge`,
        });
        const sha = await sha256Hex(item.file);
        void reportIngest({
          file_name: item.file.name,
          size_bytes: item.file.size,
          sha256: sha,
          etag: xhr.getResponseHeader("ETag"),
          duration_ms: dur,
          workspace_id: workspaceId,
          production_banner: productionBanner,
          category: categoryTag,
          ingest_path: ingestPath,
          par_status: xhr.status,
          transport: "par",
        });
      } else {
        const msg = `C CLOUD returned ${xhr.status}`;
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", error: msg } : it,
          ),
        );
        showMessage({
          severity: "error",
          title: "C CLOUD PAR rejected the upload",
          message:
            `"${item.file.name}" was streamed straight to C CLOUD Object Storage via the Pre-Authenticated Request (PAR), but C CLOUD answered with HTTP ${xhr.status}.\n\n` +
            (xhr.status === 401 || xhr.status === 403
              ? "The PAR is likely expired or revoked. Generate a fresh PAR in Admin → Oracle Storage and try again."
              : xhr.status === 404
              ? "The PAR path no longer points to a valid bucket/prefix. Check Admin → Oracle Storage."
              : xhr.status >= 500
              ? "Oracle Object Storage reported a server-side issue. Retry in a few minutes."
              : "Inspect the PAR validity and bucket CORS rules.") +
            "\n\nReport this to admin if it keeps happening.",
          context: `file=${item.file.name}; size=${item.file.size}; status=${xhr.status}`,
        });
        void reportIngest({
          file_name: item.file.name,
          size_bytes: item.file.size,
          duration_ms: dur,
          workspace_id: workspaceId,
          production_banner: productionBanner,
          category: categoryTag,
          ingest_path: ingestPath,
          par_status: xhr.status,
          transport: "par",
        });
      }
    };

    xhr.onerror = () => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "error", error: "Network error / CORS blocked" }
            : it,
        ),
      );
      showMessage({
        severity: "error",
        title: "Couldn't reach C CLOUD Object Storage",
        message:
          `The browser couldn't connect to C CLOUD's PAR endpoint for "${item.file.name}".\n\n` +
          `This usually means:\n` +
          `  • The PAR expired (regenerate it in Admin → Oracle Storage)\n` +
          `  • The bucket's CORS policy doesn't allow this origin\n` +
          `  • Your network is offline or blocking objectstorage.*.oraclecloud.com\n\n` +
          `Report this if C CLOUD Storage is verified green in the admin panel.`,
        context: `file=${item.file.name}; size=${item.file.size}; origin=${window.location.origin}`,
      });
    };

    xhr.onabort = () => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "error", error: "Cancelled" } : it,
        ),
      );
    };

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, xhr, status: "uploading" } : it)),
    );
    xhr.send(item.file);
  }, [showMessage, workspaceId, productionBanner, categoryTag, ingestPath]);

  // Large file path → chunked multipart engine with SHA-256 + cross-device resume.
  const uploadLargeMultipart = useCallback(async (item: UploadItem) => {
    if (!workspaceId) {
      // Without a workspace the multipart Edge Function can't ledger the
      // session. Fall back to direct PAR so the test still proves the path.
      uploadSmallPAR(item);
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)),
    );
    const t0 = performance.now();
    try {
      const result = await uploadFileMultipart({
        file: item.file,
        workspaceId,
        pendingId: `c2c-${ingestPath}-${item.id}`,
        category: categoryTag,
        onProgress: (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, progress: pct } : it)),
          );
        },
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "success", progress: 100 } : it,
        ),
      );
      toast.success("Chunked ingest complete", {
        description: `${item.file.name} · SHA-256 verified${result.resumed ? " · resumed from previous device" : ""}`,
      });
      void reportIngest({
        file_name: item.file.name,
        size_bytes: item.file.size,
        sha256: (result.upload as any)?.file_sha256 ?? null,
        etag: (result.upload as any)?.oci_upload_id ?? null,
        duration_ms: Math.round(performance.now() - t0),
        workspace_id: workspaceId,
        production_banner: productionBanner,
        category: categoryTag,
        ingest_path: ingestPath,
        par_status: "multipart",
        transport: "multipart",
      });
    } catch (e) {
      const resumable = e instanceof ResumableUploadInterrupted;
      const msg = e instanceof ResumableUploadInterrupted
        ? `Paused at part ${e.partNumber}/${e.totalChunks} — re-drop to resume`
        : (e instanceof Error ? e.message : "Chunked ingest failed");
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "error", error: msg } : it,
        ),
      );
      if (resumable) {
        toast.message("Upload paused — safely resumable", {
          description: "Progress is checkpointed. Re-drop the same file (from any device) to resume.",
        });
      } else {
        showMessage({
          severity: "error",
          title: "Chunked ingest failed",
          message: `Multipart upload couldn't finish for "${item.file.name}". ${msg}`,
          context: `file=${item.file.name}; size=${item.file.size}; category=${categoryTag}`,
        });
      }
    }
  }, [workspaceId, productionBanner, categoryTag, ingestPath, showMessage, uploadSmallPAR]);

  const uploadOne = useCallback((item: UploadItem) => {
    if (item.file.size > MULTIPART_THRESHOLD) {
      void uploadLargeMultipart(item);
    } else {
      uploadSmallPAR(item);
    }
  }, [uploadLargeMultipart, uploadSmallPAR]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fresh: UploadItem[] = Array.from(files).map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        progress: 0,
        status: "idle",
      }));
      setItems((prev) => [...fresh, ...prev]);
      // Start uploads immediately
      fresh.forEach((it) => setTimeout(() => uploadOne(it), 50));
    },
    [uploadOne],
  );

  // Surface the active routing so testers know which studio path their files land in.
  useEffect(() => {
    if (active) {
      // No layout change — toast only on first mount per workspace+category.
      const label = INGEST_CATEGORY_LABEL[ingestPath] ?? "Hardware";
      toast.message(`Routing: ${label}`, {
        description: `Studio: ${productionBanner ?? "Default"} · chunked > 5MB`,
        duration: 2500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, ingestPath]);


  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onCancel = (item: UploadItem) => {
    item.xhr?.abort();
  };

  const onRetry = (item: UploadItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, status: "idle", progress: 0, error: undefined } : it,
      ),
    );
    uploadOne({ ...item, progress: 0, status: "idle", error: undefined });
  };

  const clearCompleted = () =>
    setItems((prev) => prev.filter((i) => i.status !== "success"));

  const activeCount = items.filter((i) => i.status === "uploading").length;
  const doneCount = items.filter((i) => i.status === "success").length;

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <Seo
        title="Ingest Test — Crayons Bridge · StreamVista"
        description="Internal browser-based ingest test for StreamVista Cloud — upload media files directly via Pre-Authenticated Request to validate the camera-to-cloud pipeline."
        path="/ingest-test"
        type="article"
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 text-center">
          <Badge variant="secondary" className="mx-auto">Internal test route</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Crayons Bridge · Ingest Test</h1>
          <p className="text-muted-foreground">
            Direct browser → C CLOUD upload via Pre-Authenticated Request.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Drop files to ingest</CardTitle>
            <CardDescription>
              Files are PUT directly to C CLOUD Object Storage. Nothing is proxied through our server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={[
                "rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-muted/50",
              ].join(" ")}
            >
              <CloudUpload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {isDragging ? "Release to upload" : "Drop files here or click to browse"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Any file type · One PUT per file · Filename used as object key
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {items.length > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {activeCount > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {activeCount} uploading
                    </span>
                  )}
                  {activeCount === 0 && doneCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {doneCount} complete
                    </span>
                  )}
                </span>
                {doneCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCompleted}>
                    Clear completed
                  </Button>
                )}
              </div>
            )}

            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{it.file.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(it.file.size)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={it.progress} className="h-1.5 flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {it.progress}%
                        </span>
                      </div>
                      {it.status === "error" && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="h-3.5 w-3.5" />
                          {it.error}
                        </p>
                      )}
                      {it.status === "success" && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Delivered to Crayons Bridge
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {it.status === "uploading" && (
                        <Button size="sm" variant="ghost" onClick={() => onCancel(it)}>
                          Cancel
                        </Button>
                      )}
                      {it.status === "error" && (
                        <Button size="sm" variant="outline" onClick={() => onRetry(it)}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Tip: if uploads fail with a network error, the PAR has expired or the bucket CORS rules
          don't allow PUT from this origin.
        </p>
      </div>
    </main>
  );
}
