/**
 * ProductionsManager — Full production lifecycle management.
 *
 * Reuses existing tables (projects, ingest_jobs, workspace_members) and the
 * existing `workspace-invite` edge function. No schema changes.
 *
 * Per-Production row shows:
 *   Name · Type · Status · Created · Last Activity · Storage Used ·
 *   Asset Count · Member Count
 * Row actions:
 *   Open · Edit · Share · Archive · Delete (only when asset count = 0)
 *
 * Partner Productions section includes team collaboration: invite by email,
 * search existing users, assign role, and a list of current members.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clapperboard, Plus, Loader2, Pencil, Share2, Archive, Trash2,
  ArrowUpRight, UserPlus, Users, Mail, Search, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { generateProductionNumber, getProductionNumber } from "@/lib/productionNumber";

const CONTENT_TYPES = [
  "Feature Film", "Series", "Documentary", "Short Film",
  "Commercial", "Music Video", "Animation", "Other",
] as const;

const TITLE_STATUSES = [
  "Pre-Production", "Production", "Post-Production", "Delivery", "Archived",
] as const;

const DEFAULT_FOLDERS = [
  "RAW", "Proxy", "Audio", "Documents", "Reports",
  "LUTs", "Stills", "Masters", "Deliverables", "Archive",
] as const;

// Production Number generation is centralized in "@/lib/productionNumber".

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n < 1_099_511_627_776) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  return `${(n / 1_099_511_627_776).toFixed(2)} TB`;
}

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  crew?: any;
  user_id?: string;
};

type ProductionStats = {
  storageBytes: number;
  assetCount: number;
  lastActivity: string | null;
};

type Member = {
  user_id: string;
  role: string;
  email?: string | null;
  full_name?: string | null;
};

export default function ProductionsManager({
  activeProjectId,
  onSetActive,
  onOpenProduction,
  initialFormOpen,
  onFormClose,
}: {
  activeProjectId: string | null;
  onSetActive: (id: string | null) => void;
  onOpenProduction?: (id: string) => void;
  initialFormOpen?: boolean;
  onFormClose?: () => void;
}) {
  const { user } = useAuth();
  const { activeId: workspaceId, active: activeWs, canWriteActive } = useWorkspaces();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stats, setStats] = useState<Record<string, ProductionStats>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!initialFormOpen);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [sharing, setSharing] = useState<ProjectRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (initialFormOpen) setShowForm(true); }, [initialFormOpen]);

  const refresh = useCallback(async () => {
    if (!workspaceId) { setProjects([]); setStats({}); setLoading(false); return; }
    setLoading(true);

    const { data: projData } = await supabase
      .from("projects")
      .select("id,name,created_at,crew,user_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    const projRows = (projData as ProjectRow[]) ?? [];
    setProjects(projRows);

    // Aggregate stats per production from ingest_jobs (existing table).
    if (projRows.length > 0) {
      const ids = projRows.map((p) => p.id);
      const { data: jobs } = await supabase
        .from("ingest_jobs")
        .select("project_id,transferred_bytes,total_files,completed_files,created_at")
        .eq("workspace_id", workspaceId)
        .in("project_id", ids);
      const map: Record<string, ProductionStats> = {};
      for (const id of ids) map[id] = { storageBytes: 0, assetCount: 0, lastActivity: null };
      for (const j of (jobs as any[]) ?? []) {
        const s = map[j.project_id];
        if (!s) continue;
        s.storageBytes += Number(j.transferred_bytes ?? 0);
        s.assetCount += Number(j.completed_files ?? j.total_files ?? 0);
        if (!s.lastActivity || j.created_at > s.lastActivity) s.lastActivity = j.created_at;
      }
      setStats(map);
    } else {
      setStats({});
    }

    setLoading(false);
  }, [workspaceId]);

  const refreshMembers = useCallback(async () => {
    if (!workspaceId) { setMembers([]); return; }
    const { data } = await (supabase as any)
      .from("workspace_members")
      .select("user_id,role")
      .eq("workspace_id", workspaceId);
    const rows = (data as any[]) ?? [];
    const ids = rows.map((r) => r.user_id);
    let profMap: Record<string, { email?: string | null; full_name?: string | null }> = {};
    if (ids.length > 0) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id,email,full_name")
        .in("id", ids);
      for (const p of (profs as any[]) ?? []) {
        profMap[p.id] = { email: p.email, full_name: p.full_name };
      }
    }
    setMembers(rows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      email: profMap[r.user_id]?.email ?? null,
      full_name: profMap[r.user_id]?.full_name ?? null,
    })));
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshMembers(); }, [refreshMembers]);

  // Auto-select newest live production as active when none set.
  useEffect(() => {
    if (!loading && projects.length > 0 && !activeProjectId) {
      const firstLive = projects.find(
        (p) => String(p.crew?.title_status ?? "").toLowerCase() !== "archived",
      );
      if (firstLive) onSetActive(firstLive.id);
    }
  }, [loading, projects, activeProjectId, onSetActive]);

  const { mine, partner, archived } = useMemo(() => {
    const mine: ProjectRow[] = [];
    const partner: ProjectRow[] = [];
    const archived: ProjectRow[] = [];
    for (const p of projects) {
      const isArchived = String(p.crew?.title_status ?? "").toLowerCase() === "archived";
      if (isArchived) { archived.push(p); continue; }
      if (user?.id && p.user_id === user.id) mine.push(p); else partner.push(p);
    }
    return { mine, partner, archived };
  }, [projects, user?.id]);

  const handleArchive = async (p: ProjectRow) => {
    if (!canWriteActive) { toast.error("Viewer role — read-only"); return; }
    const next = { ...(p.crew ?? {}), title_status: "Archived" };
    const { error } = await supabase.from("projects").update({ crew: next }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Archived"); refresh(); }
  };

  const handleDelete = async (p: ProjectRow) => {
    if (!canWriteActive) { toast.error("Viewer role — read-only"); return; }
    const s = stats[p.id];
    if (s && s.assetCount > 0) { toast.error("Cannot delete — production has media assets"); return; }
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Production deleted");
      if (activeProjectId === p.id) onSetActive(null);
      refresh();
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/50 bg-secondary/10 p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">Workspace</span>
            <h2 className="font-display text-xl mt-1.5">{activeWs?.name ?? "No workspace selected"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeWs
                ? `${projects.length} production${projects.length === 1 ? "" : "s"} · ${members.length} member${members.length === 1 ? "" : "s"}`
                : "Select a workspace to begin."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {workspaceId && (
              <Button size="sm" onClick={() => setShowForm((s) => !s)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Production
              </Button>
            )}
          </div>
        </div>
      </section>

      {showForm && (
        <ProductionForm
          mode="create"
          workspaceId={workspaceId}
          onCancel={() => { setShowForm(false); onFormClose?.(); }}
          onSaved={(id) => {
            setShowForm(false);
            onFormClose?.();
            refresh();
            if (id) onSetActive(id);
          }}
        />
      )}

      {loading ? (
        <div className="grid place-items-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-border/50 bg-secondary/10">
          <Clapperboard className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-display text-lg">No Productions Yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first Production.</p>
        </div>
      ) : (
        <>
          <ProductionGroup
            title="My Productions"
            tone="accent"
            items={mine}
            stats={stats}
            activeProjectId={activeProjectId}
            onSetActive={onSetActive}
            onOpen={onOpenProduction}
            onEdit={(p) => setEditing(p)}
            onShare={(p) => setSharing(p)}
            onArchive={handleArchive}
            onDelete={(p) => setConfirmDelete(p)}
            emptyHint="Productions you create appear here."
          />

          <div className="space-y-4">
            <ProductionGroup
              title="Partner Productions"
              tone="muted"
              items={partner}
              stats={stats}
              activeProjectId={activeProjectId}
              onSetActive={onSetActive}
              onOpen={onOpenProduction}
              onEdit={(p) => setEditing(p)}
              onShare={(p) => setSharing(p)}
              onArchive={handleArchive}
              onDelete={(p) => setConfirmDelete(p)}
              emptyHint="Invite collaborators or wait for shared productions to appear."
            />
            <CollaborationPanel
              workspaceId={workspaceId}
              members={members}
              onChanged={refreshMembers}
              canManage={canWriteActive}
            />
          </div>

          {archived.length > 0 && (
            <ProductionGroup
              title="Archived Productions"
              tone="muted"
              items={archived}
              stats={stats}
              activeProjectId={activeProjectId}
              onSetActive={onSetActive}
              onOpen={onOpenProduction}
              onEdit={(p) => setEditing(p)}
              onShare={(p) => setSharing(p)}
              onArchive={handleArchive}
              onDelete={(p) => setConfirmDelete(p)}
              emptyHint=""
              dim
            />
          )}
        </>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Production</DialogTitle>
              <DialogDescription>Update production details. Changes apply immediately.</DialogDescription>
            </DialogHeader>
            <ProductionForm
              mode="edit"
              workspaceId={workspaceId}
              project={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); refresh(); }}
            />
          </DialogContent>
        </Dialog>
      )}

      {sharing && (
        <ShareProductionDialog
          project={sharing}
          workspaceId={workspaceId}
          members={members}
          onClose={() => setSharing(null)}
          onInvited={refreshMembers}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This production has no media assets. It will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Production group list ---------- */
function ProductionGroup({
  title, tone, items, stats, activeProjectId,
  onSetActive, onOpen, onEdit, onShare, onArchive, onDelete,
  emptyHint, dim,
}: {
  title: string;
  tone: "accent" | "muted";
  items: ProjectRow[];
  stats: Record<string, ProductionStats>;
  activeProjectId: string | null;
  onSetActive: (id: string) => void;
  onOpen?: (id: string) => void;
  onEdit: (p: ProjectRow) => void;
  onShare: (p: ProjectRow) => void;
  onArchive: (p: ProjectRow) => void;
  onDelete: (p: ProjectRow) => void;
  emptyHint: string;
  dim?: boolean;
}) {
  const toneCls = tone === "accent"
    ? "bg-accent/10 text-accent border-accent/30"
    : "bg-secondary/40 text-muted-foreground border-border/50";
  return (
    <section className={`rounded-2xl border border-border/50 p-5 ${dim ? "opacity-85" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">{title}</h3>
        <span className={`text-[10px] font-mono border rounded-full px-2 py-0.5 ${toneCls}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        emptyHint ? <p className="text-xs text-muted-foreground pl-1">{emptyHint}</p> : null
      ) : (
        <div className="divide-y divide-border/30">
          {items.map((p) => {
            const s = stats[p.id];
            const isActive = p.id === activeProjectId;
            const assetCount = s?.assetCount ?? 0;
            const canDelete = assetCount === 0;
            return (
              <div key={p.id} className={`py-3 flex flex-wrap items-center justify-between gap-3 ${isActive ? "bg-accent/5 rounded-md px-2" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {getProductionNumber(p) && (
                      <Badge variant="outline" className="text-[10px] font-mono bg-accent/10 text-accent border-accent/30">
                        {getProductionNumber(p)}
                      </Badge>
                    )}
                    {isActive && <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-400/30">Active</Badge>}
                    {p.crew?.title_status && (
                      <Badge variant="outline" className="text-[10px]">{p.crew.title_status}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                    <span>Type: <span className="text-foreground">{p.crew?.content_type ?? "—"}</span></span>
                    <span>Created: <span className="text-foreground">{new Date(p.created_at).toLocaleDateString()}</span></span>
                    <span>Last activity: <span className="text-foreground">{s?.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "—"}</span></span>
                    <span>Storage: <span className="text-foreground">{fmtBytes(s?.storageBytes ?? 0)}</span></span>
                    <span>Assets: <span className="text-foreground">{assetCount}</span></span>
                    <span>Members: <span className="text-foreground">{(p.crew?.members?.length ?? 0) + 1}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {!isActive && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSetActive(p.id)}>
                      Set active
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onSetActive(p.id); onOpen?.(p.id); }}>
                    <ArrowUpRight className="w-3 h-3 mr-1" /> Open
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onEdit(p)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onShare(p)}>
                    <Share2 className="w-3 h-3 mr-1" /> Share
                  </Button>
                  {String(p.crew?.title_status ?? "").toLowerCase() !== "archived" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onArchive(p)}>
                      <Archive className="w-3 h-3 mr-1" /> Archive
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(p)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Create / Edit form ---------- */
function ProductionForm({
  mode, workspaceId, project, onCancel, onSaved,
}: {
  mode: "create" | "edit";
  workspaceId: string | null;
  project?: ProjectRow;
  onCancel: () => void;
  onSaved: (id?: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(project?.name ?? "");
  const [contentType, setContentType] = useState<string>(project?.crew?.content_type ?? "Feature Film");
  const [company, setCompany] = useState<string>(project?.crew?.production_company ?? "");
  const [startDate, setStartDate] = useState<string>(project?.crew?.start_date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>(project?.crew?.title_status ?? "Pre-Production");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!name.trim() && !!company.trim() && !!contentType && !!startDate && !!status && !!workspaceId;

  const submit = async () => {
    if (!canSubmit || !workspaceId) return;
    setSubmitting(true);
    try {
      if (mode === "create") {
        if (!user) return;
        const { data, error } = await supabase.from("projects").insert({
          workspace_id: workspaceId,
          user_id: user.id,
          name: name.trim(),
          crew: {
            title_number: generateProductionNumber(),
            content_type: contentType,
            production_company: company.trim(),
            start_date: startDate,
            title_status: status,
            folders: DEFAULT_FOLDERS,
            members: [],
          } as any,
        }).select("id").single();
        if (error) throw error;
        toast.success("Production created");
        onSaved(data?.id);
      } else if (project) {
        const nextCrew = {
          ...(project.crew ?? {}),
          content_type: contentType,
          production_company: company.trim(),
          start_date: startDate,
          title_status: status,
        };
        const { error } = await supabase
          .from("projects")
          .update({ name: name.trim(), crew: nextCrew })
          .eq("id", project.id);
        if (error) throw error;
        toast.success("Production updated");
        onSaved(project.id);
      }
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="pf-name">Production Title</Label>
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Untitled Feature 2026" />
        </div>
        {mode === "edit" && getProductionNumber(project) && (
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Production Number</Label>
            <Input value={getProductionNumber(project) ?? ""} readOnly className="font-mono bg-muted/40" />
            <p className="text-[11px] text-muted-foreground">Auto-generated identifier. Editable from Production Settings by workspace admins.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Content Type</Label>
          <Select value={contentType} onValueChange={setContentType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TITLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="pf-company">Production Company</Label>
          <Input id="pf-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northlight Pictures Pvt. Ltd." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-start">Start Date</Label>
          <Input id="pf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={!canSubmit || submitting}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
          {mode === "create" ? "Create Production" : "Save Changes"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------- Share dialog: invite collaborators ---------- */
function ShareProductionDialog({
  project, workspaceId, members, onClose, onInvited,
}: {
  project: ProjectRow;
  workspaceId: string | null;
  members: Member[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [sending, setSending] = useState(false);

  const invite = async () => {
    if (!workspaceId || !email.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("workspace-invite", {
        body: { workspace_id: workspaceId, email: email.trim(), role },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.pending) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.success(`${email.trim()} added as ${role}`);
      setEmail("");
      onInvited();
    } catch (e) {
      toast.error((e as Error).message || "Invite failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{project.name}”</DialogTitle>
          <DialogDescription>
            Invite collaborators to this workspace. They will have access to all productions here based on their role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="share-email">Email</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="teammate@studio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="w-32 space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={invite} disabled={!email.trim() || sending}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            </Button>
          </div>

          <div className="rounded-lg border border-border/40 p-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
              Current members ({members.length})
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-auto">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between text-xs">
                    <span className="truncate">
                      {m.full_name || m.email || m.user_id.slice(0, 8)}
                      {m.email && m.full_name ? <span className="text-muted-foreground"> · {m.email}</span> : null}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Collaboration panel (Partner Productions section) ---------- */
function CollaborationPanel({
  workspaceId, members, onChanged, canManage,
}: {
  workspaceId: string | null;
  members: Member[];
  onChanged: () => void;
  canManage: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter((m) =>
      (m.email ?? "").toLowerCase().includes(q) ||
      (m.full_name ?? "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const invite = async () => {
    if (!workspaceId || !email.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("workspace-invite", {
        body: { workspace_id: workspaceId, email: email.trim(), role },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.pending) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.success(`${email.trim()} added as ${role}`);
      setEmail("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Invite failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-secondary/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-accent" />
        <h3 className="font-semibold text-sm">Team & Collaboration</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
        Invite collaborators by email or search existing members. Roles control write access
        (Admin can invite, Editor can create/edit productions, Viewer is read-only).
      </p>

      {canManage && (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] mb-4">
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              type="email"
              placeholder="teammate@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={!email.trim() || sending}>
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
            Invite
          </Button>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          {members.length === 0 ? "No members yet — invite your team above." : "No members match your search."}
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {filtered.map((m) => (
            <li key={m.user_id} className="py-2 flex items-center justify-between text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium">{m.full_name || m.email || m.user_id.slice(0, 8)}</span>
                {m.email && m.full_name ? <span className="text-muted-foreground"> · {m.email}</span> : null}
              </span>
              <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
