import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";
import {
  ChevronUp, CheckCircle2, AlertCircle, Loader2, Upload, X, Minimize2, FileVideo,
  Pause, Play, RefreshCw, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

export type UploadOptions = {
  tier: "lite" | "sovereign";
  password?: string;
  expiryDays?: number | "";
  maxDownloads?: number | "";
};

type Status = "queued" | "uploading" | "paused" | "done" | "error" | "needs-file";

export type UploadTask = {
  id: string;
  filename: string;
  size: number;
  mime: string;
  tier: UploadOptions["tier"];
  opts: UploadOptions;
  storagePath: string;        // deterministic path so resume hits the same object
  progress: number;
  uploadedBytes: number;
  status: Status;
  error?: string;
  startedAt: number;
  etaSeconds?: number;
  speedBps?: number;
};

export type PostUploadCtx = {
  storagePath: string;
  filename: string;
  size: number;
  mime: string;
  shareToken: string;         // derived from storagePath
};

type ProviderConfig = {
  bucket: string;
  /** Build a deterministic storage path for the upload. Called once at enqueue time. */
  getPath: (file: File) => { path: string; shareToken: string };
  /** Called after the tus upload completes (insert DB row, attach password, etc.). */
  postUpload: (ctx: PostUploadCtx, opts: UploadOptions) => Promise<void>;
  /** Optional callback when any task finishes successfully (e.g. refresh list). */
  onUploaded?: () => void;
};

type Ctx = {
  enqueue: (file: File, opts: UploadOptions) => string;
  attachFile: (taskId: string, file: File) => void;
};

const UploadManagerContext = createContext<Ctx | null>(null);
export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used inside UploadManagerProvider");
  return ctx;
}

const STORAGE_KEY = "sv_upload_queue_v1";
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 20000, 30000];

// ─── Persistence (file objects can't survive refresh; metadata + tus URLs can) ───

type Persisted = Omit<UploadTask, "status"> & { status: Status };

function loadPersisted(): Persisted[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Persisted[];
  } catch { return []; }
}
function savePersisted(tasks: UploadTask[]) {
  try {
    const slim = tasks.map((t) => ({ ...t }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch { /* ignore quota */ }
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function fmtEta(s?: number) {
  if (s == null || !isFinite(s) || s <= 0) return "—";
  if (s < 60) return `${Math.ceil(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.ceil(s % 60)}s`;
}

async function getSupabaseConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || "";
  const apikey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    "";
  return { endpoint: `${url}/storage/v1/upload/resumable`, accessToken, apikey };
}

export function UploadManagerProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: ProviderConfig;
}) {
  const [tasks, setTasks] = useState<UploadTask[]>(() =>
    loadPersisted().map((t) => ({
      ...t,
      // After a refresh: any in-flight upload becomes "needs-file" until the user re-picks it.
      status: t.status === "done" || t.status === "error" ? t.status : "needs-file",
      etaSeconds: undefined,
      speedBps: undefined,
    })),
  );
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const uploadsRef = useRef<Map<string, tus.Upload>>(new Map());
  const filesRef = useRef<Map<string, File>>(new Map());
  const configRef = useRef(config);
  configRef.current = config;

  // Persist on every change
  useEffect(() => { savePersisted(tasks); }, [tasks]);

  const update = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const startTus = useCallback(async (task: UploadTask, file: File) => {
    const { endpoint, accessToken, apikey } = await getSupabaseConfig();
    if (!accessToken) {
      update(task.id, { status: "error", error: "Not signed in" });
      return;
    }

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: RETRY_DELAYS,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
        apikey,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: configRef.current.bucket,
        objectName: task.storagePath,
        contentType: task.mime || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err) => {
        console.error("[upload] tus error", err);
        update(task.id, { status: "paused", error: err?.message || "Network interrupted — will resume" });
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== task.id) return t;
            const elapsed = Math.max(0.1, (Date.now() - (t.startedAt || Date.now())) / 1000);
            const speedBps = bytesUploaded / elapsed;
            const remaining = Math.max(0, bytesTotal - bytesUploaded);
            return {
              ...t,
              uploadedBytes: bytesUploaded,
              progress: Math.min(99, (bytesUploaded / bytesTotal) * 100),
              speedBps,
              etaSeconds: speedBps > 0 ? remaining / speedBps : undefined,
              status: "uploading",
            };
          }),
        );
      },
      onSuccess: async () => {
        update(task.id, { uploadedBytes: task.size, progress: 100 });
        try {
          const shareToken = task.storagePath.split("/").pop()?.split(".")[0] || task.id;
          await configRef.current.postUpload(
            {
              storagePath: task.storagePath,
              filename: task.filename,
              size: task.size,
              mime: task.mime,
              shareToken,
            },
            task.opts,
          );
          update(task.id, { status: "done", etaSeconds: 0 });
          configRef.current.onUploaded?.();
        } catch (e: any) {
          update(task.id, { status: "error", error: e?.message || "Post-upload failed" });
        } finally {
          uploadsRef.current.delete(task.id);
          filesRef.current.delete(task.id);
        }
      },
    });

    uploadsRef.current.set(task.id, upload);
    filesRef.current.set(task.id, file);

    // If we already have a resumable URL recorded server-side, tus's fingerprint will pick it up.
    const previous = await upload.findPreviousUploads();
    if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);

    update(task.id, { status: "uploading", startedAt: Date.now(), error: undefined });
    upload.start();
  }, [update]);

  // Global online/offline handler — pauses every in-flight upload and auto-resumes on reconnect.
  // Single set of listeners (no per-task leak, no stale closures).
  useEffect(() => {
    const onOffline = () => {
      uploadsRef.current.forEach((up, id) => {
        try { up.abort(); } catch {}
        update(id, { status: "paused", error: "Offline — will auto-resume when reconnected" });
      });
    };
    const onOnline = () => {
      uploadsRef.current.forEach((up, id) => {
        update(id, { status: "uploading", error: undefined });
        try { up.start(); } catch {}
      });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [update]);

  const enqueue = useCallback(
    (file: File, opts: UploadOptions) => {
      const { path, shareToken } = configRef.current.getPath(file);
      const id = `up_${Date.now()}_${shareToken.slice(0, 6)}`;
      const task: UploadTask = {
        id,
        filename: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        tier: opts.tier,
        opts,
        storagePath: path,
        progress: 0,
        uploadedBytes: 0,
        status: "queued",
        startedAt: Date.now(),
      };
      setTasks((prev) => [task, ...prev]);
      setOpen(true);
      setMinimized(false);
      setTimeout(() => startTus(task, file), 30);
      return id;
    },
    [startTus],
  );

  const attachFile = useCallback(
    (taskId: string, file: File) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (file.size !== task.size) {
        update(taskId, { status: "error", error: `File size doesn't match (expected ${fmtBytes(task.size)})` });
        return;
      }
      startTus(task, file);
    },
    [tasks, startTus, update],
  );

  const pauseTask = (id: string) => {
    const up = uploadsRef.current.get(id);
    if (up) { try { up.abort(); } catch {} }
    update(id, { status: "paused" });
  };
  const resumeTask = (id: string) => {
    const up = uploadsRef.current.get(id);
    const file = filesRef.current.get(id);
    if (up && file) {
      update(id, { status: "uploading", error: undefined });
      try { up.start(); } catch {}
    } else {
      // Lost the file handle (e.g. after page refresh) — need user to re-pick.
      update(id, { status: "needs-file" });
    }
  };
  const removeTask = (id: string) => {
    const up = uploadsRef.current.get(id);
    if (up) { try { up.abort(true); } catch {} }
    uploadsRef.current.delete(id);
    filesRef.current.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };
  const clearFinished = () =>
    setTasks((prev) => prev.filter((t) => t.status !== "done" && t.status !== "error"));

  const ctxValue = useMemo<Ctx>(() => ({ enqueue, attachFile }), [enqueue, attachFile]);

  const active = tasks.filter((t) => t.status === "uploading" || t.status === "queued");
  const needsResume = tasks.filter((t) => t.status === "needs-file" || t.status === "paused");
  const aggregate = active.length
    ? Math.round(active.reduce((s, t) => s + (t.uploadedBytes / Math.max(1, t.size)) * 100, 0) / active.length)
    : 100;
  const totalEta = active.map((t) => t.etaSeconds ?? 0).reduce((a, b) => Math.max(a, b), 0);

  return (
    <UploadManagerContext.Provider value={ctxValue}>
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>

      {tasks.length > 0 && open && (
        <div
          className={cn(
            "fixed z-50 right-4 bottom-4 sm:right-6 sm:bottom-6 animate-fade-in",
            minimized ? "w-[280px]" : "w-[min(400px,calc(100vw-2rem))]",
          )}
        >
          <div className="glass-strong rounded-2xl border border-border/60 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.55)] overflow-hidden">
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/10 via-transparent to-accent/10"
            >
              <div className="relative w-8 h-8 rounded-lg bg-gradient-primary grid place-items-center glow-primary shrink-0">
                {active.length > 0 ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                  : needsResume.length > 0 ? <RefreshCw className="w-4 h-4 text-primary-foreground" />
                  : <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-display text-sm font-semibold truncate">
                  {active.length > 0
                    ? `Uploading ${active.length} file${active.length > 1 ? "s" : ""}`
                    : needsResume.length > 0
                    ? `${needsResume.length} upload${needsResume.length > 1 ? "s" : ""} can resume`
                    : "All uploads complete"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {active.length > 0
                    ? `${aggregate}% · ETA ${fmtEta(totalEta)}`
                    : needsResume.length > 0
                    ? "Re-select the file to continue from where it stopped"
                    : `${tasks.length} item${tasks.length > 1 ? "s" : ""} in this session`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
                      className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                      aria-label={minimized ? "Expand" : "Minimize"}
                    >
                      {minimized ? <ChevronUp className="w-4 h-4" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {minimized ? "Expand upload manager" : "Minimize — uploads keep running"}
                  </TooltipContent>
                </Tooltip>
                {active.length === 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                        aria-label="Close"
                      ><X className="w-4 h-4" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="left">Close manager</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </button>

            <div className="h-1 bg-secondary/40 relative overflow-hidden">
              <div className="h-full bg-gradient-primary transition-[width] duration-500 ease-out"
                style={{ width: `${active.length > 0 ? aggregate : 100}%` }} />
              {active.length > 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
              )}
            </div>

            {!minimized && (
              <div className="max-h-[340px] overflow-y-auto p-3 space-y-2">
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onPause={() => pauseTask(t.id)}
                    onResume={() => resumeTask(t.id)}
                    onRemove={() => removeTask(t.id)}
                    onAttach={(file) => attachFile(t.id, file)}
                  />
                ))}
                {tasks.some((t) => t.status === "done" || t.status === "error") && (
                  <button type="button" onClick={clearFinished}
                    className="w-full text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground py-2 transition-colors">
                    Clear finished
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </UploadManagerContext.Provider>
  );
}

function TaskRow({
  task, onPause, onResume, onRemove, onAttach,
}: {
  task: UploadTask;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
  onAttach: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isUploading = task.status === "uploading" || task.status === "queued";
  const isDone = task.status === "done";
  const isError = task.status === "error";
  const isPaused = task.status === "paused";
  const needsFile = task.status === "needs-file";

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-all",
        isUploading && "border-accent/40 bg-accent/[0.03] shadow-[0_0_24px_-12px_hsl(var(--accent)/0.6)]",
        isDone && "border-border/40 bg-secondary/20",
        isError && "border-destructive/50 bg-destructive/5",
        (isPaused || needsFile) && "border-amber-500/40 bg-amber-500/[0.04]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "w-8 h-8 rounded-lg grid place-items-center shrink-0",
          isUploading && "bg-gradient-primary/20 text-accent",
          isDone && "bg-emerald-500/15 text-emerald-400",
          isError && "bg-destructive/15 text-destructive",
          (isPaused || needsFile) && "bg-amber-500/15 text-amber-400",
        )}>
          {isUploading ? <FileVideo className="w-4 h-4" />
            : isDone ? <CheckCircle2 className="w-4 h-4" />
            : isError ? <AlertCircle className="w-4 h-4" />
            : <RefreshCw className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate" title={task.filename}>{task.filename}</div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>{fmtBytes(task.uploadedBytes)} / {fmtBytes(task.size)}</span>
            <span>·</span>
            <span>{task.tier === "sovereign" ? "India Secure" : "Standard"}</span>
            {isUploading && task.etaSeconds != null && (<><span>·</span><span>ETA {fmtEta(task.etaSeconds)}</span></>)}
            {isPaused && <><span>·</span><span className="text-amber-400">Paused</span></>}
            {needsFile && <><span>·</span><span className="text-amber-400">Re-select to resume</span></>}
          </div>
        </div>
        <div className="text-[11px] font-mono tabular-nums shrink-0 w-10 text-right">
          {isDone ? "✓" : isError ? "!" : `${Math.round(task.progress)}%`}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isUploading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onPause} className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5">
                  <Pause className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Pause</TooltipContent>
            </Tooltip>
          )}
          {isPaused && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onResume} className="h-7 w-7 grid place-items-center rounded-md text-accent hover:bg-white/5">
                  <Play className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Resume from {Math.round(task.progress)}%</TooltipContent>
            </Tooltip>
          )}
          {needsFile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => fileInput.current?.click()}
                  className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-amber-400 border border-amber-500/40 hover:bg-amber-500/10"
                >
                  <FolderOpen className="w-3 h-3" /> Resume
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Pick the same file ({fmtBytes(task.size)}) to continue uploading.
              </TooltipContent>
            </Tooltip>
          )}
          {(isDone || isError || isPaused || needsFile) && (
            <button onClick={onRemove}
              className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Dismiss">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <input
          ref={fileInput} type="file" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAttach(f);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <div className="mt-2 h-1 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            isError ? "bg-destructive"
              : isPaused || needsFile ? "bg-amber-400"
              : "bg-gradient-primary",
          )}
          style={{ width: `${isDone ? 100 : task.progress}%` }}
        />
      </div>
      {(isError && task.error) && (
        <div className="mt-1.5 text-[10px] text-destructive">{task.error}</div>
      )}
      {(isPaused && task.error) && (
        <div className="mt-1.5 text-[10px] text-amber-400/90">{task.error}</div>
      )}
    </div>
  );
}

/** Optional ambient guidance pill (kept for compatibility). */
export function GuidancePill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button" onClick={onClick}
          className="group fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 h-10 px-4 rounded-full glass-strong border border-accent/40 text-xs font-semibold shadow-[0_0_30px_-8px_hsl(var(--accent)/0.55)] hover:shadow-[0_0_40px_-6px_hsl(var(--accent)/0.8)] transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        Drag files anywhere, or click to ingest from a connected card / USB-C drive.
      </TooltipContent>
    </Tooltip>
  );
}
