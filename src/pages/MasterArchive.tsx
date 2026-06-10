import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Archive, Film, Music2, FileText, Upload, Loader2, Building2,
  CheckCircle2, FolderOpen, Layers, Sparkles, ClipboardCheck, Circle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStorageQuota, StorageWarningBanner } from "@/hooks/useStorageQuota";

/**
 * Master Archive Vault
 * ────────────────────
 * Final-master file routing. STRICTLY for finished/delivery assets.
 *
 *  • Reel-wise loading (Reel 01 … Reel N)
 *  • Pre-organized 3 categories x sub-folders
 *  • Uploads route to the existing `oci-upload` edge function with a
 *    deterministic `category` string so OCI keys land in:
 *      workspaces/{ws}/projects/{proj}/{archive_<cat>_<sub>_reel-XX}/users/{uid}/...
 *    Multi-tenant isolation + RLS already enforced by the function.
 *
 * No new edge functions, no new credits, no new tables.
 */

type Project = {
  id: string;
  name: string;
  workspace_id: string;
};

type FolderSpec = {
  key: string;
  label: string;
  icon: typeof Film;
  subfolders: string[];
};

const FOLDERS: FolderSpec[] = [
  {
    key: "video_masters",
    label: "Video Masters",
    icon: Film,
    subfolders: ["DPX", "J2K", "ProRes", "Single MOV"],
  },
  {
    key: "audio_masters",
    label: "Audio Masters",
    icon: Music2,
    subfolders: ["STEMS", "MIDI", "AUDIO", "BGM", "STEREO", "ATMOS", "DTX", "OTT MIXED", "Track by Track"],
  },
  {
    key: "assets_docs",
    label: "Assets & Docs",
    icon: FileText,
    subfolders: [
      "PDF", "DOC", "PNG", "JPG", "TIF", "SUBTITLES", "STILLS",
      "CERTIFICATES", "SONGS", "IT TRACKS", "CG FILES", "CARDS", "LUT",
    ],
  },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type UploadStatus = "queued" | "uploading" | "processing" | "completed" | "failed";
type UploadStat = { name: string; status: UploadStatus; error?: string; category: string; progress: number };

const STATUS_META: Record<UploadStatus, { label: string; dotClass: string; badgeClass: string; barClass: string }> = {
  queued: {
    label: "Queued",
    dotClass: "bg-muted-foreground/70",
    badgeClass: "border-border/60 bg-muted/30 text-muted-foreground",
    barClass: "bg-muted-foreground/40",
  },
  uploading: {
    label: "Uploading",
    dotClass: "bg-accent animate-pulse",
    badgeClass: "border-accent/40 bg-accent/10 text-accent",
    barClass: "bg-gradient-to-r from-accent via-primary to-accent shadow-[0_0_12px_hsl(var(--accent)/0.7)]",
  },
  processing: {
    label: "Processing",
    dotClass: "bg-primary animate-pulse",
    badgeClass: "border-primary/40 bg-primary/10 text-primary",
    barClass: "bg-gradient-to-r from-primary via-accent to-primary animate-pulse",
  },
  completed: {
    label: "Completed",
    dotClass: "bg-accent",
    badgeClass: "border-accent/50 bg-accent/15 text-accent",
    barClass: "bg-accent",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-destructive",
    badgeClass: "border-destructive/50 bg-destructive/15 text-destructive",
    barClass: "bg-destructive",
  },
};

/**
 * Bridge checklist with its canonical destination folder.
 * `target` is what we pre-select in the folder picker on click, and
 * `categoryMatchers` is what we match against `recent_uploads.category`
 * (which is `archive-<folder>-<sub-slug>-reel-XX`) to auto-tick.
 */
const BRIDGE_CHECKLIST: {
  key: string;
  label: string;
  hint: string;
  target: { folder: string; sub: string };
  categoryMatchers: { folder: string; subs: string[] }; // any sub-slug counts
}[] = [
  { key: "golden_master", label: "Golden Master Video File", hint: "ProRes / High-Res",
    target: { folder: "video_masters", sub: "ProRes" },
    categoryMatchers: { folder: "video_masters", subs: ["prores", "dpx", "j2k"] } },
  { key: "audio_stems", label: "Separated Audio Stems", hint: "Dialogue, Music, Effects",
    target: { folder: "audio_masters", sub: "STEMS" },
    categoryMatchers: { folder: "audio_masters", subs: ["stems", "track-by-track", "atmos", "stereo"] } },
  { key: "subtitles", label: "Subtitles & Closed Captions", hint: "SRT / VTT",
    target: { folder: "assets_docs", sub: "SUBTITLES" },
    categoryMatchers: { folder: "assets_docs", subs: ["subtitles"] } },
  { key: "artwork", label: "High-Res Marketing Artwork & Posters", hint: "Key art, banners",
    target: { folder: "assets_docs", sub: "STILLS" },
    categoryMatchers: { folder: "assets_docs", subs: ["stills", "png", "jpg", "tif"] } },
  { key: "trailer", label: "Official Trailer & Promos", hint: "Teasers, BTS",
    target: { folder: "video_masters", sub: "Single MOV" },
    categoryMatchers: { folder: "video_masters", subs: ["single-mov"] } },
  { key: "metadata", label: "Metadata & Synopsis Form", hint: "Title, logline, cast",
    target: { folder: "assets_docs", sub: "PDF" },
    categoryMatchers: { folder: "assets_docs", subs: ["pdf", "doc", "cards"] } },
  { key: "rights", label: "Rights & Licensing Agreements", hint: "Music, talent, footage",
    target: { folder: "assets_docs", sub: "CERTIFICATES" },
    categoryMatchers: { folder: "assets_docs", subs: ["certificates", "doc"] } },
];

/** Does this `recent_uploads.category` satisfy a checklist item? */
function categorySatisfies(category: string | null, item: typeof BRIDGE_CHECKLIST[number]): boolean {
  if (!category) return false;
  const prefix = `archive-${item.categoryMatchers.folder}-`;
  if (!category.startsWith(prefix)) return false;
  const rest = category.slice(prefix.length); // "<sub-slug>-reel-XX"
  return item.categoryMatchers.subs.some((s) => rest.startsWith(`${s}-reel-`));
}

export default function MasterArchive() {
  const { user } = useAuth();
  const { workspaces, active, activeId, setActiveId, loading: wsLoading } = useWorkspaces();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [reel, setReel] = useState<string>("01");
  const [selected, setSelected] = useState<{ folder: string; sub: string } | null>(null);
  const [uploads, setUploads] = useState<UploadStat[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const quota = useStorageQuota();

  useEffect(() => {
    if (!user || !activeId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("projects")
        .select("id,name,workspace_id")
        .eq("workspace_id", activeId)
        .order("created_at", { ascending: false });
      setProjects((data ?? []) as Project[]);
      if (data?.[0] && !projectId) setProjectId(data[0].id);
    })();
  }, [user?.id, activeId]);

  const currentCategory = useMemo(() => {
    if (!selected) return "";
    const reelTag = `reel-${reel.padStart(2, "0")}`;
    return `archive-${selected.folder}-${slug(selected.sub)}-${reelTag}`;
  }, [selected, reel]);

  const pickFiles = () => { if (quota.checkOrPaywall()) fileInput.current?.click(); };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!quota.checkOrPaywall()) return;
    if (!activeId) return toast.error("Pick a workspace first");
    if (!selected) return toast.error("Pick a destination folder first");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Session expired — sign in again");

    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;

    // ── Duplicate check: same workspace + category (+ project if scoped) + filename ──
    const incomingNames = Array.from(files).map((f) => f.name);
    let existingNames = new Set<string>();
    try {
      let q = (supabase as any)
        .from("recent_uploads")
        .select("file_name")
        .eq("workspace_id", activeId)
        .eq("category", currentCategory)
        .in("file_name", incomingNames)
        .in("status", ["completed", "uploading", "processing", "queued"]);
      if (projectId) q = q.eq("project_id", projectId);
      const { data: existing } = await q;
      existingNames = new Set((existing ?? []).map((r: any) => r.file_name as string));
    } catch {
      existingNames = new Set();
    }

    // Also dedupe against in-session uploads still active or completed
    const sessionNames = new Set(
      uploads
        .filter((u) => u.category === currentCategory
          && (u.status === "queued" || u.status === "uploading" || u.status === "processing" || u.status === "completed"))
        .map((u) => u.name),
    );

    const filesToUpload: File[] = [];
    const blockedNames: string[] = [];
    for (const f of Array.from(files)) {
      if (existingNames.has(f.name) || sessionNames.has(f.name)) blockedNames.push(f.name);
      else filesToUpload.push(f);
    }

    if (blockedNames.length > 0) {
      const preview = blockedNames.slice(0, 3).join(", ");
      const more = blockedNames.length > 3 ? ` +${blockedNames.length - 3} more` : "";
      toast.error("This file already exists in the selected folder.", {
        description: `Blocked ${blockedNames.length} duplicate${blockedNames.length > 1 ? "s" : ""}: ${preview}${more}`,
        duration: 6000,
      });
    }

    if (filesToUpload.length === 0) return;

    // Enqueue remaining files so the user sees the full batch in "Queued" state
    const queued: UploadStat[] = filesToUpload.map((f) => ({
      name: f.name, status: "queued", category: currentCategory, progress: 0,
    }));
    setUploads((u) => [...queued, ...u]);

    for (let i = 0; i < queued.length; i++) {
      const stat = queued[i];
      const f = filesToUpload[i];
      setUploads((u) => u.map((x) => x === stat ? { ...x, status: "uploading" } : x));
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("workspaceId", activeId);
        fd.append("category", currentCategory);
        if (projectId) fd.append("projectId", projectId);
        fd.append("pendingId", `archive-${currentCategory}-${Date.now()}-${f.name}`);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
          xhr.upload.onprogress = (ev) => {
            if (!ev.lengthComputable) return;
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setUploads((u) => u.map((x) => x === stat ? { ...x, progress: pct } : x));
          };
          xhr.upload.onload = () => {
            setUploads((u) => u.map((x) => x === stat ? { ...x, status: "processing", progress: 100 } : x));
          };
          xhr.onload = () => {
            try {
              const json = JSON.parse(xhr.responseText || "{}");
              if (xhr.status < 200 || xhr.status >= 300 || json?.error) {
                return reject(new Error(json?.error ?? `HTTP ${xhr.status}`));
              }
              resolve();
            } catch (e) { reject(e as Error); }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(fd);
        });

        setUploads((u) => u.map((x) => x === stat ? { ...x, status: "completed", progress: 100 } : x));
        // Checklist auto-tick is driven by the recent_uploads realtime
        // subscription below, so no local state mutation is needed here.
      } catch (e) {
        setUploads((u) => u.map((x) => x === stat ? { ...x, status: "failed", error: (e as Error).message } : x));
      }
    }
    toast.success("Archive upload complete");
  };
        setUploads((u) => u.map((x) => x === stat ? { ...x, status: "failed", error: (e as Error).message } : x));
      }
    }
    toast.success("Archive upload complete");
  };

  // Crayons Bridge checklist (per-project, persisted locally)
  const checklistKey = projectId ? `crayons-bridge-checklist:${projectId}` : "crayons-bridge-checklist:none";
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(checklistKey);
      setChecklist(raw ? JSON.parse(raw) : {});
    } catch { setChecklist({}); }
  }, [checklistKey]);
  const toggleCheck = (key: string) => {
    setChecklist((c) => {
      const next = { ...c, [key]: !c[key] };
      try { localStorage.setItem(checklistKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const checkedCount = BRIDGE_CHECKLIST.filter((i) => checklist[i.key]).length;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-30 backdrop-blur bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Projects
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-display font-bold text-lg inline-flex items-center gap-2">
              <Archive className="w-5 h-5 text-accent" /> Final Master Archive Vault
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {workspaces.length > 0 && (
              <Select value={activeId ?? ""} onValueChange={setActiveId}>
                <SelectTrigger className="h-9 w-[200px] text-xs">
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </header>

      <section className="container py-6">
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold">For finished projects only</h2>
              <p className="text-xs text-muted-foreground max-w-2xl mt-1">
                Use this vault for final delivery masters (business + sales). Files route into pre-organized
                category folders on C CLOUD, isolated to <b>{active?.name ?? "your workspace"}</b>. RLS keeps them
                private to your team.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6"><StorageWarningBanner /></div>


        {/* Project + Reel selector */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-10 mt-1">
                <FolderOpen className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder={projects.length ? "Pick a project" : "No projects in this workspace"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reel</Label>
            <div className="flex items-center gap-2 mt-1">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <Input
                value={reel}
                onChange={(e) => setReel(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                placeholder="01"
                className="h-10 w-24 font-mono"
              />
              <span className="text-xs text-muted-foreground">
                Reel-wise loading: each upload tagged <b className="font-mono">reel-{reel.padStart(2, "0")}</b>.
              </span>
            </div>
          </div>
        </div>

        {/* Folder grid */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.key} className="rounded-2xl border border-border/50 bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-accent" />
                  <h3 className="font-display font-bold text-sm">{f.label}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.subfolders.map((s) => {
                    const isActive = selected?.folder === f.key && selected?.sub === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelected({ folder: f.key, sub: s })}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider border transition-colors",
                          isActive
                            ? "bg-gradient-primary text-primary-foreground border-transparent glow-primary"
                            : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/50",
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload zone */}
        <div className={cn(
          "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          selected ? "border-accent/50 bg-accent/5" : "border-border/50 bg-muted/20",
        )}>
          {selected ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">Destination</p>
              <p className="font-mono text-sm mb-4">
                <Badge variant="outline" className="mr-1">{FOLDERS.find(x => x.key === selected.folder)?.label}</Badge>
                <Badge variant="outline" className="mr-1">{selected.sub}</Badge>
                <Badge variant="outline">reel-{reel.padStart(2, "0")}</Badge>
              </p>
              <Button onClick={pickFiles} size="lg" className="gap-2" disabled={!activeId || wsLoading || quota.locked}>
                <Upload className="w-4 h-4" /> {quota.locked ? "Storage full — upgrade to upload" : "Upload to this folder"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
              />
              <p className="text-[11px] text-muted-foreground mt-3 font-mono">
                Path: workspaces/{(activeId ?? "…").slice(0, 8)}…/{projectId ? `projects/${projectId.slice(0, 8)}…/` : ""}{currentCategory}/
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a destination folder above to start uploading masters.
            </p>
          )}
        </div>

        {/* Recent uploads list */}
        {uploads.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">This session</h3>
            <div className="space-y-2">
              {uploads.map((u, i) => {
                const meta = STATUS_META[u.status];
                const isActive = u.status === "uploading" || u.status === "processing" || u.status === "queued";
                const showPct = u.status === "uploading" || u.status === "processing";
                const barWidth = u.status === "failed" || u.status === "completed" ? 100
                  : u.status === "queued" ? 4 : u.progress;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative overflow-hidden rounded-xl border backdrop-blur-md transition-all",
                      "border-border/50 bg-card/40",
                      u.status === "uploading" && "opacity-50 border-accent/40",
                      u.status === "processing" && "opacity-60 border-primary/40",
                      u.status === "queued" && "opacity-70",
                      u.status === "completed" && "border-accent/30",
                      u.status === "failed" && "border-destructive/40",
                    )}
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-sm relative z-10">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {u.status === "uploading" || u.status === "processing"
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
                          : u.status === "completed"
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                          : u.status === "failed"
                          ? <span className="w-3.5 h-3.5 rounded-full bg-destructive shrink-0" />
                          : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className="truncate font-medium">{u.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showPct && (
                          <span className="font-mono text-xs tabular-nums text-accent tracking-wider">
                            {u.progress.toString().padStart(2, "0")}%
                          </span>
                        )}
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider",
                          meta.badgeClass,
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", meta.dotClass)} />
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    {/* Cinematic scoreboard progress bar */}
                    <div className="h-1 w-full bg-muted/40">
                      <div
                        className={cn("h-full transition-all duration-200 ease-out", meta.barClass)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {u.error && (
                      <p className="px-4 pb-2 text-[10px] font-mono text-destructive truncate">{u.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Crayons Bridge — Master Files Checklist */}
        <div className="mt-8 rounded-2xl border border-accent/30 bg-card/40 backdrop-blur-xl p-5 shadow-[0_8px_32px_-12px_hsl(var(--accent)/0.3)]">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/30 to-primary/20 grid place-items-center border border-accent/40">
                <ClipboardCheck className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm">Crayons Bridge — Master Files Checklist</h3>
                <p className="text-[11px] text-muted-foreground">Business deliverables required before handoff</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-accent">
                {checkedCount.toString().padStart(2, "0")}/{BRIDGE_CHECKLIST.length.toString().padStart(2, "0")}
              </span>
              <div className="w-24 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-primary transition-all"
                  style={{ width: `${(checkedCount / BRIDGE_CHECKLIST.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {BRIDGE_CHECKLIST.map((item) => {
              const done = !!checklist[item.key];
              return (
                <li key={item.key}>
                  <button
                    onClick={() => toggleCheck(item.key)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all",
                      "backdrop-blur-sm",
                      done
                        ? "border-accent/50 bg-accent/10 shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.2)]"
                        : "border-border/50 bg-background/30 hover:border-accent/40 hover:bg-accent/5",
                    )}
                  >
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium leading-snug", done && "text-accent")}>{item.label}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{item.hint}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
