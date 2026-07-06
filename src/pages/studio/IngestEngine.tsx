/**
 * Media Ingest Engine — Studio-scoped route.
 *
 * Three panels:
 *   1. Source     — device picker, scan summary, safety guarantees.
 *   2. Plan       — manifest with dedupe / format-policy verdicts.
 *   3. Transfer   — live progress, per-item verify witnesses, detailed log.
 *
 * Uses the existing zinc-950 Studio Professional aesthetic. No hardcoded
 * colors — everything is themed via existing tokens / utilities.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HardDrive, ShieldCheck, Play, Pause, FileWarning, CheckCircle2, XCircle, Loader2, RefreshCw, FolderOpen } from "lucide-react";
import { scanDirectoryHandle, scanFileList, supportsDirectoryPicker, formatBytes, type ScanResult } from "@/lib/ingest/deviceScanner";
import { buildManifest, type Manifest, type ManifestItem } from "@/lib/ingest/deviceManifest";
import { IngestEngine, createIngestJob, type ItemRuntime, type ItemRuntimeStatus } from "@/lib/ingest/ingestEngine";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { toast } from "@/hooks/use-toast";

type Phase = "idle" | "scanning" | "planning" | "ready" | "running" | "paused" | "done";
type LogRow = { at: string; level: "info" | "warn" | "error"; message: string; itemId?: string };

const STATUS_BADGE: Record<ItemRuntimeStatus, { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "bg-zinc-800 text-zinc-300" },
  hashing: { label: "Hashing", tone: "bg-amber-500/10 text-amber-300" },
  uploading: { label: "Uploading", tone: "bg-sky-500/10 text-sky-300" },
  server_checksum: { label: "Server checksum", tone: "bg-sky-500/10 text-sky-300" },
  verifying: { label: "Verifying", tone: "bg-violet-500/10 text-violet-300" },
  verified: { label: "Verified", tone: "bg-emerald-500/10 text-emerald-300" },
  duplicate_skipped: { label: "Duplicate", tone: "bg-zinc-700/50 text-zinc-400" },
  format_rejected: { label: "Rejected", tone: "bg-zinc-700/50 text-zinc-400" },
  paused_device_lost: { label: "Device lost", tone: "bg-orange-500/10 text-orange-300" },
  paused_user: { label: "Paused", tone: "bg-zinc-700/50 text-zinc-300" },
  corrupt: { label: "Corrupt", tone: "bg-rose-500/10 text-rose-300" },
  failed: { label: "Failed", tone: "bg-rose-500/10 text-rose-300" },
};

export default function IngestEnginePage() {
  const { active } = useWorkspaces();
  const [phase, setPhase] = useState<Phase>("idle");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [runtimes, setRuntimes] = useState<ItemRuntime[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [planProgress, setPlanProgress] = useState({ done: 0, total: 0 });
  const engineRef = useRef<IngestEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const appendLog = useCallback((level: LogRow["level"], message: string, itemId?: string) => {
    setLogs((prev) => [
      ...prev.slice(-499),
      { at: new Date().toISOString(), level, message, itemId },
    ]);
  }, []);

  const pickWithHandle = useCallback(async () => {
    setPhase("scanning");
    try {
      const win = window as unknown as {
        showDirectoryPicker: (o: { mode: "read" }) => Promise<FileSystemDirectoryHandle>;
      };
      const handle = await win.showDirectoryPicker({ mode: "read" });
      const s = await scanDirectoryHandle(handle);
      setScan(s);
      await plan(s);
    } catch (err) {
      appendLog("warn", (err as Error).message || "Picker cancelled");
      setPhase("idle");
    }
  }, [appendLog]);

  const pickWithFallback = useCallback(() => {
    fallbackInputRef.current?.click();
  }, []);

  const onFallbackFiles = useCallback(async (list: FileList | null) => {
    if (!list || !list.length) return;
    setPhase("scanning");
    const s = scanFileList(list);
    setScan(s);
    await plan(s);
  }, []);

  const plan = useCallback(
    async (s: ScanResult) => {
      setPhase("planning");
      setPlanProgress({ done: 0, total: s.files.length });
      const m = await buildManifest(s, {
        workspaceId: active?.id ?? null,
        onProgress: (done, total) => setPlanProgress({ done, total }),
      });
      setManifest(m);
      setPhase("ready");
      appendLog(
        "info",
        `Planned ${m.counts.total} files — ${m.counts.new} new, ${m.counts.duplicateInPick + m.counts.duplicateKnown} duplicate, ${m.counts.rejected} rejected.`,
      );
    },
    [active?.id, appendLog],
  );

  const start = useCallback(async () => {
    if (!manifest || !active?.id) return;
    try {
      const jobId = await createIngestJob({
        workspaceId: active.id,
        rootLabel: manifest.rootLabel,
        cameraFamilyLabel: manifest.cameraFamilyLabel,
        totalBytes: manifest.totalBytes,
        itemCount: manifest.counts.new,
      });
      appendLog("info", `Ingest job created: ${jobId}`);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const engine = new IngestEngine(manifest, {
        workspaceId: active.id,
        jobId,
        signal: ctrl.signal,
        onEvent: (evt) => {
          if (evt.type === "item") {
            setRuntimes((prev) => {
              const next = prev.slice();
              const idx = next.findIndex((r) => r.item.id === evt.item.item.id);
              if (idx >= 0) next[idx] = { ...evt.item };
              return next;
            });
          } else if (evt.type === "log") {
            appendLog(evt.level, evt.message, evt.itemId);
          } else if (evt.type === "done") {
            setPhase("done");
            appendLog(
              "info",
              `Done — ${evt.summary.verified} verified, ${evt.summary.corrupt} corrupt, ${evt.summary.failed} failed, ${evt.summary.skipped} skipped.`,
            );
            toast({
              title: "Ingest complete",
              description: `${evt.summary.verified} files verified. ${evt.summary.corrupt + evt.summary.failed} require attention.`,
            });
          }
        },
      });
      engineRef.current = engine;
      setRuntimes(engine.getRuntimes());
      setPhase("running");
      await engine.run();
    } catch (err) {
      appendLog("error", (err as Error).message || "Failed to start ingest");
      setPhase("ready");
    }
  }, [manifest, active?.id, appendLog]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    abortRef.current?.abort();
    setPhase("paused");
    appendLog("warn", "Paused by operator — resume will pick up from last verified chunk.");
  }, [appendLog]);

  const rescan = useCallback(() => {
    setScan(null);
    setManifest(null);
    setRuntimes([]);
    setPhase("idle");
  }, []);

  const totals = useMemo(() => {
    if (!runtimes.length) return null;
    const loaded = runtimes.reduce((s, r) => s + r.bytesUploaded, 0);
    const total = runtimes.reduce((s, r) => s + r.totalBytes, 0);
    return { loaded, total, pct: total > 0 ? Math.round((loaded / total) * 100) : 0 };
  }, [runtimes]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-zinc-400" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Media Ingest Engine</h1>
              <p className="text-xs text-zinc-500">Enterprise DIT · Studio · Broadcast</p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Read-only source · 3-way verify
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-3">
        <SourcePanel
          phase={phase}
          scan={scan}
          onPickHandle={pickWithHandle}
          onPickFallback={pickWithFallback}
          onRescan={rescan}
          planProgress={planProgress}
        />
        <PlanPanel manifest={manifest} phase={phase} onStart={start} canStart={!!active?.id} />
        <TransferPanel runtimes={runtimes} totals={totals} phase={phase} onPause={pause} />
      </main>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <LogDrawer logs={logs} />
      </section>

      <input
        ref={fallbackInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in the standard type
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => void onFallbackFiles(e.target.files)}
      />
    </div>
  );
}

function SourcePanel(props: {
  phase: Phase;
  scan: ScanResult | null;
  planProgress: { done: number; total: number };
  onPickHandle: () => void;
  onPickFallback: () => void;
  onRescan: () => void;
}) {
  const supportsHandle = supportsDirectoryPicker();
  const { phase, scan, planProgress } = props;
  return (
    <Card className="border-zinc-900 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-zinc-200">1 · Source device</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scan ? (
          <div className="space-y-3 text-sm text-zinc-400">
            <p>
              Mount an SD / CFexpress card, USB drive, SSD, HDD, RAID, NAS, phone, or tablet, then pick its root folder.
              Source files are opened <span className="text-zinc-200">read-only</span> and are never modified, renamed, or deleted.
            </p>
            <div className="flex flex-col gap-2">
              {supportsHandle ? (
                <Button onClick={props.onPickHandle} className="justify-start" variant="secondary">
                  <FolderOpen className="mr-2 h-4 w-4" /> Pick device folder (read-only)
                </Button>
              ) : null}
              <Button onClick={props.onPickFallback} className="justify-start" variant="outline">
                <FolderOpen className="mr-2 h-4 w-4" /> Pick folder (compatibility mode)
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              No native drivers, no elevated permissions — the picker runs entirely inside the browser sandbox you approve.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <Row k="Volume" v={scan.rootLabel} />
            <Row k="Camera family" v={scan.cameraFamilyLabel} />
            <Row k="Files" v={scan.files.length.toLocaleString()} />
            <Row k="Total size" v={formatBytes(scan.totalBytes)} />
            <Row k="Formats" v={scan.mediaFormats.slice(0, 8).join(" · ") || "—"} />
            <Separator className="bg-zinc-800" />
            {phase === "planning" && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Planning…</span>
                  <span>
                    {planProgress.done}/{planProgress.total}
                  </span>
                </div>
                <Progress
                  value={planProgress.total ? (planProgress.done / planProgress.total) * 100 : 0}
                  className="h-1.5"
                />
              </div>
            )}
            <Button onClick={props.onRescan} variant="ghost" size="sm">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Rescan another device
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanPanel({
  manifest,
  phase,
  onStart,
  canStart,
}: {
  manifest: Manifest | null;
  phase: Phase;
  onStart: () => void;
  canStart: boolean;
}) {
  return (
    <Card className="border-zinc-900 bg-zinc-900/40">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-zinc-200">2 · Ingest plan</CardTitle>
      </CardHeader>
      <CardContent>
        {!manifest ? (
          <p className="text-sm text-zinc-500">Pick a device to build the ingest plan.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="Total" value={manifest.counts.total} />
              <Stat label="New" value={manifest.counts.new} tone="text-emerald-300" />
              <Stat
                label="Duplicate"
                value={manifest.counts.duplicateInPick + manifest.counts.duplicateKnown}
                tone="text-zinc-400"
              />
              <Stat label="Rejected" value={manifest.counts.rejected} tone="text-rose-300" />
            </div>
            <ScrollArea className="h-64 rounded-md border border-zinc-800">
              <div className="divide-y divide-zinc-800">
                {manifest.items.slice(0, 500).map((it) => (
                  <ManifestRow key={it.id} item={it} />
                ))}
                {manifest.items.length > 500 && (
                  <div className="p-2 text-center text-xs text-zinc-500">
                    +{manifest.items.length - 500} more…
                  </div>
                )}
              </div>
            </ScrollArea>
            <Button
              onClick={onStart}
              disabled={!canStart || phase === "running" || phase === "paused" || manifest.counts.new === 0}
              className="w-full"
            >
              <Play className="mr-2 h-4 w-4" />
              Start verified transfer ({manifest.counts.new} files)
            </Button>
            {!canStart && (
              <p className="text-xs text-amber-300">
                Select a workspace to enable transfers.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManifestRow({ item }: { item: ManifestItem }) {
  const tone =
    item.status === "new"
      ? "text-emerald-300"
      : item.status === "rejected"
        ? "text-rose-300"
        : "text-zinc-400";
  const label =
    item.status === "new"
      ? "New"
      : item.status === "rejected"
        ? "Rejected"
        : item.status === "duplicate_in_pick"
          ? "Duplicate (pick)"
          : "Duplicate (known)";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[11px] text-zinc-200">{item.relativePath}</div>
        <div className="text-[10px] text-zinc-500">
          {item.classification.detectedType} · {formatBytes(item.size)}
          {item.rejectReason ? ` · ${item.rejectReason}` : ""}
        </div>
      </div>
      <span className={`shrink-0 text-[10px] font-medium ${tone}`}>{label}</span>
    </div>
  );
}

function TransferPanel({
  runtimes,
  totals,
  phase,
  onPause,
}: {
  runtimes: ItemRuntime[];
  totals: { loaded: number; total: number; pct: number } | null;
  phase: Phase;
  onPause: () => void;
}) {
  return (
    <Card className="border-zinc-900 bg-zinc-900/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-zinc-200">3 · Transfer</CardTitle>
        {phase === "running" && (
          <Button size="sm" variant="ghost" onClick={onPause}>
            <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!runtimes.length ? (
          <p className="text-sm text-zinc-500">Waiting to start — verified transfers appear here.</p>
        ) : (
          <div className="space-y-3">
            {totals && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Overall</span>
                  <span>
                    {formatBytes(totals.loaded)} / {formatBytes(totals.total)} · {totals.pct}%
                  </span>
                </div>
                <Progress value={totals.pct} className="h-1.5" />
              </div>
            )}
            <ScrollArea className="h-72 rounded-md border border-zinc-800">
              <div className="divide-y divide-zinc-800">
                {runtimes.map((r) => (
                  <RuntimeRow key={r.item.id} r={r} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuntimeRow({ r }: { r: ItemRuntime }) {
  const badge = STATUS_BADGE[r.status];
  const pct = r.totalBytes > 0 ? Math.round((r.bytesUploaded / r.totalBytes) * 100) : 0;
  const active =
    r.status === "hashing" || r.status === "uploading" || r.status === "verifying" || r.status === "server_checksum";
  return (
    <div className="space-y-1 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-zinc-200">{r.item.relativePath}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.tone}`}>
          {active ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
          {badge.label}
        </span>
      </div>
      {r.totalBytes > 0 && r.status !== "duplicate_skipped" && r.status !== "format_rejected" && (
        <Progress value={pct} className="h-1" />
      )}
      {r.witnesses && (
        <div className="flex gap-1.5 text-[10px] text-zinc-500">
          <Witness label="stream" v={r.witnesses.streaming} />
          <Witness label="reread" v={r.witnesses.reread} />
          <Witness label="server" v={r.witnesses.server} />
        </div>
      )}
      {r.message && <div className="text-[10px] text-zinc-500">{r.message}</div>}
    </div>
  );
}

function Witness({ label, v }: { label: string; v: string | null | undefined }) {
  if (!v) return <span className="rounded bg-zinc-800/60 px-1 py-0.5 text-zinc-600">{label}: —</span>;
  return (
    <span className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-zinc-400">
      {label}: {v.slice(0, 8)}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500">{k}</span>
      <span className="truncate text-zinc-200">{v}</span>
    </div>
  );
}

function Stat({ label, value, tone = "text-zinc-200" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 py-2">
      <div className={`text-sm font-semibold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function LogDrawer({ logs }: { logs: LogRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-zinc-900 bg-zinc-900/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-zinc-200">Detailed log</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const csv = logs
                .map((l) => `${l.at},${l.level},${JSON.stringify(l.message)}`)
                .join("\n");
              const blob = new Blob([`at,level,message\n${csv}`], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ingest-log-${new Date().toISOString()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((s) => !s)}>
            {open ? "Hide" : "Show"} ({logs.length})
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <ScrollArea className="h-64 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="text-zinc-600">No log entries yet.</div>
            ) : (
              logs
                .slice()
                .reverse()
                .map((l, i) => (
                  <div key={i} className="flex gap-2 py-0.5">
                    <span className="text-zinc-600">{l.at.slice(11, 19)}</span>
                    <span
                      className={
                        l.level === "error"
                          ? "text-rose-300"
                          : l.level === "warn"
                            ? "text-amber-300"
                            : "text-zinc-400"
                      }
                    >
                      {l.level.toUpperCase()}
                    </span>
                    <span className="text-zinc-300">{l.message}</span>
                    {l.level === "error" ? (
                      <XCircle className="ml-auto h-3 w-3 shrink-0 text-rose-400" />
                    ) : l.level === "warn" ? (
                      <FileWarning className="ml-auto h-3 w-3 shrink-0 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="ml-auto h-3 w-3 shrink-0 text-emerald-400" />
                    )}
                  </div>
                ))
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
