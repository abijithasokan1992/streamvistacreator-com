import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Target,
  Users as UsersIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type OrgKind = "creator" | "studio" | "buyer" | "channel_partner";
type OrgStatus = "draft" | "invited" | "onboarding" | "active" | "suspended";

interface OrgRow {
  id: string;
  name: string;
  org_kind: OrgKind;
  status: OrgStatus;
  published: boolean;
  domain_name: string | null;
  logo_url: string | null;
  created_at: string;
}

interface CrmOrgRow {
  id: string;
  buyer_code: string | null;
  name: string;
  org_type: string;
  category: string | null;
  country: string | null;
  website: string | null;
  priority: number | null;
  tier: number | null;
  stage: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  owner_email: string | null;
  primary_contact?: {
    full_name: string | null;
    role_title: string | null;
    email: string | null;
  } | null;
}

interface CrmSummary {
  organizations: number;
  contacts: number;
  communications: number;
  opportunities: number;
  openTasks: number;
  followUpsDue: number;
}

const EMPTY_SUMMARY: CrmSummary = {
  organizations: 0,
  contacts: 0,
  communications: 0,
  opportunities: 0,
  openTasks: 0,
  followUpsDue: 0,
};

const KIND_LABEL: Record<OrgKind, string> = {
  creator: "Creator",
  studio: "Studio",
  buyer: "Buyer",
  channel_partner: "Channel Partner",
};

const KIND_TONE: Record<OrgKind, string> = {
  creator: "bg-accent/15 text-accent border-accent/40",
  studio: "bg-primary/15 text-primary border-primary/40",
  buyer: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  channel_partner: "bg-purple-500/15 text-purple-300 border-purple-500/40",
};

const STATUS_TONE: Record<OrgStatus, string> = {
  draft: "bg-muted/40 text-muted-foreground border-border/60",
  invited: "bg-accent/10 text-accent border-accent/30",
  onboarding: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  suspended: "bg-destructive/15 text-destructive border-destructive/40",
};

const KIND_FILTERS: Array<{ key: OrgKind | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "creator", label: "Creators" },
  { key: "studio", label: "Studios" },
  { key: "buyer", label: "Buyers" },
  { key: "channel_partner", label: "Channel Partners" },
];

const stageTone = (stage: string) => {
  if (["won", "active", "qualified"].includes(stage)) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (["replied", "follow_up", "follow-up required", "negotiating"].includes(stage)) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (["contacted", "proposal"].includes(stage)) return "bg-primary/15 text-primary border-primary/40";
  if (["lost", "declined", "archived"].includes(stage)) return "bg-destructive/15 text-destructive border-destructive/40";
  return "bg-muted/40 text-muted-foreground border-border/60";
};

export default function OrganizationsConsole() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [crmRows, setCrmRows] = useState<CrmOrgRow[]>([]);
  const [summary, setSummary] = useState<CrmSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [crmLoading, setCrmLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [kind, setKind] = useState<OrgKind | "all">("all");
  const [query, setQuery] = useState("");
  const [crmQuery, setCrmQuery] = useState("");
  const [crmStage, setCrmStage] = useState("all");

  const loadOrganizations = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("organizations")
      .select("id, name, org_kind, status, published, domain_name, logo_url, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Could not load ecosystem organizations");
      return;
    }
    setRows((data ?? []) as OrgRow[]);
  };

  const loadCrm = async () => {
    setCrmLoading(true);
    const now = new Date().toISOString();
    const [orgs, contacts, comms, opportunities, tasks, dueTasks] = await Promise.all([
      (supabase as any)
        .from("crm_organizations")
        .select("id,buyer_code,name,org_type,category,country,website,priority,tier,stage,last_contacted_at,next_follow_up_at,owner_email")
        .is("archived_at", null)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(250),
      (supabase as any).from("crm_contacts").select("id", { count: "exact", head: true }),
      (supabase as any).from("crm_communications").select("id", { count: "exact", head: true }),
      (supabase as any).from("crm_opportunities").select("id", { count: "exact", head: true }),
      (supabase as any).from("crm_tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
      (supabase as any).from("crm_tasks").select("id", { count: "exact", head: true }).neq("status", "completed").lte("due_at", now),
    ]);

    if (orgs.error) {
      setCrmLoading(false);
      toast.error("Could not load CRM organizations");
      return;
    }

    const orgRows = (orgs.data ?? []) as CrmOrgRow[];
    const ids = orgRows.map((org) => org.id);
    let contactsByOrg = new Map<string, CrmOrgRow["primary_contact"]>();

    if (ids.length) {
      const { data: primaryContacts } = await (supabase as any)
        .from("crm_contacts")
        .select("organization_id,full_name,role_title,email,is_primary,verified")
        .in("organization_id", ids)
        .order("is_primary", { ascending: false })
        .order("verified", { ascending: false });

      for (const contact of primaryContacts ?? []) {
        if (!contactsByOrg.has(contact.organization_id)) {
          contactsByOrg.set(contact.organization_id, {
            full_name: contact.full_name,
            role_title: contact.role_title,
            email: contact.email,
          });
        }
      }
    }

    setCrmRows(orgRows.map((org) => ({ ...org, primary_contact: contactsByOrg.get(org.id) ?? null })));
    setSummary({
      organizations: orgRows.length,
      contacts: contacts.count ?? 0,
      communications: comms.count ?? 0,
      opportunities: opportunities.count ?? 0,
      openTasks: tasks.count ?? 0,
      followUpsDue: dueTasks.count ?? 0,
    });
    setCrmLoading(false);
  };

  const refreshAll = async () => {
    await Promise.all([loadOrganizations(), loadCrm()]);
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.org_kind !== kind) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.domain_name ?? "").toLowerCase().includes(q);
    });
  }, [rows, kind, query]);

  const crmStages = useMemo(
    () => Array.from(new Set(crmRows.map((row) => row.stage).filter(Boolean))).sort(),
    [crmRows],
  );

  const filteredCrm = useMemo(() => {
    const q = crmQuery.trim().toLowerCase();
    return crmRows.filter((row) => {
      if (crmStage !== "all" && row.stage !== crmStage) return false;
      if (!q) return true;
      return [
        row.name,
        row.buyer_code,
        row.category,
        row.country,
        row.primary_contact?.full_name,
        row.primary_contact?.role_title,
        row.primary_contact?.email,
      ].some((value) => (value ?? "").toLowerCase().includes(q));
    });
  }, [crmRows, crmQuery, crmStage]);

  const openEmail = (row: CrmOrgRow) => {
    const email = row.primary_contact?.email;
    if (!email) {
      toast.error("No verified email is saved for this organization");
      return;
    }
    const subject = encodeURIComponent(`StreamVista follow-up — ${row.name}`);
    window.location.href = `mailto:${email}?subject=${subject}`;
  };

  const createFollowUp = async (row: CrmOrgRow) => {
    setActingId(row.id);
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await (supabase as any).from("crm_tasks").insert({
      organization_id: row.id,
      title: `Follow up with ${row.name}`,
      description: row.primary_contact?.email
        ? `Contact ${row.primary_contact.full_name ?? row.name} at ${row.primary_contact.email}`
        : "Find or verify a decision-maker contact before outreach.",
      due_at: due,
      status: "open",
      assigned_to_email: row.owner_email ?? "abijithasokan1992@gmail.com",
    });
    setActingId(null);
    if (error) {
      toast.error(error.message || "Could not create follow-up task");
      return;
    }
    toast.success("Follow-up task created for 3 days from now");
    await loadCrm();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">CRM & Organizations</h3>
              <p className="text-xs text-muted-foreground">
                Live buyers, decision-makers, communications, opportunities and follow-ups.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading || crmLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-1.5", (loading || crmLoading) && "animate-spin")} />
            Refresh all
          </Button>
        </div>

        <Tabs defaultValue="crm">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="crm">CRM Pipeline</TabsTrigger>
            <TabsTrigger value="ecosystem">App Organizations</TabsTrigger>
          </TabsList>

          <TabsContent value="crm" className="mt-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <SummaryCard label="Organizations" value={summary.organizations} icon={<Building2 className="w-4 h-4" />} />
              <SummaryCard label="Decision-makers" value={summary.contacts} icon={<UsersIcon className="w-4 h-4" />} />
              <SummaryCard label="Communications" value={summary.communications} icon={<Mail className="w-4 h-4" />} />
              <SummaryCard label="Opportunities" value={summary.opportunities} icon={<Target className="w-4 h-4" />} />
              <SummaryCard label="Open tasks" value={summary.openTasks} icon={<CalendarPlus className="w-4 h-4" />} />
              <SummaryCard label="Due follow-ups" value={summary.followUpsDue} icon={<CheckCircle2 className="w-4 h-4" />} alert={summary.followUpsDue > 0} />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={crmQuery}
                  onChange={(e) => setCrmQuery(e.target.value)}
                  placeholder="Search company, person, role or email"
                  className="w-full pl-8 pr-3 py-2 rounded-md text-xs bg-background border border-border/60 focus:outline-none focus:border-accent"
                />
              </div>
              <select
                value={crmStage}
                onChange={(e) => setCrmStage(e.target.value)}
                className="px-3 py-2 rounded-md text-xs bg-background border border-border/60"
              >
                <option value="all">All stages</option>
                {crmStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
                  <tr>
                    <th className="text-left px-3 py-2">Organization</th>
                    <th className="text-left px-3 py-2">Decision-maker</th>
                    <th className="text-left px-3 py-2">Stage</th>
                    <th className="text-left px-3 py-2">Priority</th>
                    <th className="text-left px-3 py-2">Last contact</th>
                    <th className="text-left px-3 py-2">Next follow-up</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crmLoading && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading CRM…
                    </td></tr>
                  )}
                  {!crmLoading && filteredCrm.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No CRM organizations match.</td></tr>
                  )}
                  {filteredCrm.map((row) => (
                    <tr key={row.id} className="border-t border-border/40 hover:bg-secondary/20 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium flex items-center gap-1.5">
                          {row.name}
                          {row.website && (
                            <a href={row.website} target="_blank" rel="noreferrer" aria-label={`Open ${row.name} website`} className="text-muted-foreground hover:text-accent">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {[row.buyer_code, row.category, row.country].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-xs">{row.primary_contact?.full_name ?? "Contact needed"}</div>
                        <div className="text-[11px] text-muted-foreground">{row.primary_contact?.role_title ?? "Decision-maker not assigned"}</div>
                        <div className="text-[11px] text-muted-foreground">{row.primary_contact?.email ?? "No email"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn("text-[10px] capitalize", stageTone(row.stage))}>{row.stage.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs">{row.priority ?? "—"}{row.tier ? ` · Tier ${row.tier}` : ""}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(row.last_contacted_at)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(row.next_follow_up_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEmail(row)} disabled={!row.primary_contact?.email}>
                            <Mail className="w-3.5 h-3.5 mr-1" /> Email
                          </Button>
                          <Button size="sm" onClick={() => createFollowUp(row)} disabled={actingId === row.id}>
                            {actingId === row.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5 mr-1" />}
                            Follow-up
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ecosystem" className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {KIND_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setKind(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition-colors",
                    kind === f.key
                      ? "bg-accent/20 border-accent/60 text-accent"
                      : "border-border/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
              <div className="ml-auto relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name / domain"
                  className="pl-8 pr-3 py-1.5 rounded-md text-xs bg-background border border-border/60 focus:outline-none focus:border-accent w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Kind</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Public</th>
                    <th className="text-left px-3 py-2">Domain</th>
                    <th className="text-left px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                      <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading…
                    </td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No organizations match.</td></tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn("text-[10px]", KIND_TONE[r.org_kind])}>{KIND_LABEL[r.org_kind]}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[r.status])}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.published ? <span className="text-emerald-400">Published</span> : <span className="text-muted-foreground">Private</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.domain_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, alert = false }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-3", alert ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-secondary/20")}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-display font-bold tabular-nums">{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
