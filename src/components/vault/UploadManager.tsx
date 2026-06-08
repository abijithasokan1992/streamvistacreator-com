import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2, Upload, X, Minimize2, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type UploadOptions = {
  tier: "lite" | "sovereign";
  password?: string;
  expiryDays?: number | "";
  maxDownloads?: number | "";
};

export type UploadTask = {
  id: string;
  filename: string;
  size: number;
  tier: UploadOptions["tier"];
  progress: number; // 0-100
  uploadedBytes: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  startedAt: number;
  etaSeconds?: number;
  speedBps?: number;
};

type Runner = (
  file: File,
  opts: UploadOptions,
  onProgress: (uploadedBytes: number) => void,
) => Promise<void>;

type Ctx = {
  enqueue: (file: File, opts: UploadOptions) => string;
  setRunner: (r: Runner) => void;
};

const UploadManagerContext = createContext<Ctx | null>(null);

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used inside UploadManagerProvider");
  return ctx;
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
  const ss = Math.ceil(s % 60);
  return `${m}m ${ss}s`;
}

// Simulated progress ticker — Supabase JS upload doesn't expose progress events.
// We model an asymptotic ramp toward 95% based on assumed 6 MB/s, then jump to 100% on resolve.
const ASSUMED_BPS = 6 * 1024 * 1024;

export function UploadManagerProvider({
  children,
  onUploaded,
}: {
  children: React.ReactNode;
  onUploaded?: () => void;
}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const runnerRef = useRef<Runner | null>(null);
  const tickers = useRef<Map<string, number>>(new Map());

  const setRunner = useCallback((r: Runner) => {
    runnerRef.current = r;
  }, []);

  const update = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const startTask = useCallback(
    async (task: UploadTask, file: File, opts: UploadOptions) => {
      if (!runnerRef.current) {
        update(task.id, { status: "error", error: "Upload runner not ready" });
        return;
      }
      update(task.id, { status: "uploading", startedAt: Date.now() });

      // Simulated progress ramp toward 95%
      const interval = window.setInterval(() => {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== task.id || t.status !== "uploading") return t;
            const elapsed = (Date.now() - t.startedAt) / 1000;
            const projected = Math.min(t.size * 0.95, elapsed * ASSUMED_BPS);
            const uploadedBytes = Math.max(t.uploadedBytes, projected);
            const progress = Math.min(95, (uploadedBytes / t.size) * 100);
            const speedBps = uploadedBytes / Math.max(elapsed, 0.1);
            const remaining = Math.max(0, t.size - uploadedBytes);
            const etaSeconds = speedBps > 0 ? remaining / speedBps : undefined;
            return { ...t, uploadedBytes, progress, speedBps, etaSeconds };
          }),
        );
      }, 350);
      tickers.current.set(task.id, interval);

      try {
        await runnerRef.current(file, opts, (uploadedBytes) => {
          update(task.id, {
            uploadedBytes,
            progress: Math.min(99, (uploadedBytes / task.size) * 100),
          });
        });
        update(task.id, { status: "done", progress: 100, uploadedBytes: task.size, etaSeconds: 0 });
        onUploaded?.();
      } catch (e: any) {
        update(task.id, { status: "error", error: e?.message || "Upload failed" });
      } finally {
        const handle = tickers.current.get(task.id);
        if (handle) window.clearInterval(handle);
        tickers.current.delete(task.id);
      }
    },
    [onUploaded, update],
  );

  const enqueue = useCallback(
    (file: File, opts: UploadOptions) => {
      const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const task: UploadTask = {
        id,
        filename: file.name,
        size: file.size,
        tier: opts.tier,
        progress: 0,
        uploadedBytes: 0,
        status: "queued",
        startedAt: Date.now(),
      };
      setTasks((prev) => [task, ...prev]);
      setOpen(true);
      setMinimized(false);
      // Kick off async
      setTimeout(() => startTask(task, file, opts), 50);
      return id;
    },
    [startTask],
  );

  useEffect(() => {
    return () => {
      tickers.current.forEach((h) => window.clearInterval(h));
      tickers.current.clear();
    };
  }, []);

  const ctxValue = useMemo<Ctx>(() => ({ enqueue, setRunner }), [enqueue, setRunner]);

  const active = tasks.filter((t) => t.status === "uploading" || t.status === "queued");
  const aggregate = active.length
    ? Math.round(
        active.reduce((s, t) => s + (t.uploadedBytes / Math.max(1, t.size)) * 100, 0) / active.length,
      )
    : 100;
  const totalEta = active
    .map((t) => t.etaSeconds ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const clearFinished = () =>
    setTasks((prev) => prev.filter((t) => t.status !== "done" && t.status !== "error"));

  return (
    <UploadManagerContext.Provider value={ctxValue}>
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>

      {tasks.length > 0 && open && (
        <div
          className={cn(
            "fixed z-50 right-4 bottom-4 sm:right-6 sm:bottom-6 animate-fade-in",
            minimized ? "w-[260px]" : "w-[min(380px,calc(100vw-2rem))]",
          )}
        >
          <div className="glass-strong rounded-2xl border border-border/60 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.55)] overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/10 via-transparent to-accent/10"
            >
              <div className="relative w-8 h-8 rounded-lg bg-gradient-primary grid place-items-center glow-primary shrink-0">
                {active.length > 0 ? (
                  <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-display text-sm font-semibold truncate">
                  {active.length > 0
                    ? `Uploading ${active.length} file${active.length > 1 ? "s" : ""}`
                    : "All uploads complete"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {active.length > 0
                    ? `${aggregate}% · ETA ${fmtEta(totalEta)}`
                    : `${tasks.length} item${tasks.length > 1 ? "s" : ""} in this session`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMinimized((m) => !m);
                      }}
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
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                        }}
                        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">Close manager</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </button>

            {/* Aggregate progress bar (always visible) */}
            <div className="h-1 bg-secondary/40 relative overflow-hidden">
              <div
                className="h-full bg-gradient-primary transition-[width] duration-500 ease-out"
                style={{ width: `${active.length > 0 ? aggregate : 100}%` }}
              />
              {active.length > 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
              )}
            </div>

            {/* Task list */}
            {!minimized && (
              <div className="max-h-[320px] overflow-y-auto p-3 space-y-2">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onRemove={() => removeTask(t.id)} />
                ))}
                {tasks.some((t) => t.status === "done" || t.status === "error") && (
                  <button
                    type="button"
                    onClick={clearFinished}
                    className="w-full text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
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

function TaskRow({ task, onRemove }: { task: UploadTask; onRemove: () => void }) {
  const isUploading = task.status === "uploading" || task.status === "queued";
  const isDone = task.status === "done";
  const isError = task.status === "error";

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-all",
        isUploading && "border-accent/40 bg-accent/[0.03] shadow-[0_0_24px_-12px_hsl(var(--accent)/0.6)]",
        isDone && "border-border/40 bg-secondary/20",
        isError && "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-8 h-8 rounded-lg grid place-items-center shrink-0",
            isUploading && "bg-gradient-primary/20 text-accent",
            isDone && "bg-emerald-500/15 text-emerald-400",
            isError && "bg-destructive/15 text-destructive",
          )}
        >
          {isUploading ? (
            <FileVideo className="w-4 h-4" />
          ) : isDone ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate" title={task.filename}>
            {task.filename}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <span>{fmtBytes(task.size)}</span>
            <span>·</span>
            <span>{task.tier === "sovereign" ? "India Secure" : "Standard"}</span>
            {isUploading && task.etaSeconds != null && (
              <>
                <span>·</span>
                <span>ETA {fmtEta(task.etaSeconds)}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-[11px] font-mono tabular-nums shrink-0 w-10 text-right">
          {isDone ? "✓" : isError ? "!" : `${Math.round(task.progress)}%`}
        </div>
        {(isDone || isError) && (
          <button
            type="button"
            onClick={onRemove}
            className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="mt-2 h-1 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            isError ? "bg-destructive" : "bg-gradient-primary",
          )}
          style={{ width: `${isDone ? 100 : task.progress}%` }}
        />
      </div>
      {isError && task.error && (
        <div className="mt-1.5 text-[10px] text-destructive">{task.error}</div>
      )}
    </div>
  );
}

/** Inline floating "Quick upload" guidance pill — Invisible Guidance UX. */
export function GuidancePill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
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
