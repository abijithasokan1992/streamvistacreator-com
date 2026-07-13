import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserCog, Building2, BadgeCheck, ShieldCheck, X, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Internal StreamVista staff management.
 *
 * This page does NOT change the 7-role MVP public RBAC. It layers
 * department + designation + permission-bundle metadata onto users
 * who already hold one of the four invite-only base roles:
 *   admin · super_admin · qc_reviewer · legal_reviewer.
 */

type Department =
  | "finance" | "billing" | "audit" | "management"
  | "operations" | "legal" | "qc" | "engineering";

type Designation =
  | "auditor" | "accounts_staff" | "billing_staff" | "finance_approver"
  | "finance_head" | "ca_finance_reviewer" | "management_reviewer"
  | "ops_lead" | "engineering";

type Permission =
  | "finance_read" | "finance_admin" | "billing_ops" | "invoice_approval"
  | "refund_approval" | "manual_invoice_write" | "subscription_read"
  | "audit_readonly" | "finance_reports" | "management_reports"
  | "review_ops" | "buyer_request_ops" | "storage_adjustment_ops";

type StaffStatus = "invited" | "active" | "suspended";

type StaffRow = {
  user_id: string;
  full_name: string;
  email: string;
  department: Department;
  designation: Designation;
  status: StaffStatus;
  notes: string | null;
  updated_at: string;
};

type PermissionRow = { user_id: string; permission: Permission };

type BaseRole = "admin" | "super_admin" | "qc_reviewer" | "legal_reviewer";
type UserRoleRow = { user_id: string; role: BaseRole | string };
type ProfileRow = { user_id: string; display_name: string | null; email?: string | null };

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "finance", label: "Finance" },
  { value: "billing", label: "Billing" },
  { value: "audit", label: "Audit" },
  { value: "management", label: "Management" },
  { value: "operations", label: "Operations" },
  { value: "legal", label: "Legal" },
  { value: "qc", label: "QC" },
  { value: "engineering", label: "Engineering" },
];

const DESIGNATIONS: { value: Designation; label: string }[] = [
  { value: "auditor", label: "Auditor" },
  { value: "accounts_staff", label: "Accounts Staff" },
  { value: "billing_staff", label: "Billing Staff" },
  { value: "finance_approver", label: "Finance Approver" },
  { value: "finance_head", label: "Finance Head" },
  { value: "ca_finance_reviewer", label: "CA / Finance Reviewer" },
  { value: "management_reviewer", label: "Management Reviewer" },
  { value: "ops_lead", label: "Operations Lead" },
  { value: "engineering", label: "Engineering" },
];

const PERMISSIONS: { value: Permission; label: string; group: "Finance" | "Billing" | "Reporting" | "Ops" }[] = [
  { value: "finance_read",          label: "finance_read",          group: "Finance" },
  { value: "finance_admin",         label: "finance_admin",         group: "Finance" },
  { value: "invoice_approval",      label: "invoice_approval",      group: "Finance" },
  { value: "refund_approval",       label: "refund_approval",       group: "Finance" },
  { value: "billing_ops",           label: "billing_ops",           group: "Billing" },
  { value: "manual_invoice_write",  label: "manual_invoice_write",  group: "Billing" },
  { value: "subscription_read",     label: "subscription_read",     group: "Billing" },
  { value: "audit_readonly",        label: "audit_readonly",        group: "Reporting" },
  { value: "finance_reports",       label: "finance_reports",       group: "Reporting" },
  { value: "management_reports",    label: "management_reports",    group: "Reporting" },
  { value: "review_ops",            label: "review_ops",            group: "Ops" },
  { value: "buyer_request_ops",     label: "buyer_request_ops",     group: "Ops" },
  { value: "storage_adjustment_ops",label: "storage_adjustment_ops",group: "Ops" },
];

const STATUS_META: Record<StaffStatus, { label: string; cls: string }> = {
  invited:   { label: "Invited",   cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  active:    { label: "Active",    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  suspended: { label: "Suspended", cls: "bg-destructive/15 text-destructive border-destructive/40" },
};

const DEPT_LABEL = (d: Department) => DEPARTMENTS.find((x) => x.value === d)?.label ?? d;
const DESG_LABEL = (d: Designation) => DESIGNATIONS.find((x) => x.value === d)?.label ?? d;

export default function AdminTeamManager() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, p, r, pr] = await Promise.all([
      supabase.from("admin_staff_profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("admin_staff_permissions").select("user_id, permission"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_profiles").select("user_id, display_name"),
    ]);
    if (s.error)  toast.error(s.error.message);
    if (p.error)  toast.error(p.error.message);
    setStaff((s.data ?? []) as StaffRow[]);
    setPerms((p.data ?? []) as PermissionRow[]);
    setRoles((r.data ?? []) as UserRoleRow[]);
    setProfiles((pr.data ?? []) as ProfileRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const baseRoleOf = (uid: string): BaseRole | null => {
    const owned = roles.filter((x) => x.user_id === uid).map((x) => x.role);
    const order: BaseRole[] = ["super_admin", "admin", "qc_reviewer", "legal_reviewer"];
    for (const r of order) if (owned.includes(r)) return r;
    return null;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter((s) =>
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      DEPT_LABEL(s.department).toLowerCase().includes(q) ||
      DESG_LABEL(s.designation).toLowerCase().includes(q),
    );
  }, [staff, search]);

  const deleteStaff = async (user_id: string) => {
    if (!confirm("Remove this internal staff profile? Their base role is not affected.")) return;
    const { error } = await supabase.from("admin_staff_profiles").delete().eq("user_id", user_id);
    if (error) return toast.error(error.message);
    toast.success("Staff profile removed");
    load();
  };

  return (
    <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-5">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
          <UserCog className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold">Internal Admin Team</h3>
          <p className="text-xs text-muted-foreground">
            Department, designation and permission bundles for StreamVista staff.
            Base roles ({" "}
            <span className="font-mono">admin · super_admin · qc_reviewer · legal_reviewer</span>
            {" "}) are managed in <span className="font-mono">Users &amp; Access</span>; this layer
            adds finance / billing / audit scoping.
          </p>
        </div>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-1" /> Add staff
            </Button>
          </DialogTrigger>
          <StaffEditor
            mode="add"
            roles={roles}
            profiles={profiles}
            existing={staff}
            permsForUser={(uid) => perms.filter((p) => p.user_id === uid).map((p) => p.permission)}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); load(); }}
          />
        </Dialog>
      </header>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, department or designation…"
          className="bg-secondary/40 border-border/60"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading staff…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No internal staff yet. Click <span className="text-foreground font-medium">Add staff</span> to register the first profile.
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 divide-y divide-border/40 overflow-hidden">
          {filtered.map((s) => {
            const userPerms = perms.filter((p) => p.user_id === s.user_id).map((p) => p.permission);
            const base = baseRoleOf(s.user_id);
            return (
              <div key={s.user_id} className="p-4 grid sm:grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold">{s.full_name}</div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider", STATUS_META[s.status].cls)}>
                      {STATUS_META[s.status].label}
                    </span>
                    {base ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md border border-accent/40 bg-accent/10 text-accent font-mono">
                        {base}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive">
                        no base role · grant one in Users &amp; Access
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.email}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {DEPT_LABEL(s.department)}</span>
                    <span className="inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> {DESG_LABEL(s.designation)}</span>
                  </div>
                  {userPerms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {userPerms.map((p) => (
                        <span key={p} className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary">{p}</span>
                      ))}
                    </div>
                  )}
                  {s.notes && (
                    <div className="text-[11px] text-muted-foreground/80 italic mt-1.5">{s.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={editing?.user_id === s.user_id} onOpenChange={(o) => setEditing(o ? s : null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                    </DialogTrigger>
                    {editing?.user_id === s.user_id && (
                      <StaffEditor
                        mode="edit"
                        initial={s}
                        initialPerms={userPerms}
                        roles={roles}
                        profiles={profiles}
                        existing={staff}
                        permsForUser={(uid) => perms.filter((p) => p.user_id === uid).map((p) => p.permission)}
                        onClose={() => setEditing(null)}
                        onSaved={() => { setEditing(null); load(); }}
                      />
                    )}
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => deleteStaff(s.user_id)} title="Remove staff profile" aria-label="Remove staff profile">
                    <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                  </Button>

                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="rounded-2xl border border-border/40 bg-secondary/20 p-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">RBAC note:</span> internal designations and
        permission bundles never appear on the public sign-up flow. Only Creator, Studio and Buyer
        can self-sign-up; all entries here are invite-only.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StaffEditor(props: {
  mode: "add" | "edit";
  initial?: StaffRow;
  initialPerms?: Permission[];
  roles: UserRoleRow[];
  profiles: ProfileRow[];
  existing: StaffRow[];
  permsForUser: (uid: string) => Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mode, initial, initialPerms = [], roles, profiles, existing, onClose, onSaved } = props;
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string>(initial?.user_id ?? "");
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [department, setDepartment] = useState<Department>(initial?.department ?? "finance");
  const [designation, setDesignation] = useState<Designation>(initial?.designation ?? "accounts_staff");
  const [status, setStatus] = useState<StaffStatus>(initial?.status ?? "invited");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set(initialPerms));

  // Candidate users: those holding an invite-only base role.
  const invitedRoleHolders = useMemo(() => {
    const allowed = new Set<string>(["admin", "super_admin", "qc_reviewer", "legal_reviewer"]);
    const uids = new Set<string>();
    roles.forEach((r) => { if (allowed.has(r.role)) uids.add(r.user_id); });
    const existingIds = new Set(existing.map((s) => s.user_id));
    return [...uids]
      .filter((uid) => mode === "edit" || !existingIds.has(uid))
      .map((uid) => ({
        user_id: uid,
        display: profiles.find((p) => p.user_id === uid)?.display_name || uid.slice(0, 8),
      }));
  }, [roles, profiles, existing, mode]);

  const togglePerm = (p: Permission) =>
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });

  const save = async () => {
    if (!userId)   return toast.error("Pick a user");
    if (!fullName) return toast.error("Full name required");
    if (!email)    return toast.error("Email required");
    setSaving(true);

    const payload = {
      user_id: userId,
      full_name: fullName.trim(),
      email: email.trim(),
      department,
      designation,
      status,
      notes: notes.trim() || null,
    };

    const { error } = await supabase
      .from("admin_staff_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) { setSaving(false); return toast.error(error.message); }

    // Replace permission set
    const existingForUser = props.permsForUser(userId);
    const toRemove = existingForUser.filter((p) => !selectedPerms.has(p));
    const toAdd = [...selectedPerms].filter((p) => !existingForUser.includes(p));

    if (toRemove.length) {
      const { error: e1 } = await supabase
        .from("admin_staff_permissions")
        .delete()
        .eq("user_id", userId)
        .in("permission", toRemove);
      if (e1) { setSaving(false); return toast.error(e1.message); }
    }
    if (toAdd.length) {
      const { error: e2 } = await supabase
        .from("admin_staff_permissions")
        .insert(toAdd.map((p) => ({ user_id: userId, permission: p })));
      if (e2) { setSaving(false); return toast.error(e2.message); }
    }

    setSaving(false);
    toast.success(mode === "add" ? "Staff profile created" : "Staff profile updated");
    onSaved();
  };

  const groups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          {mode === "add" ? "Add internal staff" : `Edit ${initial?.full_name}`}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {mode === "add" && (
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-secondary/40 border-border/60">
                <SelectValue placeholder="Pick a user with admin / super_admin / qc_reviewer / legal_reviewer" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {invitedRoleHolders.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No eligible users. Grant an invite-only base role in Users &amp; Access first.
                  </div>
                )}
                {invitedRoleHolders.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.display} <span className="text-muted-foreground font-mono">· {u.user_id.slice(0, 8)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="CA Aruna Sankar" className="bg-secondary/40 border-border/60" />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@streamvista.in" className="bg-secondary/40 border-border/60" />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Department</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
              <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Designation</Label>
            <Select value={designation} onValueChange={(v) => setDesignation(v as Designation)}>
              <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESIGNATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StaffStatus)}>
              <SelectTrigger className="bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes, scope hints…" rows={2} className="bg-secondary/40 border-border/60" />
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Permission bundles</Label>
          <div className="mt-2 space-y-3">
            {groups.map((g) => (
              <div key={g}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{g}</div>
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                    const on = selectedPerms.has(p.value);
                    return (
                      <button
                        type="button"
                        key={p.value}
                        onClick={() => togglePerm(p.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors",
                          on
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-border/60 bg-input/20 text-muted-foreground hover:border-border",
                        )}
                      >
                        {on ? "✓ " : ""}{p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
