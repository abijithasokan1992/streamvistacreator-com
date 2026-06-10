import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Archive, Film, Music2, FileText, Upload, Loader2, Building2,
  CheckCircle2, FolderOpen, Layers, Sparkles,
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

type UploadStat = { name: string; status: "uploading" | "done" | "failed"; error?: string; category: string };

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

    for (const f of Array.from(files)) {
      const stat: UploadStat = { name: f.name, status: "uploading", category: currentCategory };
      setUploads((u) => [stat, ...u]);
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("workspaceId", activeId);
        fd.append("category", currentCategory);
        if (projectId) fd.append("projectId", projectId);
        fd.append("pendingId", `archive-${currentCategory}-${Date.now()}-${f.name}`);
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.error) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setUploads((u) => u.map((x) => x === stat ? { ...x, status: "done" } : x));
      } catch (e) {
        setUploads((u) => u.map((x) => x === stat ? { ...x, status: "failed", error: (e as Error).message } : x));
      }
    }
    toast.success("Archive upload complete");
  };

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
                category folders on OCI, isolated to <b>{active?.name ?? "your workspace"}</b>. RLS keeps them
                private to your team.
              </p>
            </div>
          </div>
        </div>

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
            <div className="rounded-xl border border-border/50 divide-y divide-border/50">
              {uploads.map((u, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.status === "uploading" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      : u.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                      : <span className="w-3.5 h-3.5 rounded-full bg-destructive" />}
                    <span className="truncate">{u.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[40%]">
                    {u.error ?? u.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
