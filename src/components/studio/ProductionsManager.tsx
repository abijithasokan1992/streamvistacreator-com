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
  ArrowUpRight, UserPlus, Users, Mail, Search, RefreshCw, MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateProductionNumber, getProductionNumber } from "@/lib/productionNumber";
import { INVITABLE_ORG_ROLES, ORG_ROLE_LABEL, ORG_ROLE_DESCRIPTION, ORG_ROLE_BACKEND, labelForOrgRole } from "@/lib/rbac/labels";
import { RoleLegend } from "@/components/rbac/RoleLegend";
import { archiveProductionCrew, restoreProductionCrew } from "@/lib/studio/productionArchive";

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

  // MVP: unified filter / search state (progressive disclosure over the old
  // three separate My/Partner/Archived sections). Backend & row semantics
  // unchanged — this only narrows the client-side view.
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "shared">("all");
  const [statusFilter, setStatusFilter] = useState<"live" | "archived">("live");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showTeam, setShowTeam] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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
        .from("user_profiles")
        .select("user_id,display_name,full_name")
        .in("user_id", ids);
      for (const p of (profs as any[]) ?? []) {
        profMap[p.user_id] = { email: null, full_name: p.full_name ?? p.display_name ?? null };
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

  // Unified filtered + searched view. Owner/status chips replace the previous
  // three separate sections; empty search matches everything.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const isArchived = String(p.crew?.title_status ?? "").toLowerCase() === "archived";
      if (statusFilter === "archived" ? !isArchived : isArchived) return false;
      if (ownerFilter === "mine" && p.user_id !== user?.id) return false;
      if (ownerFilter === "shared" && p.user_id === user?.id) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.crew?.content_type,
        p.crew?.production_company,
        p.crew?.client,
        getProductionNumber(p),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query, ownerFilter, statusFilter, user?.id]);

  // Selection is scoped to the current filtered view. When the view changes,
  // prune ids that are no longer visible.
  useEffect(() => {
    setSelection((prev) => {
      const visible = new Set(filtered.map((p) => p.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filtered]);

  const counts = useMemo(() => {
    let live = 0, arch = 0, mine = 0, shared = 0;
    for (const p of projects) {
      const isArch = String(p.crew?.title_status ?? "").toLowerCase() === "archived";
      if (isArch) arch++; else live++;
      if (p.user_id === user?.id) mine++; else shared++;
    }
    return { live, arch, mine, shared };
  }, [projects, user?.id]);

  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelection((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  };

  const selectedRows = useMemo(
    () => filtered.filter((p) => selection.has(p.id)),
    [filtered, selection],
  );
  const selectedDeletable = selectedRows.filter((p) => (stats[p.id]?.assetCount ?? 0) === 0);

  const handleArchive = async (p: ProjectRow) => {
    if (!canWriteActive) { toast.error("Viewer role — read-only"); return; }
    const next = archiveProductionCrew(p.crew);
    const { error } = await supabase.from("projects").update({ crew: next }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Archived"); refresh(); }
  };

  const handleRestore = async (p: ProjectRow) => {
    if (!canWriteActive) { toast.error("Viewer role — read-only"); return; }
    const next = restoreProductionCrew(p.crew);
    const { error } = await supabase.from("projects").update({ crew: next }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success("Restored"); refresh(); }
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

  const handleBulkArchive = async () => {
    if (!canWriteActive || selectedRows.length === 0) return;
    let ok = 0, fail = 0;
    for (const p of selectedRows) {
      const next = archiveProductionCrew(p.crew);
      const { error } = await supabase.from("projects").update({ crew: next }).eq("id", p.id);
      if (error) fail++; else ok++;
    }
    if (ok) toast.success(`${ok} production${ok === 1 ? "" : "s"} archived`);
    if (fail) toast.error(`${fail} failed to archive`);
    setBulkArchiveOpen(false);
    setSelection(new Set());
    refresh();
  };

  const handleBulkRestore = async () => {
    if (!canWriteActive || selectedRows.length === 0) return;
    let ok = 0, fail = 0;
    for (const p of selectedRows) {
      const next = restoreProductionCrew(p.crew);
      const { error } = await supabase.from("projects").update({ crew: next }).eq("id", p.id);
      if (error) fail++; else ok++;
    }
    if (ok) toast.success(`${ok} production${ok === 1 ? "" : "s"} restored`);
    if (fail) toast.error(`${fail} failed to restore`);
    setSelection(new Set());
    refresh();
  };

  const handleBulkDelete = async () => {
    if (!canWriteActive || selectedDeletable.length === 0) return;
    const ids = selectedDeletable.map((p) => p.id);
    const { error } = await supabase.from("projects").delete().in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(`${ids.length} deleted`);
      if (activeProjectId && ids.includes(activeProjectId)) onSetActive(null);
    }
    setBulkDeleteOpen(false);
    setSelection(new Set());
    refresh();
  };

  const hasNoProjects = !loading && projects.length === 0;

  return (
    <div className="space-y-4">
      {/* Compact header — workspace context + primary CTA. */}
      <section className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-xl leading-tight truncate">
            {activeWs?.name ?? "No workspace"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.live} live · {counts.arch} archived · {members.length} member{members.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
          {workspaceId && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Production
            </Button>
          )}
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

      {hasNoProjects ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-border/50 bg-secondary/10">
          <Clapperboard className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-display text-lg">No productions yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first Production.</p>
        </div>
      ) : (
        <>
          {/* Toolbar: search + filter chips. Scales to hundreds of rows. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search productions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <FilterChips<"all" | "mine" | "shared">
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={[
                { id: "all", label: "All", count: counts.mine + counts.shared },
                { id: "mine", label: "Mine", count: counts.mine },
                { id: "shared", label: "Shared", count: counts.shared },
              ]}
            />
            <FilterChips<"live" | "archived">
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: "live", label: "Live", count: counts.live },
                { id: "archived", label: "Archived", count: counts.arch },
              ]}
            />
          </div>

          {/* Bulk action bar — appears only when rows are selected. */}
          {selection.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
              <span className="text-xs">
                {selection.size} selected
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelection(new Set())}>
                  Clear
                </Button>
                {statusFilter === "live" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkArchiveOpen(true)}>
                    <Archive className="w-3 h-3 mr-1" /> Archive
                  </Button>
                )}
                {statusFilter === "archived" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkRestore}>
                    Restore
                  </Button>
                )}
                {selectedDeletable.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete ({selectedDeletable.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid place-items-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ProductionList
              items={filtered}
              stats={stats}
              activeProjectId={activeProjectId}
              selection={selection}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onSetActive={onSetActive}
              onOpen={onOpenProduction}
              onEdit={(p) => setEditing(p)}
              onShare={(p) => setSharing(p)}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={(p) => setConfirmDelete(p)}
              dim={statusFilter === "archived"}
              query={query}
            />
          )}

          {/* Team panel — hidden by default; workspace-level invites remain accessible. */}
          <details
            className="rounded-xl border border-border/50 bg-secondary/5 group"
            open={showTeam}
            onToggle={(e) => setShowTeam((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="inline-flex items-center gap-2 font-medium">
                <Users className="w-3.5 h-3.5 text-accent" />
                Workspace Team
                <span className="text-muted-foreground">· {members.length}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4">
              <CollaborationPanel
                workspaceId={workspaceId}
                members={members}
                onChanged={refreshMembers}
                canManage={canWriteActive}
              />
            </div>
          </details>
        </>
      )}

      {/* Bulk archive confirm */}
      <AlertDialog open={bulkArchiveOpen} onOpenChange={setBulkArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selection.size} production{selection.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>They will be hidden from Live views. You can restore them from the Archived filter.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDeletable.length} production{selectedDeletable.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only productions with no media assets will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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

/* ---------- Filter chip group ---------- */
function FilterChips<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string; count?: number }>;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/50 bg-secondary/10 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 py-1 rounded-md transition-colors whitespace-nowrap",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
            value === o.id
              ? "bg-accent/15 text-foreground ring-1 ring-inset ring-accent/25"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {typeof o.count === "number" && (
            <span className="ml-1 text-[10px] text-muted-foreground/70 tabular-nums">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Unified production list (rows) ---------- */
function ProductionList({
  items, stats, activeProjectId, selection,
  onToggleSelect, onToggleSelectAll,
  onSetActive, onOpen, onEdit, onShare, onArchive, onRestore, onDelete,
  dim, query,
}: {
  items: ProjectRow[];
  stats: Record<string, ProductionStats>;
  activeProjectId: string | null;
  selection: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSetActive: (id: string) => void;
  onOpen?: (id: string) => void;
  onEdit: (p: ProjectRow) => void;
  onShare: (p: ProjectRow) => void;
  onArchive: (p: ProjectRow) => void;
  onRestore: (p: ProjectRow) => void;
  onDelete: (p: ProjectRow) => void;
  dim?: boolean;
  query: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border/50 bg-secondary/5">
        {query ? "No productions match your search." : "Nothing here."}
      </div>
    );
  }
  const allSelected = selection.size === items.length && items.length > 0;
  return (
    <section className={cn("rounded-xl border border-border/50 bg-secondary/5", dim && "opacity-90")}>
      {/* Select-all header — visible once list has rows. */}
      <header className="px-3 py-2 flex items-center gap-2 border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all"
          className="ml-1"
        />
        <span className="font-mono">{items.length} production{items.length === 1 ? "" : "s"}</span>
      </header>
      <ul className="divide-y divide-border/30">
        {items.map((p) => {
          const s = stats[p.id];
          const isActive = p.id === activeProjectId;
          const assetCount = s?.assetCount ?? 0;
          const canDelete = assetCount === 0;
          const isSelected = selection.has(p.id);
          // Hide empty/optional metadata (progressive disclosure).
          const meta: Array<{ label: string; value: string }> = [];
          if (p.crew?.content_type) meta.push({ label: "Type", value: p.crew.content_type });
          if (s?.lastActivity) meta.push({ label: "Active", value: new Date(s.lastActivity).toLocaleDateString() });
          if ((s?.storageBytes ?? 0) > 0) meta.push({ label: "Storage", value: fmtBytes(s!.storageBytes) });
          if (assetCount > 0) meta.push({ label: "Assets", value: String(assetCount) });
          return (
            <li
              key={p.id}
              className={cn(
                "px-3 py-2.5 flex items-center gap-3 min-w-0",
                isActive && "bg-accent/5",
                isSelected && "bg-accent/10",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(p.id)}
                aria-label={`Select ${p.name}`}
              />
              <button
                onClick={() => { onSetActive(p.id); onOpen?.(p.id); }}
                className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
              >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  {getProductionNumber(p) && (
                    <Badge variant="outline" className="text-[10px] font-mono bg-accent/10 text-accent border-accent/30">
                      {getProductionNumber(p)}
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-400/30">
                      Active
                    </Badge>
                  )}
                  {p.crew?.title_status && p.crew.title_status !== "Archived" && (
                    <Badge variant="outline" className="text-[10px]">{p.crew.title_status}</Badge>
                  )}
                </div>
                {meta.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                    {meta.map((m) => (
                      <span key={m.label}>
                        {m.label}: <span className="text-foreground/80">{m.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { onSetActive(p.id); onOpen?.(p.id); }}
                >
                  Open <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="More actions">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {!isActive && (
                      <DropdownMenuItem onClick={() => onSetActive(p.id)}>
                        Set active
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(p)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onShare(p)}>
                      <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                    </DropdownMenuItem>
                    {String(p.crew?.title_status ?? "").toLowerCase() !== "archived" ? (
                      <DropdownMenuItem onClick={() => onArchive(p)}>
                        <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onRestore(p)}>
                        Restore
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(p)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
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
  const [client, setClient] = useState<string>(project?.crew?.client ?? "");
  const [director, setDirector] = useState<string>(project?.crew?.director ?? "");
  const [producer, setProducer] = useState<string>(project?.crew?.producer ?? "");
  const [startDate, setStartDate] = useState<string>(project?.crew?.start_date ?? new Date().toISOString().slice(0, 10));
  const [expectedFinish, setExpectedFinish] = useState<string>(project?.crew?.expected_finish ?? "");
  const [status, setStatus] = useState<string>(project?.crew?.title_status ?? "Pre-Production");
  const [notes, setNotes] = useState<string>(project?.crew?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!name.trim() && !!company.trim() && !!contentType && !!startDate && !!status && !!workspaceId;

  const buildCrew = (base: any) => ({
    ...(base ?? {}),
    content_type: contentType,
    production_company: company.trim(),
    client: client.trim() || null,
    director: director.trim() || null,
    producer: producer.trim() || null,
    start_date: startDate,
    expected_finish: expectedFinish || null,
    title_status: status,
    notes: notes.trim() || null,
  });

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
            ...buildCrew({}),
            title_number: generateProductionNumber(),
            folders: DEFAULT_FOLDERS,
            members: [],
          } as any,
        }).select("id").single();
        if (error) throw error;
        toast.success("Production created");
        onSaved(data?.id);
      } else if (project) {
        const nextCrew = buildCrew(project.crew);
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
          <Label htmlFor="pf-name">Production Name</Label>
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
          <Label>Project Type</Label>
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
          <Label htmlFor="pf-client">Client</Label>
          <Input id="pf-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Netflix, Studio buyer, or in-house" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-director">Director</Label>
          <Input id="pf-director" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Director name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-producer">Producer</Label>
          <Input id="pf-producer" value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Producer name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-start">Start Date</Label>
          <Input id="pf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-finish">Expected Finish</Label>
          <Input id="pf-finish" type="date" value={expectedFinish} onChange={(e) => setExpectedFinish(e.target.value)} />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="pf-notes">Notes</Label>
          <Textarea
            id="pf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Scope, delivery expectations, key contacts, anything the team should know."
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground">
            Team members are managed in the Production Workspace → Team tab.
          </p>
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
  // UI holds the canonical Organization Role; we map to the backend value at
  // invite time so the workspace_members row uses the existing enum.
  const [role, setRole] = useState<(typeof INVITABLE_ORG_ROLES)[number]>("member");
  const [sending, setSending] = useState(false);

  const invite = async () => {
    if (!workspaceId || !email.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("workspace-invite", {
        body: { workspace_id: workspaceId, email: email.trim(), role: ORG_ROLE_BACKEND[role] },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.pending) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.success(`${email.trim()} added as ${ORG_ROLE_LABEL[role]}`);
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
              <div className="flex items-center justify-between">
                <Label>Role</Label>
                <RoleLegend kind="org" compact />
              </div>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITABLE_ORG_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex flex-col">
                        <span>{ORG_ROLE_LABEL[r]}</span>
                        <span className="text-[10px] text-muted-foreground leading-snug">{ORG_ROLE_DESCRIPTION[r]}</span>
                      </div>
                    </SelectItem>
                  ))}
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
                    <Badge variant="outline" className="text-[10px]">{labelForOrgRole(m.role)}</Badge>
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
  const [role, setRole] = useState<(typeof INVITABLE_ORG_ROLES)[number]>("member");
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
        body: { workspace_id: workspaceId, email: email.trim(), role: ORG_ROLE_BACKEND[role] },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.pending) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.success(`${email.trim()} added as ${ORG_ROLE_LABEL[role]}`);
      setEmail("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Invite failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-border/50 bg-secondary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-accent" />
        <h3 className="font-semibold text-sm">Team</h3>
        <span className="text-[11px] text-muted-foreground font-mono">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
        <div className="ml-auto"><RoleLegend kind="org" compact /></div>
      </div>

      {canManage && (
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] mb-3">
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              type="email"
              placeholder="teammate@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVITABLE_ORG_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  <div className="flex flex-col">
                    <span>{ORG_ROLE_LABEL[r]}</span>
                    <span className="text-[10px] text-muted-foreground leading-snug">{ORG_ROLE_DESCRIPTION[r]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={!email.trim() || sending} className="h-9">
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
            Invite
          </Button>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
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
              <Badge variant="outline" className="text-[10px]">{labelForOrgRole(m.role)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
