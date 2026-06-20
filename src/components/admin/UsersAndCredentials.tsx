import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Users, ShieldAlert, Trash2, Pause, Play, Eye, Crown, Camera, Receipt,
  Briefcase, History, Mail, Search, RefreshCw, Copy, Check, KeyRound, UserPlus, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import UserEntitlementDrillIn, { type EntitlementTarget } from "@/components/admin/UserEntitlementDrillIn";

type Role = "admin" | "executive_producer" | "creator" | "moderator" | "client" | "user";
const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "executive_producer", label: "Executive Producer" },
  { value: "creator", label: "Creator" },
  { value: "moderator", label: "Moderator" },
  { value: "client", label: "Client" },
  { value: "user", label: "User" },
];
const PLANS = ["free", "creator", "studio", "enterprise"];

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  roles: Role[];
  primary_role: Role | null;
  plan_tier: string;
  is_suspended: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  admin_email: string | null;
  target_email: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const roleColor = (r: Role) => ({
  admin: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  executive_producer: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  creator: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  moderator: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  client: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  user: "bg-muted text-muted-foreground border-border",
}[r]);

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message ?? "Request failed");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function UsersAndCredentials() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffOnly, setStaffOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [viewing, setViewing] = useState<UserRow | null>(null);
  const [viewDetail, setViewDetail] = useState<any>(null);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editRoles, setEditRoles] = useState<Role[]>([]);
  const [editPlan, setEditPlan] = useState<string>("free");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [entitlementTarget, setEntitlementTarget] = useState<EntitlementTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        callAdmin("list", { staffOnly, search }),
        callAdmin("audit", { limit: 50 }),
      ]);
      setRows(u.users ?? []);
      setAudit(a.entries ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [staffOnly, search]);

  useEffect(() => { load(); }, [load]);

  const onView = async (row: UserRow) => {
    setViewing(row);
    setViewDetail(null);
    try {
      const d = await callAdmin("get", { user_id: row.id });
      setViewDetail(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user");
    }
  };

  const onEdit = (row: UserRow) => {
    setEditing(row);
    setEditRoles(row.roles);
    setEditPlan(row.plan_tier || "free");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await callAdmin("setRolesAndPlan", {
        user_id: editing.id,
        roles: editRoles,
        plan_tier: editPlan,
      });
      toast.success("Updated");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async (row: UserRow) => {
    try {
      await callAdmin("setSuspended", { user_id: row.id, suspended: !row.is_suspended });
      toast.success(row.is_suspended ? "Account released" : "Account put on hold");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleteConfirm.trim().toLowerCase() !== (deleting.email ?? "").toLowerCase()) {
      toast.error("Email does not match");
      return;
    }
    try {
      await callAdmin("deleteUser", { user_id: deleting.id });
      toast.success("User deleted");
      setDeleting(null);
      setDeleteConfirm("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-8">
      {/* My credentials card */}
      <AdminSelfCredentials onInvited={load} />

      {/* Users table */}
      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-accent" /> Users</h2>
            <p className="text-xs text-muted-foreground mt-1">{rows.length} accounts · full lifecycle control · every action is logged.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="staff-only" checked={staffOnly} onCheckedChange={setStaffOnly} />
              <Label htmlFor="staff-only" className="text-xs">Staff only</Label>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or name…"
                className="pl-9 w-64 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : visibleRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No users match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 pr-3 font-medium">User</th>
                  <th className="text-left py-2 pr-3 font-medium">Role</th>
                  <th className="text-left py-2 pr-3 font-medium">Plan</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-left py-2 pr-3 font-medium">Last sign-in</th>
                  <th className="text-right py-2 pl-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const isSelf = row.id === user?.id;
                  return (
                    <tr key={row.id} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-xs font-semibold">
                              {(row.email ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.email ?? "—"}{isSelf && <span className="ml-1 text-[10px] text-accent">(you)</span>}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{row.display_name ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {row.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {row.roles.map(r => (
                            <Badge key={r} variant="outline" className={`text-[10px] ${roleColor(r)}`}>{r}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-xs uppercase tracking-wider text-muted-foreground">{row.plan_tier}</td>
                      <td className="py-3 pr-3">
                        {row.is_suspended ? (
                          <Badge className="bg-red-500/15 text-red-300 border-red-500/30 border">On hold</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 border">Active</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">{fmtDate(row.last_sign_in_at)}</td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => onView(row)} title="View">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => setEntitlementTarget({ user_id: row.id, email: row.email, display_name: row.display_name })}
                            title="Billing & entitlement">
                            <Receipt className="w-4 h-4 text-accent" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onEdit(row)} title="Modify">
                            <Crown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSuspend(row)}
                            disabled={isSelf}
                            title={row.is_suspended ? "Release hold" : "Hold"}
                          >
                            {row.is_suspended ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setDeleting(row); setDeleteConfirm(""); }}
                            disabled={isSelf}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><History className="w-5 h-5 text-accent" /> Audit log</h2>
          <p className="text-xs text-muted-foreground mt-1">Last {audit.length} administrative actions. Immutable.</p>
        </div>
        {audit.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No entries yet.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {audit.map(e => (
              <div key={e.id} className="py-3 text-sm grid sm:grid-cols-[1fr_auto] gap-2">
                <div>
                  <span className="font-mono text-xs text-accent">{e.action}</span>{" "}
                  <span className="text-muted-foreground">by</span>{" "}
                  <span className="font-medium">{e.admin_email ?? "—"}</span>
                  {e.target_email && (
                    <>
                      {" "}<span className="text-muted-foreground">on</span>{" "}
                      <span className="font-medium">{e.target_email}</span>
                    </>
                  )}
                  {Object.keys(e.details ?? {}).length > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono break-all">{JSON.stringify(e.details)}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View drawer */}
      <Sheet open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{viewing?.email}</SheetTitle>
          </SheetHeader>
          {!viewDetail ? (
            <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-5 mt-4 text-sm">
              <Section label="Display name" value={viewDetail.profile?.display_name ?? "—"} />
              <Section label="Plan" value={viewDetail.profile?.plan_tier ?? "free"} />
              <Section label="Status" value={viewDetail.profile?.is_suspended ? "On hold" : "Active"} />
              <Section label="Studio" value={viewDetail.profile?.studio_name ?? "—"} />
              <Section label="Onboarding" value={viewDetail.profile?.onboarding_step ?? "—"} />
              <Section label="Created" value={fmtDate(viewDetail.user?.created_at)} />
              <Section label="Last sign-in" value={fmtDate(viewDetail.user?.last_sign_in_at)} />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">All roles</div>
                <div className="flex flex-wrap gap-1">
                  {(viewDetail.roles ?? []).map((r: Role) => (
                    <Badge key={r} variant="outline" className={`text-[10px] ${roleColor(r)}`}>{r}</Badge>
                  ))}
                  {(!viewDetail.roles || viewDetail.roles.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Recent actions on this user</div>
                <div className="space-y-2">
                  {(viewDetail.audit ?? []).length === 0 && <div className="text-xs text-muted-foreground">No entries.</div>}
                  {(viewDetail.audit ?? []).map((e: AuditEntry) => (
                    <div key={e.id} className="text-xs rounded-md bg-secondary/40 p-2">
                      <span className="font-mono text-accent">{e.action}</span> by {e.admin_email ?? "—"} · {fmtDate(e.created_at)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify {editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Roles</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ALL_ROLES.map(r => (
                  <label key={r.value} className="flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-secondary/30 cursor-pointer">
                    <Checkbox
                      checked={editRoles.includes(r.value)}
                      onCheckedChange={c => {
                        setEditRoles(prev => c ? Array.from(new Set([...prev, r.value])) : prev.filter(x => x !== r.value));
                      }}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plan tier</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-400" /> Delete user</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This permanently removes <span className="font-semibold text-foreground">{deleting?.email}</span> and all associated profile/role data. This cannot be undone.
            </p>
            <div>
              <Label className="text-xs">Type the email to confirm</Label>
              <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}

function AdminSelfCredentials({ onInvited }: { onInvited: () => void }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const adminUrl = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(adminUrl);
      setCopied(true);
      toast.success("Admin link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const sendReset = async () => {
    setSending(true);
    try {
      await callAdmin("sendRecoveryToSelf");
      toast.success(`Reset link sent to ${user?.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSending(false); }
  };

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    setInviting(true);
    try {
      await callAdmin("inviteAdmin", { email });
      toast.success(`Invite sent to ${email}`);
      setInviteEmail("");
      onInvited();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setInviting(false); }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-accent" /> My admin credentials</h2>
        <p className="text-xs text-muted-foreground mt-1">Your private link to this console, plus password reset and admin invites.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin URL</Label>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 font-mono text-xs">
            <span className="truncate flex-1">{adminUrl}</span>
            <button onClick={copy} className="text-muted-foreground hover:text-accent">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground">Signed in as <span className="text-foreground">{user?.email}</span></div>
          <Button variant="outline" size="sm" onClick={sendReset} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Email me a password-reset link
          </Button>
        </div>

        <div className="space-y-3">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> Invite a new admin</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="admin@studio.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={invite} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">A magic-link invite is sent. On first sign-in they land in <span className="font-mono">/admin</span> with the admin role pre-assigned.</p>
        </div>
      </div>
    </div>
  );
}
