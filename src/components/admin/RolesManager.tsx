import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserCog, Plus, Trash2, Crown, Camera, Users, Eye, Link2, Briefcase, Wallet, Code2, Megaphone, LayoutGrid, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Role = "admin" | "executive_producer" | "creator" | "client";
const ROLES: { value: Role; label: string; icon: React.ReactNode }[] = [
  { value: "admin",              label: "Admin",              icon: <Crown className="w-3.5 h-3.5" /> },
  { value: "executive_producer", label: "Executive Producer", icon: <Eye className="w-3.5 h-3.5" /> },
  { value: "creator",            label: "Creator",            icon: <Camera className="w-3.5 h-3.5" /> },
  { value: "client",             label: "Client",             icon: <Users className="w-3.5 h-3.5" /> },
];

type ProfileRow = { user_id: string; display_name: string | null };
type RoleRow    = { user_id: string; role: Role };
type AssignRow  = { id: string; ep_user_id: string; creator_user_id: string; created_at: string };
type Division   = "ops" | "finance" | "dev" | "marketing";
type DivisionRow = { id: string; user_id: string; division: Division };
const DIVISIONS: { value: Division; label: string; icon: React.ReactNode }[] = [
  { value: "ops",       label: "Business & Ops",   icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: "finance",   label: "Finance & Billing",icon: <Wallet className="w-3.5 h-3.5" /> },
  { value: "dev",       label: "Development",      icon: <Code2 className="w-3.5 h-3.5" /> },
  { value: "marketing", label: "Marketing",        icon: <Megaphone className="w-3.5 h-3.5" /> },
];

export default function RolesManager() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [assignments, setAssignments] = useState<AssignRow[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: a }, { data: d }] = await Promise.all([
      supabase.from("user_profiles").select("user_id, display_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("producer_assignments").select("id, ep_user_id, creator_user_id, created_at"),
      supabase.from("admin_divisions" as any).select("id, user_id, division"),
    ]);
    setProfiles((p || []) as ProfileRow[]);
    setRoles((r || []) as RoleRow[]);
    setAssignments((a || []) as AssignRow[]);
    setDivisions(((d as any) || []) as DivisionRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rolesByUser = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);
  const nameOf = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name || uid.slice(0, 8);

  const addRole = async (uid: string, role: Role) => {
    if (rolesByUser(uid).includes(role)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success(`Added ${role}`);
    load();
  };
  const removeRole = async (uid: string, role: Role) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success(`Removed ${role}`);
    load();
  };

  // EP ↔ Creator assignment
  const [epPick, setEpPick] = useState<string>("");
  const [crPick, setCrPick] = useState<string>("");
  const eps      = profiles.filter((p) => rolesByUser(p.user_id).includes("executive_producer"));
  const creators = profiles.filter((p) => rolesByUser(p.user_id).includes("creator"));
  const linkPair = async () => {
    if (!epPick || !crPick) return toast.error("Pick both an EP and a Creator");
    const { error } = await supabase.from("producer_assignments").insert({
      ep_user_id: epPick, creator_user_id: crPick,
    });
    if (error) return toast.error(error.message);
    toast.success("Assignment linked");
    setEpPick(""); setCrPick(""); load();
  };
  const unlinkPair = async (id: string) => {
    const { error } = await supabase.from("producer_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unlinked");
    load();
  };

  // Admin divisions
  const divisionsByUser = (uid: string) => divisions.filter((d) => d.user_id === uid).map((d) => d.division);
  const addDivision = async (uid: string, division: Division) => {
    if (divisionsByUser(uid).includes(division)) return;
    const { error } = await (supabase.from("admin_divisions" as any) as any).insert({ user_id: uid, division });
    if (error) return toast.error(error.message);
    toast.success(`Division added`);
    load();
  };
  const removeDivision = async (id: string) => {
    const { error } = await (supabase.from("admin_divisions" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Division removed");
    load();
  };
  const admins = profiles.filter((p) => rolesByUser(p.user_id).includes("admin"));

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.display_name || "").toLowerCase().includes(q) || p.user_id.includes(q);
  });

  return (
    <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
          <UserCog className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Roles &amp; RBAC</h3>
          <p className="text-xs text-muted-foreground">
            Assign roles and link Executive Producers to the Creators they oversee. All changes
            are enforced at the database via RLS — clients cannot escalate themselves.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
        </div>
      ) : (
        <>
          {/* Users + roles */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Users</Label>
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or user id…"
              className="bg-secondary/40 border-border/60"
            />
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[420px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No users match.</div>
              )}
              {filtered.map((p) => {
                const userRoles = rolesByUser(p.user_id);
                return (
                  <div key={p.user_id} className="p-3 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.display_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{p.user_id}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {userRoles.map((r) => {
                        const meta = ROLES.find((x) => x.value === r);
                        return (
                          <button
                            key={r}
                            onClick={() => removeRole(p.user_id, r)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-accent/40 bg-accent/10 text-accent hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive transition"
                            title="Click to remove"
                          >
                            {meta?.icon} {meta?.label || r} <Trash2 className="w-3 h-3 ml-0.5" />
                          </button>
                        );
                      })}
                    </div>
                    <Select onValueChange={(v) => addRole(p.user_id, v as Role)}>
                      <SelectTrigger className="h-8 w-[150px] bg-secondary/40 border-border/60 text-xs">
                        <SelectValue placeholder="+ Add role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => !userRoles.includes(r.value)).map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            <span className="inline-flex items-center gap-2">{r.icon} {r.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EP ↔ Creator assignments */}
          <div className="space-y-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Executive Producer → Creator</Label>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={epPick} onValueChange={setEpPick}>
                <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue placeholder="Pick an EP" /></SelectTrigger>
                <SelectContent>
                  {eps.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No users have the EP role yet</div>}
                  {eps.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0,8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={crPick} onValueChange={setCrPick}>
                <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue placeholder="Pick a Creator" /></SelectTrigger>
                <SelectContent>
                  {creators.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No users have the Creator role yet</div>}
                  {creators.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0,8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={linkPair} className="bg-gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> Link
              </Button>
            </div>
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[280px] overflow-y-auto">
              {assignments.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No assignments yet.</div>
              )}
              {assignments.map((a) => (
                <div key={a.id} className="p-3 flex items-center gap-2 text-sm">
                  <Link2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="font-medium">{nameOf(a.ep_user_id)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{nameOf(a.creator_user_id)}</span>
                  <div className="flex-1" />
                  <button onClick={() => unlinkPair(a.id)} className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Admin divisions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-accent" />
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin Divisions</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Scope an admin to one or more department windows. Admins without any division retain full access.
            </p>
            <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[320px] overflow-y-auto">
              {admins.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No admins yet. Grant the Admin role above first.</div>
              )}
              {admins.map((p) => {
                const userDivs = divisions.filter((d) => d.user_id === p.user_id);
                const userDivValues = userDivs.map((d) => d.division);
                return (
                  <div key={p.user_id} className="p-3 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate inline-flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-accent" /> {p.display_name || "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{p.user_id}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {userDivs.map((d) => {
                        const meta = DIVISIONS.find((x) => x.value === d.division);
                        return (
                          <button
                            key={d.id}
                            onClick={() => removeDivision(d.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-primary/40 bg-primary/10 text-primary hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive transition"
                            title="Click to remove"
                          >
                            {meta?.icon} {meta?.label || d.division} <Trash2 className="w-3 h-3 ml-0.5" />
                          </button>
                        );
                      })}
                      {userDivValues.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic px-1">All divisions</span>
                      )}
                    </div>
                    <Select onValueChange={(v) => addDivision(p.user_id, v as Division)}>
                      <SelectTrigger className="h-8 w-[170px] bg-secondary/40 border-border/60 text-xs">
                        <SelectValue placeholder="+ Add division" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.filter((d) => !userDivValues.includes(d.value)).map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            <span className="inline-flex items-center gap-2">{d.icon} {d.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
