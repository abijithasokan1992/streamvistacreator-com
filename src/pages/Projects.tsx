import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Loader2, Film, ArrowLeft, Building2 } from "lucide-react";
import ShareReviewModal from "@/components/projects/ShareReviewModal";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces, type Workspace } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Project = {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  description: string;
  workspace_id: string;
};

const emptyForm: FormState = { name: "", description: "", workspace_id: "" };

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
    // RLS already scopes results to workspaces the user belongs to.
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, name, description, workspace_id, created_at, updated_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows(((data ?? []) as unknown) as Project[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    const defaultWs = activeId && writableWorkspaces.some((w) => w.id === activeId)
      ? activeId
      : writableWorkspaces[0]?.id ?? "";
    setForm({ ...emptyForm, workspace_id: defaultWs });
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      workspace_id: p.workspace_id,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) return toast.error("Project name is required");
    if (!form.workspace_id) return toast.error("Production banner (workspace) is required");

    setSaving(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      workspace_id: form.workspace_id,
    };

    let error;
    if (editing) {
      ({ error } = await (supabase as any)
        .from("projects")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any)
        .from("projects")
        .insert({ ...payload, user_id: user.id }));
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
            <Button onClick={openCreate} size="sm" className="gap-2" disabled={writableWorkspaces.length === 0}>
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-8">
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
              <Card key={p.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">{p.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Share for review" onClick={() => setShareProject(p)}>
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => remove(p)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
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
                  <p className="text-[10px] text-muted-foreground/70 mt-3">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle>
            <DialogDescription>
              Pick the production banner (workspace) this project's assets should route to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proj-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Untitled Feature 2026"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-banner">
                Production Banner <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.workspace_id}
                onValueChange={(v) => setForm((f) => ({ ...f, workspace_id: v }))}
                disabled={writableWorkspaces.length === 0}
              >
                <SelectTrigger id="proj-banner">
                  <SelectValue placeholder={writableWorkspaces.length ? "Select a banner…" : "No workspaces with write access"} />
                </SelectTrigger>
                <SelectContent>
                  {writableWorkspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">{w.role}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Only workspaces where you are owner, admin, or editor are shown.
              </p>
            </div>

            {/* Inline create-workspace */}
            {!editing && (
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Need a new banner?</Label>
                <div className="flex gap-2">
                  <Input
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="New workspace name"
                    maxLength={80}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateWorkspace}
                    disabled={creatingWs || !newWsName.trim()}
                  >
                    {creatingWs ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief logline or working notes (optional)"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareProject && (
        <ShareReviewModal
          project={shareProject as any}
          open={!!shareProject}
          onOpenChange={(o) => !o && setShareProject(null)}
        />
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>
              Set the studio / production company name shown across projects and uploads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-rename">Company / studio name</Label>
            <Input
              id="ws-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="e.g. Northlight Studios"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
            <Button onClick={submitRename} disabled={renaming || !renameValue.trim()} className="gap-2">
              {renaming && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
