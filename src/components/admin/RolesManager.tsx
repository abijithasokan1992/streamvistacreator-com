import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserCog, Plus, Trash2, Crown, Camera, Users, Eye, Link2, Briefcase, Wallet, Code2, Megaphone, LayoutGrid, Lock, Unlock, ShieldCheck, Scale, Building2, ShoppingBag, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// =====================================================================
// MVP RBAC (7 roles).
//   Public sign-up: content_owner ("Creator"), studio, buyer
//   Invite-only:    admin, super_admin, qc_reviewer, legal_reviewer
//
// Dormant / Phase 2 roles (executive_producer, distributor, localization_partner,
// studio sub-roles, admin divisions, EP→Creator linkage) still exist in the DB
// but are intentionally not exposed in this MVP admin UI. They can be re-enabled
// in Phase 2 without a migration.
// =====================================================================
type Role =
  | "super_admin"
  | "admin"
  | "qc_reviewer"
  | "legal_reviewer"
  | "content_owner"
  | "studio"
  | "buyer";

const ROLES: { value: Role; label: string; icon: React.ReactNode; inviteOnly?: boolean }[] = [
  { value: "super_admin",    label: "Super Admin",    icon: <Sparkles className="w-3.5 h-3.5" />,    inviteOnly: true },
  { value: "admin",          label: "Admin",          icon: <Crown className="w-3.5 h-3.5" />,       inviteOnly: true },
  { value: "qc_reviewer",    label: "QC Reviewer",    icon: <ShieldCheck className="w-3.5 h-3.5" />, inviteOnly: true },
  { value: "legal_reviewer", label: "Legal Reviewer", icon: <Scale className="w-3.5 h-3.5" />,       inviteOnly: true },
  { value: "content_owner",  label: "Creator",        icon: <Camera className="w-3.5 h-3.5" /> },
  { value: "studio",         label: "Studio",         icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "buyer",          label: "Buyer",          icon: <ShoppingBag className="w-3.5 h-3.5" /> },
];
// NOTE: legacy/dormant roles (executive_producer, distributor, localization_partner,
// studio_*, moderator, user, client, creator) are intentionally NOT in this list.
// They remain in the DB enum and continue to work for any account already holding
// them, but they cannot be granted from this MVP admin UI.

type Division = "ops" | "finance" | "dev" | "marketing";
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
  const [unlocked, setUnlocked] = useState(false);

  const guard = () => {
    if (!unlocked) {
      toast.error("Editing is locked. Unlock at the top to make changes.");
      return false;
    }
    return true;
  };

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
    if (!guard()) return;
    if (rolesByUser(uid).includes(role)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success(`Added ${role}`);
    load();
  };
  const removeRole = async (uid: string, role: Role) => {
    if (!guard()) return;
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
    if (!guard()) return;
    if (!epPick || !crPick) return toast.error("Pick both an EP and a Creator");
    const { error } = await supabase.from("producer_assignments").insert({
      ep_user_id: epPick, creator_user_id: crPick,
    });
    if (error) return toast.error(error.message);
    toast.success("Assignment linked");
    setEpPick(""); setCrPick(""); load();
  };
  const unlinkPair = async (id: string) => {
    if (!guard()) return;
    const { error } = await supabase.from("producer_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unlinked");
    load();
  };

  // Admin divisions
  const divisionsByUser = (uid: string) => divisions.filter((d) => d.user_id === uid).map((d) => d.division);
  const addDivision = async (uid: string, division: Division) => {
    if (!guard()) return;
    if (divisionsByUser(uid).includes(division)) return;
    const { error } = await (supabase.from("admin_divisions" as any) as any).insert({ user_id: uid, division });
    if (error) return toast.error(error.message);
    toast.success(`Division added`);
    load();
  };
  const removeDivision = async (id: string) => {
    if (!guard()) return;
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

      {/* Lock toggle */}
      <div className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${unlocked ? "border-destructive/40 bg-destructive/5" : "border-accent/30 bg-accent/5"}`}>
        <div className="flex items-center gap-2 min-w-0">
          {unlocked ? <Unlock className="w-4 h-4 text-destructive shrink-0" /> : <Lock className="w-4 h-4 text-accent shrink-0" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Editing is {unlocked ? "Unlocked" : "Locked"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {unlocked
                ? "All role, assignment, and division controls are active. Re-lock when done."
                : "All add / remove controls are disabled to prevent accidental changes."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{unlocked ? "Unlock" : "Lock"}</span>
          <Switch checked={unlocked} onCheckedChange={setUnlocked} />
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
                            disabled={!unlocked}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-accent/40 bg-accent/10 text-accent hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent/10 disabled:hover:border-accent/40 disabled:hover:text-accent"
                            title={unlocked ? "Click to remove" : "Unlock editing to remove"}
                          >
                            {meta?.icon} {meta?.label || r} <Trash2 className="w-3 h-3 ml-0.5" />
                          </button>
                        );
                      })}
                    </div>
                    <Select disabled={!unlocked} onValueChange={(v) => addRole(p.user_id, v as Role)}>
                      <SelectTrigger className="h-8 w-[150px] bg-secondary/40 border-border/60 text-xs disabled:opacity-50">
                        <SelectValue placeholder={unlocked ? "+ Add role" : "🔒 Locked"} />
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
              <Select value={epPick} onValueChange={setEpPick} disabled={!unlocked}>
                <SelectTrigger className="bg-secondary/40 border-border/60 disabled:opacity-50"><SelectValue placeholder={unlocked ? "Pick an EP" : "🔒 Locked"} /></SelectTrigger>
                <SelectContent>
                  {eps.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No users have the EP role yet</div>}
                  {eps.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0,8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={crPick} onValueChange={setCrPick} disabled={!unlocked}>
                <SelectTrigger className="bg-secondary/40 border-border/60 disabled:opacity-50"><SelectValue placeholder={unlocked ? "Pick a Creator" : "🔒 Locked"} /></SelectTrigger>
                <SelectContent>
                  {creators.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No users have the Creator role yet</div>}
                  {creators.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.user_id.slice(0,8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={linkPair} disabled={!unlocked} className="bg-gradient-primary text-primary-foreground">
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
                  <button onClick={() => unlinkPair(a.id)} disabled={!unlocked} className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground" title={unlocked ? "Unlink" : "Unlock editing to unlink"}>
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
                            disabled={!unlocked}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-primary/40 bg-primary/10 text-primary hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary/10 disabled:hover:border-primary/40 disabled:hover:text-primary"
                            title={unlocked ? "Click to remove" : "Unlock editing to remove"}
                          >
                            {meta?.icon} {meta?.label || d.division} <Trash2 className="w-3 h-3 ml-0.5" />
                          </button>
                        );
                      })}
                      {userDivValues.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic px-1">All divisions</span>
                      )}
                    </div>
                    <Select disabled={!unlocked} onValueChange={(v) => addDivision(p.user_id, v as Division)}>
                      <SelectTrigger className="h-8 w-[170px] bg-secondary/40 border-border/60 text-xs disabled:opacity-50">
                        <SelectValue placeholder={unlocked ? "+ Add division" : "🔒 Locked"} />
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
