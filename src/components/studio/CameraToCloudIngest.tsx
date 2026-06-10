import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Cloud, UploadCloud, FileVideo, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useSystemMessage } from "@/components/system/SystemMessageProvider";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RecentUpload = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  status: "uploading" | "uploaded" | "failed" | string;
  error_message: string | null;
  object_key: string;
  bucket: string;
  region: string;
  created_at: string;
};

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

type Pending = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

export default function CameraToCloudIngest() {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [recent, setRecent] = useState<RecentUpload[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showMessage } = useSystemMessage();
  const { workspaces, activeId, setActiveId, canWriteActive } = useWorkspaces();

  const refresh = useCallback(async () => {
    if (!activeId) { setRecent([]); return; }
    setLoadingList(true);
    // RLS already isolates rows to workspaces the user belongs to; we filter
    // by the active workspace so the panel reflects only that tenant's assets.
    const { data, error } = await supabase
      .from("recent_uploads")
      .select("*")
      .eq("workspace_id", activeId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setRecent(data as RecentUpload[]);
    setLoadingList(false);
  }, [activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const uploadOne = useCallback(async (p: Pending) => {
    if (!activeId) {
      toast.error("Pick a workspace before uploading");
      return;
    }
    setPending((cur) => cur.map((x) => x.id === p.id ? { ...x, status: "uploading", progress: 5 } : x));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;
      const form = new FormData();
      form.append("file", p.file);
      // Route the upload into this workspace's isolated OCI prefix.
      form.append("workspaceId", activeId);
      // Idempotency key — same pendingId on retry reuses the server row + OCI object.
      form.append("pendingId", p.id);

      // Simulated progress while server streams to OCI (browser fetch lacks upload progress without XHR)
      const xhr = new XMLHttpRequest();
      const result: { upload?: RecentUpload; error?: string } = await new Promise((resolve, reject) => {
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(95, Math.round((e.loaded / e.total) * 90) + 5);
            setPending((cur) => cur.map((x) => x.id === p.id ? { ...x, progress: pct } : x));
          }
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error(`Bad response (${xhr.status})`)); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      });

      if (result.error || !result.upload) throw new Error(result.error ?? "Upload failed");
      setPending((cur) => cur.map((x) => x.id === p.id ? { ...x, status: "done", progress: 100 } : x));
      toast.success(`Ingested: ${p.file.name}`);
      refresh();
    } catch (e) {
      const msg = (e as Error).message;
      setPending((cur) => cur.map((x) => x.id === p.id ? { ...x, status: "error", error: msg } : x));
      const m = msg.toLowerCase();
      const isOracle = m.includes("oracle") || m.includes("oci") || m.includes("objectstorage") || m.includes("bucket") || m.includes("namespace");
      const isAuth = m.includes("not signed in") || m.includes("401") || m.includes("jwt");
      const isNet = m.includes("network") || m.includes("failed to fetch");
      showMessage({
        severity: "error",
        title: isOracle ? "Oracle storage rejected the upload"
              : isAuth ? "Sign-in expired"
              : isNet ? "Network dropped mid-upload"
              : `Couldn't ingest "${p.file.name}"`,
        message:
          (isOracle
            ? `Camera-to-Cloud reached the StreamVista backend, but Oracle Object Storage returned an error.\n\nReason: ${msg}\n\nThe file is still on your device — retry once Oracle is reachable, or report this so an admin can verify the bucket credentials.`
            : isAuth
            ? `Your session expired before "${p.file.name}" finished ingesting. Sign in again and retry — nothing was lost.`
            : isNet
            ? `The network dropped while streaming "${p.file.name}" to the cloud bridge.\n\nReason: ${msg}\n\nReconnect and try again, or report this so we can investigate.`
            : `The ingest pipeline failed for "${p.file.name}".\n\nReason: ${msg}\n\nRetry, or report this so an admin can take a look.`),
        context: `file=${p.file.name}; size=${p.file.size}; mime=${p.file.type}; pendingId=${p.id}`,
        // Re-attempt the same pendingId with the same File handle. Skip for auth errors
        // (user must sign in again first) — the modal still surfaces the issue.
        extraAction: isAuth ? undefined : {
          label: "Retry upload",
          onClick: () => { void uploadOne(p); },
        },
      });
    }
  }, [refresh, showMessage, activeId]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    if (!activeId) {
      toast.error("Pick a workspace before uploading");
      return;
    }
    if (!canWriteActive) {
      toast.error("You only have viewer access to this workspace");
      return;
    }
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const items: Pending[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f, progress: 0, status: "queued",
    }));
    setPending((cur) => [...items, ...cur].slice(0, 30));
    items.forEach((it) => uploadOne(it));
  }, [uploadOne, activeId, canWriteActive]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            Camera-to-Cloud Ingest
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drop footage, audio, RAW or proxies — streamed to Oracle OCI Object Storage with cryptographic integrity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {workspaces.length > 0 && (
            <Select value={activeId ?? ""} onValueChange={(v) => setActiveId(v)}>
              <SelectTrigger className="h-9 w-[220px] text-xs">
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
          <Button variant="outline" size="sm" onClick={refresh} disabled={loadingList || !activeId}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingList && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!activeId && (
        <Card className="p-4 text-sm text-muted-foreground border-amber-500/30 bg-amber-500/5">
          Pick a workspace above to start routing camera-to-cloud uploads into its isolated OCI prefix.
        </Card>
      )}
      {activeId && !canWriteActive && (
        <Card className="p-4 text-sm text-muted-foreground border-destructive/30 bg-destructive/5">
          You only have viewer access to this workspace. Switch to one where you are owner, admin, or editor to upload.
        </Card>
      )}

      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer overflow-hidden border-2 border-dashed transition-all",
          "bg-gradient-to-br from-background via-background to-primary/5",
          "p-12 text-center hover:border-primary/60 hover:shadow-[0_0_60px_-20px_hsl(var(--primary)/0.6)]",
          dragOver ? "border-primary scale-[1.01] shadow-[0_0_80px_-15px_hsl(var(--primary)/0.7)]" : "border-border/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
          <UploadCloud className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-xl font-semibold">Drop files to ingest</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          or <span className="text-primary underline-offset-4 hover:underline">browse from device</span> · up to 5 GB per file
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">ProRes · H.265 · RAW · WAV · MP4</Badge>
          <Badge variant="outline">SHA-256 verified</Badge>
        </div>
      </Card>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Active ingest</h3>
          {pending.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center gap-3">
                <FileVideo className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{p.file.name}</div>
                    <div className="text-xs text-muted-foreground shrink-0">{fmtSize(p.file.size)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={p.progress} className="h-1.5" />
                    <div className="w-20 text-right text-xs">
                      {p.status === "uploading" && (
                        <span className="flex items-center justify-end gap-1 text-primary">
                          <Loader2 className="h-3 w-3 animate-spin" /> {p.progress}%
                        </span>
                      )}
                      {p.status === "done" && (
                        <span className="flex items-center justify-end gap-1 text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      )}
                      {p.status === "error" && (
                        <span className="flex items-center justify-end gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Failed
                        </span>
                      )}
                      {p.status === "queued" && <span className="text-muted-foreground">Queued…</span>}
                    </div>
                  </div>
                  {p.error && <div className="mt-1 text-xs text-destructive">{p.error}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Recent uploads</h3>
        {recent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No uploads yet — drop your first take above.
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileVideo className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtSize(r.file_size)} · {r.region} · {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {r.status === "uploaded" && <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Ingested</Badge>}
                {r.status === "uploading" && <Badge variant="outline" className="text-primary">Uploading…</Badge>}
                {r.status === "failed" && (
                  <Badge variant="destructive" title={r.error_message ?? ""}>Failed</Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
