/**
 * ProductionWorkspace — per-production hub opened after a production is created
 * or when "Open" is clicked in ProductionsManager.
 *
 * Purely a shell: reuses existing components via slot props for Files, Uploads
 * and Activity so no logic is duplicated. Overview, Team, Quality Review and
 * Deliveries render from live data.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Clapperboard, FolderTree, UploadCloud, Users, Activity as ActivityIcon,
  ShieldCheck, PackageCheck, StickyNote, Calendar, Building2, User, Film, Loader2,
  MoreHorizontal, Search, Pencil, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { labelForOrgRole } from "@/lib/rbac/labels";
import { getProductionNumber } from "@/lib/productionNumber";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  crew?: any;
  user_id?: string;
};

type Member = { user_id: string; role: string; email?: string | null; full_name?: string | null };

type Delivery = {
  id: string; title: string | null; status: string | null; due_at: string | null; created_at: string;
};

type Issue = {
  id: string; severity: string; status: string; title: string | null; stage: string | null; raised_at: string;
};

export default function ProductionWorkspace({
  project,
  workspaceId,
  onBack,
  filesSlot,
  uploadsSlot,
  activitySlot,
  onEdit,
  onShare,
}: {
  project: ProjectRow;
  workspaceId: string | null;
  onBack: () => void;
  filesSlot: ReactNode;
  uploadsSlot: ReactNode;
  activitySlot: ReactNode;
  onEdit?: () => void;
  onShare?: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [qcIssues, setQcIssues] = useState<Issue[]>([]);
  const [qrLoading, setQrLoading] = useState(true);
  const [dvLoading, setDvLoading] = useState(true);

  const crew = project.crew ?? {};
  const number = getProductionNumber(project);

  // Team — reuse the workspace_members contract used everywhere else.
  useEffect(() => {
    if (!workspaceId) { setMembers([]); setMembersLoading(false); return; }
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      const { data } = await (supabase as any).from("workspace_members")
        .select("user_id,role").eq("workspace_id", workspaceId);
      const rows = (data as any[]) ?? [];
      const ids = rows.map((r) => r.user_id);
      let profMap: Record<string, { email?: string | null; full_name?: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any).from("user_profiles")
          .select("user_id,display_name,full_name").in("user_id", ids);
        for (const p of (profs as any[]) ?? []) profMap[p.user_id] = { email: null, full_name: p.full_name ?? p.display_name ?? null };
      }
      if (cancelled) return;
      setMembers(rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        email: profMap[r.user_id]?.email ?? null,
        full_name: profMap[r.user_id]?.full_name ?? null,
      })));
      setMembersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Deliveries — reuse existing deal_deliveries, scoped by title_id when the
  // production is linked to a content title (crew.title_id). deal_deliveries
  // has no project_id/workspace_id columns, so we only surface deliveries when
  // the production is linked to a title.
  useEffect(() => {
    let cancelled = false;
    const titleId = crew?.title_id as string | undefined;
    if (!titleId) { setDeliveries([]); setDvLoading(false); return; }
    (async () => {
      setDvLoading(true);
      const { data } = await (supabase as any).from("deal_deliveries")
        .select("id,status,expires_at,created_at,title_id")
        .eq("title_id", titleId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = ((data as any[]) ?? []).map((r) => ({
        id: r.id,
        title: null,
        status: r.status,
        due_at: r.expires_at ?? null,
        created_at: r.created_at,
        project_id: null,
        workspace_id: null,
      }));
      setDeliveries(rows as Delivery[]);
      setDvLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew?.title_id]);

  // Quality Review — reuse existing title_review_issues if this production is
  // linked to a content_titles row (crew.title_id).
  useEffect(() => {
    let cancelled = false;
    const titleId = crew?.title_id as string | undefined;
    if (!titleId) { setQcIssues([]); setQrLoading(false); return; }
    (async () => {
      setQrLoading(true);
      const { data } = await (supabase as any).from("title_review_issues")
        .select("id,severity,status,category_label,stage,raised_at")
        .eq("title_id", titleId)
        .order("raised_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = ((data as any[]) ?? []).map((r) => ({ ...r, title: r.category_label }));
      setQcIssues((rows as Issue[]) ?? []);
      setQrLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew?.title_id]);

  // MVP overview: only the essentials, and skip empty fields entirely so
  // the page doesn't render rows of dashes.
  const overviewFacts = useMemo(() => {
    const rows: Array<{ icon: any; label: string; value: string }> = [];
    if (crew.content_type)        rows.push({ icon: Film,        label: "Production Type", value: crew.content_type });
    if (crew.director)            rows.push({ icon: User,        label: "Director",        value: crew.director });
    if (crew.title_status)        rows.push({ icon: Clapperboard,label: "Status",          value: crew.title_status });
    if (crew.production_company)  rows.push({ icon: Building2,   label: "Production Co.",  value: crew.production_company });
    if (crew.start_date)          rows.push({ icon: Calendar,    label: "Start Date",      value: crew.start_date });
    return rows;
  }, [crew]);

  const [advOpen, setAdvOpen] = useState(false);
  const [advTab, setAdvTab] = useState("activity");

  // Team search — for enterprise scale (hundreds of members). Client-side.
  const [teamQuery, setTeamQuery] = useState("");
  const filteredMembers = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q) ||
      m.user_id.toLowerCase().includes(q),
    );
  }, [members, teamQuery]);

  return (
    <div className="space-y-4">
      {/* Slim header — back link, title + badges, primary + overflow actions. */}
      <section className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Button size="sm" variant="ghost" className="text-xs mb-1 -ml-2 h-7" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> All productions
          </Button>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="font-display text-xl leading-tight truncate">{project.name}</h2>
            {number && (
              <Badge variant="outline" className="text-[10px] font-mono bg-accent/10 text-accent border-accent/30">
                {number}
              </Badge>
            )}
            {crew.title_status && (
              <Badge variant="outline" className="text-[10px]">{crew.title_status}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit} className="h-8">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
          <Sheet open={advOpen} onOpenChange={setAdvOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                Advanced
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Advanced — {project.name}</SheetTitle>
              </SheetHeader>
              <Tabs value={advTab} onValueChange={setAdvTab} className="w-full mt-4">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="uploads"><UploadCloud className="w-3.5 h-3.5 mr-1.5" />Uploads</TabsTrigger>
                  <TabsTrigger value="activity"><ActivityIcon className="w-3.5 h-3.5 mr-1.5" />Activity</TabsTrigger>
                  <TabsTrigger value="qc"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Quality</TabsTrigger>
                  <TabsTrigger value="deliveries"><PackageCheck className="w-3.5 h-3.5 mr-1.5" />Deliveries</TabsTrigger>
                </TabsList>
                <TabsContent value="uploads" className="mt-4">{uploadsSlot}</TabsContent>
                <TabsContent value="activity" className="mt-4">{activitySlot}</TabsContent>
                <TabsContent value="qc" className="mt-4">
                  <section className="rounded-xl border border-border/50 p-4">
                    {qrLoading ? (
                      <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
                    ) : qcIssues.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No QC findings yet.</p>
                    ) : (
                      <ul className="divide-y divide-border/30">
                        {qcIssues.map((i) => (
                          <li key={i.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{i.title ?? "Untitled finding"}</span>
                              {i.stage && <span className="text-muted-foreground"> · {i.stage}</span>}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px]">{i.severity}</Badge>
                              <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Formal reviews run from the <Link to="/admin/qc" className="underline">Reviewer console</Link>.
                    </p>
                  </section>
                </TabsContent>
                <TabsContent value="deliveries" className="mt-4">
                  <section className="rounded-xl border border-border/50 p-4">
                    {dvLoading ? (
                      <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
                    ) : deliveries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No deliveries scheduled yet.</p>
                    ) : (
                      <ul className="divide-y divide-border/30">
                        {deliveries.map((d) => (
                          <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{d.title ?? "Delivery"}</span>
                              {d.due_at && <span className="text-muted-foreground"> · due {new Date(d.due_at).toLocaleDateString()}</span>}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{d.status ?? "pending"}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
          {onShare && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onShare}>
                  <UserPlus className="w-3.5 h-3.5 mr-2" /> Invite member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview"><Clapperboard className="w-3.5 h-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="files"><FolderTree className="w-3.5 h-3.5 mr-1.5" />Files</TabsTrigger>
          <TabsTrigger value="team"><Users className="w-3.5 h-3.5 mr-1.5" />Team</TabsTrigger>
        </TabsList>

        {/* Overview — only non-empty facts. */}
        <TabsContent value="overview" className="mt-5 space-y-3">
          <section className="rounded-xl border border-border/50 bg-secondary/5 p-4">
            {overviewFacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No production details yet. Use <button onClick={onEdit} className="underline">Edit</button> to add director, status and more.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {overviewFacts.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground flex items-center gap-1.5">
                        <Icon className="w-3 h-3" /> {f.label}
                      </div>
                      <div className="text-sm mt-1 truncate">{f.value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {crew.notes && (
            <section className="rounded-xl border border-border/50 bg-secondary/5 p-4">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{crew.notes}</p>
            </section>
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-5">{filesSlot}</TabsContent>

        {/* Team — search + list. Scales to hundreds of members. */}
        <TabsContent value="team" className="mt-5">
          <section className="rounded-xl border border-border/50 bg-secondary/5">
            <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder={`Search ${members.length} member${members.length === 1 ? "" : "s"}…`}
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                />
              </div>
              {onShare && (
                <Button size="sm" variant="outline" className="h-8" onClick={onShare}>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Invite
                </Button>
              )}
            </header>
            {membersLoading ? (
              <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {members.length === 0 ? "No team members yet — invite collaborators." : "No members match your search."}
              </p>
            ) : (
              <ul className="divide-y divide-border/30">
                {filteredMembers.map((m) => (
                  <li key={m.user_id} className="px-4 py-2 flex items-center justify-between text-xs">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
