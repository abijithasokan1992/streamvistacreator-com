import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Archive, Film, Music2, FileText, Upload, Loader2, Building2,
  CheckCircle2, FolderOpen, Layers, Sparkles, ClipboardCheck, Circle,
  Shield, Check, X, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
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
  const { user, isAdmin, role } = useAuth();
  const { workspaces, active, activeId, setActiveId, loading: wsLoading } = useWorkspaces();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [reel, setReel] = useState<string>("01");
  const [selected, setSelected] = useState<{ folder: string; sub: string } | null>(null);
  const [uploads, setUploads] = useState<UploadStat[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const quota = useStorageQuota();

  // Admin = global admin OR workspace owner/admin. UI gate only; RLS enforces server-side.
  const canManageChecklist = isAdmin
    || active?.role === "owner"
    || active?.role === "admin";


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

  // ── Crayons Bridge checklist (DB-derived, live) ─────────────────────────────
  // Each item is ticked when at least one `recent_uploads` row exists for this
  // workspace (+ project, if scoped) whose `category` matches the item's
  // canonical destination subfolders and whose status is finalised.
  const [satisfiedCounts, setSatisfiedCounts] = useState<Record<string, number>>({});

  const recomputeChecklist = useMemo(() => async () => {
    if (!activeId) { setSatisfiedCounts({}); return; }
    let q = (supabase as any)
      .from("recent_uploads")
      .select("category,status")
      .eq("workspace_id", activeId)
      .in("status", ["uploaded", "completed"])
      .like("category", "archive-%")
      .limit(1000);
    if (projectId) q = q.eq("project_id", projectId);
    const { data } = await q;
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { category: string | null }[]) {
      for (const item of BRIDGE_CHECKLIST) {
        if (categorySatisfies(row.category, item)) {
          counts[item.key] = (counts[item.key] ?? 0) + 1;
        }
      }
    }
    setSatisfiedCounts(counts);
  }, [activeId, projectId]);

  useEffect(() => { void recomputeChecklist(); }, [recomputeChecklist]);

  // Live updates: whenever a recent_uploads row for this workspace/project
  // changes, recompute. We re-query (vs. patching) so deletes drop counts
  // correctly and the source of truth stays the database.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`bridge-checklist-${activeId}-${projectId || "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recent_uploads", filter: `workspace_id=eq.${activeId}` },
        () => { void recomputeChecklist(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, projectId, recomputeChecklist]);

  // ── Admin overrides (force-complete / force-incomplete) ──────────────────────
  // Read by all workspace members so the forced state shows for everyone.
  // Writes are RLS-restricted to global admins, workspace owners/admins, and
  // the super admin. The DB-driven auto-sync above is untouched: overrides
  // simply *win* over the computed counts when present.
  type OverrideState = "forced_complete" | "forced_incomplete";
  type OverrideRow = {
    id: string;
    checklist_key: string;
    state: OverrideState;
    note: string | null;
    set_by_email: string | null;
    project_id: string | null;
  };
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});

  const loadOverrides = useMemo(() => async () => {
    if (!activeId) { setOverrides({}); return; }
    let q = (supabase as any)
      .from("checklist_overrides")
      .select("id,checklist_key,state,note,set_by_email,project_id")
      .eq("workspace_id", activeId);
    if (projectId) q = q.or(`project_id.eq.${projectId},project_id.is.null`);
    else q = q.is("project_id", null);
    const { data } = await q;
    const map: Record<string, OverrideRow> = {};
    for (const row of (data ?? []) as OverrideRow[]) {
      // Project-scoped wins over workspace-wide for the same key.
      const existing = map[row.checklist_key];
      if (!existing || (row.project_id && !existing.project_id)) {
        map[row.checklist_key] = row;
      }
    }
    setOverrides(map);
  }, [activeId, projectId]);

  useEffect(() => { void loadOverrides(); }, [loadOverrides]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`checklist-overrides-${activeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_overrides", filter: `workspace_id=eq.${activeId}` },
        () => { void loadOverrides(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, loadOverrides]);

  const isItemDone = (key: string): boolean => {
    const ov = overrides[key];
    if (ov?.state === "forced_complete") return true;
    if (ov?.state === "forced_incomplete") return false;
    return (satisfiedCounts[key] ?? 0) > 0;
  };

  const setOverride = async (key: string, state: OverrideState) => {
    if (!activeId || !canManageChecklist) return;
    const payload = {
      workspace_id: activeId,
      project_id: projectId || null,
      checklist_key: key,
      state,
      set_by: user?.id ?? null,
      set_by_email: user?.email ?? null,
    };
    const { error } = await (supabase as any)
      .from("checklist_overrides")
      .upsert(payload, { onConflict: "workspace_id,project_id,checklist_key" });
    if (error) {
      toast.error("Override failed", { description: error.message });
      return;
    }
    toast.success(state === "forced_complete" ? "Marked complete" : "Marked incomplete");
    void loadOverrides();
  };

  const clearOverride = async (key: string) => {
    if (!activeId || !canManageChecklist) return;
    const existing = overrides[key];
    if (!existing) return;
    const { error } = await (supabase as any)
      .from("checklist_overrides")
      .delete()
      .eq("id", existing.id);
    if (error) {
      toast.error("Could not clear override", { description: error.message });
      return;
    }
    toast.success("Override cleared — auto-sync restored");
    void loadOverrides();
  };

  const checkedCount = BRIDGE_CHECKLIST.filter((i) => isItemDone(i.key)).length;

  // Clicking a checklist row pre-selects its canonical destination so the
  // admin can drop straight into the right folder without hunting for it.
  const selectChecklistTarget = (item: typeof BRIDGE_CHECKLIST[number]) => {
    setSelected({ folder: item.target.folder, sub: item.target.sub });
    toast.message(`Destination set → ${item.target.sub}`, {
      description: `Ready to ingest "${item.label}".`,
    });
  };


  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-30 backdrop-blur bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to={dashboardForRole(role)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Dashboard
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
                <Upload className="w-4 h-4" /> {quota.locked ? "Storage full — request more storage" : "Upload to this folder"}
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
          {canManageChecklist && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-accent" />
              Admin override mode — force-tick, undo, or restore auto-sync per item
            </p>
          )}
          <ul className="grid sm:grid-cols-2 gap-2">
            {BRIDGE_CHECKLIST.map((item) => {
              const count = satisfiedCounts[item.key] ?? 0;
              const ov = overrides[item.key];
              const done = isItemDone(item.key);
              const isForced = !!ov;
              const isTargetActive = selected?.folder === item.target.folder && selected?.sub === item.target.sub;
              return (
                <li key={item.key}>
                  <div
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-3 transition-all backdrop-blur-sm",
                      done
                        ? "border-accent/50 bg-accent/10 shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.2)]"
                        : "border-border/50 bg-background/30 hover:border-accent/40 hover:bg-accent/5",
                      isTargetActive && "ring-1 ring-primary/50",
                      isForced && "ring-1 ring-accent/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectChecklistTarget(item)}
                      title={done ? `Click to set destination → ${item.target.sub}` : `Click to pre-select → ${item.target.sub}`}
                      className="w-full text-left flex items-start gap-3"
                    >
                      {done
                        ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm font-medium leading-snug", done && "text-accent")}>{item.label}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {count > 0 && (
                              <span className="font-mono text-[10px] text-accent tabular-nums">×{count}</span>
                            )}
                            {isForced && (
                              <span className={cn(
                                "font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                ov.state === "forced_complete"
                                  ? "border-accent/50 bg-accent/15 text-accent"
                                  : "border-destructive/50 bg-destructive/10 text-destructive",
                              )}>
                                {ov.state === "forced_complete" ? "Forced ✓" : "Forced ✗"}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {item.hint} · → {item.target.sub}
                          {isForced && ov.set_by_email && (
                            <span className="ml-1 opacity-70">· by {ov.set_by_email}</span>
                          )}
                        </p>
                      </div>
                    </button>

                    {canManageChecklist && (
                      <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant={ov?.state === "forced_complete" ? "default" : "outline"}
                          className="h-7 px-2 text-[10px] gap-1 font-mono uppercase tracking-wider"
                          onClick={(e) => { e.stopPropagation(); void setOverride(item.key, "forced_complete"); }}
                        >
                          <Check className="w-3 h-3" /> Force ✓
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={ov?.state === "forced_incomplete" ? "destructive" : "outline"}
                          className="h-7 px-2 text-[10px] gap-1 font-mono uppercase tracking-wider"
                          onClick={(e) => { e.stopPropagation(); void setOverride(item.key, "forced_incomplete"); }}
                        >
                          <X className="w-3 h-3" /> Undo
                        </Button>
                        {isForced && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] gap-1 font-mono uppercase tracking-wider text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); void clearOverride(item.key); }}
                          >
                            <RotateCcw className="w-3 h-3" /> Auto
                          </Button>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                          auto: {count > 0 ? `${count} file${count === 1 ? "" : "s"}` : "none"}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

        </div>
      </section>
    </main>
  );
}
