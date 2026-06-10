import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Pencil, Trash2, Loader2, Film, ArrowLeft, Building2, Share2,
  Sparkles, ChevronDown, ChevronUp, Upload, FileText, X, Settings2,
  Wand2, Mic2, FileSignature, PackageCheck, FolderTree,
} from "lucide-react";
import ShareReviewModal from "@/components/projects/ShareReviewModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces, type Workspace } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StorageUsageCard from "@/components/dashboard/StorageUsageCard";
import CreatorPlanCard from "@/components/dashboard/CreatorPlanCard";

type CrewMember = { name: string; email: string; role: string };

type Project = {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  crew: CrewMember[] | null;
  script_url: string | null;
  script_object_key: string | null;
  camera_brand: string | null;
  lens_brand: string | null;
  capture_format: string | null;
  resolution: string | null;
  schedule_charting: string | null;
  schedule_artists: string | null;
  schedule_equipment: string | null;
  foldering_mode_archive: "manual" | "automated" | string;
  foldering_mode_raw: "manual" | "automated" | string;
};

type FormState = {
  name: string;
  description: string;
  workspace_id: string;
  crew: CrewMember[];
  script_url: string;
  script_object_key: string;
  camera_brand: string;
  lens_brand: string;
  capture_format: string;
  resolution: string;
  schedule_charting: string;
  schedule_artists: string;
  schedule_equipment: string;
  foldering_mode_archive: "manual" | "automated";
  foldering_mode_raw: "manual" | "automated";
};

const emptyForm: FormState = {
  name: "", description: "", workspace_id: "",
  crew: [], script_url: "", script_object_key: "",
  camera_brand: "", lens_brand: "", capture_format: "", resolution: "",
  schedule_charting: "", schedule_artists: "", schedule_equipment: "",
  foldering_mode_archive: "automated", foldering_mode_raw: "automated",
};

export default function Projects() {
  const { user } = useAuth();
  const { workspaces, active, activeId, setActiveId, loading: wsLoading, createWorkspace, renameWorkspace } = useWorkspaces();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const canRenameActive = !!active && (active.role === "owner" || active.role === "admin");
  const openRename = () => { if (!active) return; setRenameValue(active.name); setRenameOpen(true); };
  const submitRename = async () => {
    if (!active) return;
    setRenaming(true);
    const ok = await renameWorkspace(active.id, renameValue);
    setRenaming(false);
    if (!ok) return toast.error("Couldn't rename workspace");
    toast.success("Workspace renamed");
    setRenameOpen(false);
  };

  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadingScript, setUploadingScript] = useState(false);

  // Create-workspace inline UI
  const [newWsName, setNewWsName] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);

  const workspaceName = (id: string) =>
    workspaces.find((w) => w.id === id)?.name ?? "Unknown workspace";

  const writableWorkspaces: Workspace[] = workspaces.filter(
    (w) => w.role === "owner" || w.role === "admin" || w.role === "editor",
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(((data ?? []) as unknown) as Project[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    const defaultWs = activeId && writableWorkspaces.some((w) => w.id === activeId)
      ? activeId : writableWorkspaces[0]?.id ?? "";
    setForm({ ...emptyForm, workspace_id: defaultWs });
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      workspace_id: p.workspace_id,
      crew: Array.isArray(p.crew) ? p.crew : [],
      script_url: p.script_url ?? "",
      script_object_key: p.script_object_key ?? "",
      camera_brand: p.camera_brand ?? "",
      lens_brand: p.lens_brand ?? "",
      capture_format: p.capture_format ?? "",
      resolution: p.resolution ?? "",
      schedule_charting: p.schedule_charting ?? "",
      schedule_artists: p.schedule_artists ?? "",
      schedule_equipment: p.schedule_equipment ?? "",
      foldering_mode_archive: (p.foldering_mode_archive === "manual" ? "manual" : "automated"),
      foldering_mode_raw: (p.foldering_mode_raw === "manual" ? "manual" : "automated"),
    });
    setShowAdvanced(true);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) return toast.error("Project name is required");
    if (!form.workspace_id) return toast.error("Production banner (workspace) is required");

    setSaving(true);
    const payload: Record<string, any> = {
      name,
      description: form.description.trim() || null,
      workspace_id: form.workspace_id,
      crew: form.crew.filter((c) => c.name.trim() || c.email.trim() || c.role.trim()),
      script_url: form.script_url.trim() || null,
      script_object_key: form.script_object_key.trim() || null,
      camera_brand: form.camera_brand.trim() || null,
      lens_brand: form.lens_brand.trim() || null,
      capture_format: form.capture_format.trim() || null,
      resolution: form.resolution.trim() || null,
      schedule_charting: form.schedule_charting.trim() || null,
      schedule_artists: form.schedule_artists.trim() || null,
      schedule_equipment: form.schedule_equipment.trim() || null,
      foldering_mode_archive: form.foldering_mode_archive,
      foldering_mode_raw: form.foldering_mode_raw,
    };

    let error;
    if (editing) {
      ({ error } = await (supabase as any).from("projects").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any).from("projects").insert({ ...payload, user_id: user.id }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success(editing ? "Project updated" : "Project created");
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  };

  const remove = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    const { error } = await (supabase as any).from("projects").delete().eq("id", p.id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    setRows((r) => r.filter((x) => x.id !== p.id));
  };

  const handleCreateWorkspace = async () => {
    const name = newWsName.trim();
    if (!name) return toast.error("Workspace name is required");
    setCreatingWs(true);
    const ws = await createWorkspace(name);
    setCreatingWs(false);
    if (!ws) return toast.error("Failed to create workspace");
    toast.success(`Workspace "${ws.name}" created`);
    setNewWsName("");
    setForm((f) => ({ ...f, workspace_id: ws.id }));
  };

  // Crew helpers
  const addCrew = () => setForm((f) => ({ ...f, crew: [...f.crew, { name: "", email: "", role: "" }] }));
  const updateCrew = (i: number, patch: Partial<CrewMember>) =>
    setForm((f) => ({ ...f, crew: f.crew.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const removeCrew = (i: number) =>
    setForm((f) => ({ ...f, crew: f.crew.filter((_, idx) => idx !== i) }));

  // Script upload → OCI via existing edge function (category=script)
  const uploadScript = async (file: File) => {
    if (!form.workspace_id) { toast.error("Pick a production banner first"); return; }
    if (!/\.(pdf|docx?|txt|rtf|fountain|fdx)$/i.test(file.name)) {
      toast.error("Use PDF, DOC/DOCX, TXT, RTF, FDX or Fountain");
      return;
    }
    setUploadingScript(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in expired");
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/oci-upload`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", form.workspace_id);
      fd.append("category", "script");
      if (editing?.id) fd.append("projectId", editing.id);
      fd.append("pendingId", `script-${Date.now()}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const key = json?.upload?.object_key ?? "";
      setForm((f) => ({ ...f, script_object_key: key, script_url: key ? `oci://${key}` : "" }));
      toast.success("Script uploaded to OCI");
    } catch (e) {
      toast.error(`Script upload failed: ${(e as Error).message}`);
    } finally {
      setUploadingScript(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-30 backdrop-blur bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-display font-bold text-lg">My Projects</h1>
          </div>
          <div className="flex items-center gap-2">
            {workspaces.length > 0 && (
              <Select value={activeId ?? ""} onValueChange={(v) => setActiveId(v)}>
                <SelectTrigger className="h-9 w-[200px] text-xs">
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  <SelectValue placeholder="Active workspace" />
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
            {active && canRenameActive && (
              <Button onClick={openRename} size="sm" variant="outline" className="h-9 px-2" title="Rename workspace">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            <Link to="/archive">
              <Button size="sm" variant="outline" className="gap-2">
                <FolderTree className="w-4 h-4" /> Master Archive
              </Button>
            </Link>
            <Button onClick={openCreate} size="sm" className="gap-2" disabled={writableWorkspaces.length === 0}>
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>
      </header>

      <section className="container pt-8">
        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 p-5 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Billing &amp; Upgrades</h2>
                <p className="text-xs text-muted-foreground">
                  Add cloud storage or upgrade your plan. Payments are processed securely via Razorpay and applied instantly.
                </p>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
            <CreatorPlanCard onPurchased={() => window.location.reload()} />
            <StorageUsageCard />
          </div>
        </div>
      </section>

      <section className="container pb-8">
        {loading || wsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border/60 rounded-xl p-10 text-center">
            <Film className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No projects yet. Create your first one to start routing assets.
            </p>
            <Button onClick={openCreate} className="gap-2" disabled={writableWorkspaces.length === 0}>
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => (
              <Card key={p.id} className="group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setDetailProject(p)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">{p.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Share for review" onClick={() => setShareProject(p)}>
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(p)} disabled={deletingId === p.id}>
                        {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit gap-1 text-[10px] font-mono uppercase tracking-wider">
                    <Building2 className="w-3 h-3" />
                    {workspaceName(p.workspace_id)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 min-h-[2.5rem]">
                    {p.description || "No description"}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.capture_format && <Badge variant="outline" className="text-[10px]">{p.capture_format}</Badge>}
                    {p.resolution && <Badge variant="outline" className="text-[10px]">{p.resolution}</Badge>}
                    {p.script_url && <Badge variant="outline" className="text-[10px] gap-1"><FileText className="w-2.5 h-2.5" />Script</Badge>}
                    {Array.isArray(p.crew) && p.crew.length > 0 && <Badge variant="outline" className="text-[10px]">{p.crew.length} crew</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-3">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle>
            <DialogDescription>
              Project name and banner are required. Everything else is optional and can be added later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project Name <span className="text-destructive">*</span></Label>
              <Input id="proj-name" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Untitled Feature 2026" maxLength={120} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-banner">Production Banner <span className="text-destructive">*</span></Label>
              <Select value={form.workspace_id}
                onValueChange={(v) => setForm((f) => ({ ...f, workspace_id: v }))}
                disabled={writableWorkspaces.length === 0}>
                <SelectTrigger id="proj-banner">
                  <SelectValue placeholder={writableWorkspaces.length ? "Select a banner…" : "No workspaces with write access"} />
                </SelectTrigger>
                <SelectContent>
                  {writableWorkspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">{w.role}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editing && (
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Need a new banner?</Label>
                <div className="flex gap-2">
                  <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="New workspace name" maxLength={80} />
                  <Button type="button" variant="outline" onClick={handleCreateWorkspace}
                    disabled={creatingWs || !newWsName.trim()}>
                    {creatingWs ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea id="proj-desc" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief logline or working notes (optional)" rows={2} maxLength={500} />
            </div>

            {/* Advanced toggle */}
            <Button type="button" variant="ghost" size="sm" className="w-full justify-between"
              onClick={() => setShowAdvanced((v) => !v)}>
              <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Pre-production, DIT &amp; tech specs (optional)</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {showAdvanced && (
              <div className="space-y-5 border border-border/60 rounded-lg p-4 bg-muted/20">
                {/* Crew */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Crew</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addCrew} className="h-7 gap-1">
                      <Plus className="w-3 h-3" /> Add member
                    </Button>
                  </div>
                  {form.crew.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No crew added yet. Optional — add directors, DPs, editors, etc.</p>
                  )}
                  {form.crew.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Input className="col-span-4" placeholder="Name" value={c.name} onChange={(e) => updateCrew(i, { name: e.target.value })} />
                      <Input className="col-span-3" placeholder="Role" value={c.role} onChange={(e) => updateCrew(i, { role: e.target.value })} />
                      <Input className="col-span-4" placeholder="email@studio.com" type="email" value={c.email} onChange={(e) => updateCrew(i, { email: e.target.value })} />
                      <Button type="button" size="icon" variant="ghost" className="col-span-1 h-9 w-9 text-destructive" onClick={() => removeCrew(i)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Script upload */}
                <div className="space-y-2">
                  <Label>Final Script (PDF / DOC)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.fdx,.fountain"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadScript(f); }}
                      disabled={uploadingScript || !form.workspace_id} />
                    {uploadingScript && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {form.script_object_key && (
                    <p className="text-[11px] text-emerald-500 break-all">✓ Uploaded: {form.script_object_key}</p>
                  )}
                </div>

                {/* Tech specs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Camera Brand</Label>
                    <Input placeholder="ARRI, RED, Sony…" value={form.camera_brand}
                      onChange={(e) => setForm((f) => ({ ...f, camera_brand: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lens Brand</Label>
                    <Input placeholder="Cooke, Zeiss, Atlas…" value={form.lens_brand}
                      onChange={(e) => setForm((f) => ({ ...f, lens_brand: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Capture Format</Label>
                    <Select value={form.capture_format || "none"}
                      onValueChange={(v) => setForm((f) => ({ ...f, capture_format: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="RAW">RAW</SelectItem>
                        <SelectItem value="ProRes">ProRes</SelectItem>
                        <SelectItem value="Proxy">Proxy</SelectItem>
                        <SelectItem value="H.265">H.265</SelectItem>
                        <SelectItem value="DNxHR">DNxHR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resolution</Label>
                    <Select value={form.resolution || "none"}
                      onValueChange={(v) => setForm((f) => ({ ...f, resolution: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="2K">2K</SelectItem>
                        <SelectItem value="4K">4K</SelectItem>
                        <SelectItem value="6K">6K</SelectItem>
                        <SelectItem value="8K">8K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Schedules */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Basic Charting / Shoot Schedule</Label>
                    <Textarea rows={2} placeholder="Day-wise charting notes…" value={form.schedule_charting}
                      onChange={(e) => setForm((f) => ({ ...f, schedule_charting: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Artist Schedules</Label>
                    <Textarea rows={2} placeholder="Cast call sheets and availability…" value={form.schedule_artists}
                      onChange={(e) => setForm((f) => ({ ...f, schedule_artists: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Equipment Schedules</Label>
                    <Textarea rows={2} placeholder="Camera, lighting & grip plan…" value={form.schedule_equipment}
                      onChange={(e) => setForm((f) => ({ ...f, schedule_equipment: e.target.value }))} />
                  </div>
                </div>

                {/* DIT foldering */}
                <div className="space-y-3 border-t border-border/40 pt-3">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-primary" />
                    <Label className="text-sm">DIT &amp; Backend Foldering</Label>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/50 p-2">
                    <div>
                      <p className="text-xs font-medium">Cloud Backup Archive</p>
                      <p className="text-[10px] text-muted-foreground">{form.foldering_mode_archive === "automated" ? "Auto-organized by category" : "Manual subpaths per upload"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={form.foldering_mode_archive === "manual" ? "text-foreground" : "text-muted-foreground"}>Manual</span>
                      <Switch checked={form.foldering_mode_archive === "automated"}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, foldering_mode_archive: v ? "automated" : "manual" }))} />
                      <span className={form.foldering_mode_archive === "automated" ? "text-foreground" : "text-muted-foreground"}>Auto</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/50 p-2">
                    <div>
                      <p className="text-xs font-medium">RAW Ingest</p>
                      <p className="text-[10px] text-muted-foreground">{form.foldering_mode_raw === "automated" ? "Auto folders: /raw/users/{uid}/…" : "Manual subpaths per upload"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={form.foldering_mode_raw === "manual" ? "text-foreground" : "text-muted-foreground"}>Manual</span>
                      <Switch checked={form.foldering_mode_raw === "automated"}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, foldering_mode_raw: v ? "automated" : "manual" }))} />
                      <span className={form.foldering_mode_raw === "automated" ? "text-foreground" : "text-muted-foreground"}>Auto</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project detail dashboard */}
      {detailProject && (
        <Dialog open={!!detailProject} onOpenChange={(o) => !o && setDetailProject(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" /> {detailProject.name}
              </DialogTitle>
              <DialogDescription>{workspaceName(detailProject.workspace_id)}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {detailProject.description && (
                <p className="text-sm text-muted-foreground">{detailProject.description}</p>
              )}

              {/* Tech specs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  ["Camera", detailProject.camera_brand],
                  ["Lens", detailProject.lens_brand],
                  ["Format", detailProject.capture_format],
                  ["Resolution", detailProject.resolution],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md border border-border/50 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                    <p className="font-medium truncate">{v || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Crew */}
              {Array.isArray(detailProject.crew) && detailProject.crew.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Crew</h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {detailProject.crew.map((c, i) => (
                      <div key={i} className="rounded-md border border-border/50 p-2 text-xs">
                        <p className="font-medium">{c.name || "Unnamed"} {c.role && <span className="text-muted-foreground">· {c.role}</span>}</p>
                        {c.email && <p className="text-muted-foreground">{c.email}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script */}
              {detailProject.script_object_key && (
                <div className="rounded-md border border-border/50 p-3 flex items-center gap-2 text-xs">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">Script uploaded</span>
                  <span className="text-muted-foreground break-all">{detailProject.script_object_key}</span>
                </div>
              )}

              {/* DIT foldering */}
              <div className="rounded-lg border border-border/50 p-3 space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-2"><FolderTree className="w-4 h-4 text-primary" /> DIT Foldering</h3>
                <p className="text-xs text-muted-foreground">
                  Archive: <span className="font-mono">{detailProject.foldering_mode_archive}</span> · RAW: <span className="font-mono">{detailProject.foldering_mode_raw}</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  workspaces/{detailProject.workspace_id.slice(0, 8)}…/projects/{detailProject.id.slice(0, 8)}…/{"{category}"}/users/{"{uid}"}/file
                </p>
              </div>

              {/* Post-production tooling */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Post-production tooling</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { icon: Wand2, label: "Media Conversions" },
                    { icon: Mic2, label: "Clap & Audio Report Syncing" },
                    { icon: FileSignature, label: "Screenplay Synchronizing" },
                  ].map(({ icon: Icon, label }) => (
                    <Button key={label} variant="outline" className="justify-start h-auto py-3 gap-2"
                      onClick={() => toast.info(`${label} — coming soon`)}>
                      <Icon className="w-4 h-4 text-primary" />
                      <div className="text-left">
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-[10px] text-muted-foreground">Module placeholder</p>
                      </div>
                    </Button>
                  ))}
                  <Button className="justify-start h-auto py-3 gap-2 bg-gradient-primary"
                    onClick={() => toast.info("Editor delivery link — coming soon")}>
                    <PackageCheck className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-xs font-medium">Generate Ready-to-Deliver Link</p>
                      <p className="text-[10px] opacity-80">For editors</p>
                    </div>
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { const p = detailProject; setDetailProject(null); openEdit(p); }}>
                  <Pencil className="w-3.5 h-3.5" /> Edit project
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShareProject(detailProject); setDetailProject(null); }}>
                  <Share2 className="w-3.5 h-3.5" /> Share for review
                </Button>
                <Link to="/studio" className="ml-auto">
                  <Button size="sm" variant="ghost" className="gap-2"><Upload className="w-3.5 h-3.5" /> Open Ingest</Button>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {shareProject && (
        <ShareReviewModal
          projectId={shareProject.id}
          projectName={shareProject.name}
          workspaceId={shareProject.workspace_id}
          open={!!shareProject}
          onOpenChange={(o) => !o && setShareProject(null)}
        />
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Set the studio / production company name shown across projects and uploads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-rename">Company / studio name</Label>
            <Input id="ws-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="e.g. Northlight Studios" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
            <Button onClick={submitRename} disabled={renaming || !renameValue.trim()} className="gap-2">
              {renaming && <Loader2 className="w-4 h-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
