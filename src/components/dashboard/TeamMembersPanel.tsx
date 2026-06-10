import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces, type WorkspaceRole } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Users, ShieldCheck, Crown } from "lucide-react";
import {
  classifyUser,
  userClassLabel,
  isServiceAccount,
  SERVICE_ACCOUNT_EMAIL,
} from "@/lib/businessRules";

type Member = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  email: string | null;
  display_name: string | null;
};

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export default function TeamMembersPanel() {
  const { user } = useAuth();
  const { active, loading: wsLoading } = useWorkspaces();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");
  const [inviting, setInviting] = useState(false);

  const canManage =
    !!active && (active.role === "owner" || active.role === "admin");

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", active.id);
    if (error) {
      setLoading(false);
      toast.error("Failed to load team members");
      return;
    }
    const rows = (data ?? []) as Array<Omit<Member, "email" | "display_name">>;
    const userIds = rows.map((r) => r.user_id);
    let profiles: Record<string, { email: string | null; display_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await (supabase as any)
        .from("user_profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      for (const p of (profs ?? []) as any[]) {
        profiles[p.user_id] = { email: null, display_name: p.display_name ?? null };
      }
    }
    setMembers(
      rows
        .map((r) => ({
          ...r,
          email: profiles[r.user_id]?.email ?? null,
          display_name: profiles[r.user_id]?.display_name ?? null,
        }))
        // Hide the backend service account from team UI.
        .filter((m) => !isServiceAccount(m.email)),
    );
    setLoading(false);
  }, [active?.id]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!active) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (email === SERVICE_ACCOUNT_EMAIL) {
      toast.error("That address is reserved for system emails");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("workspace-invite", {
      body: { workspace_id: active.id, email, role: inviteRole },
    });
    setInviting(false);
    if (error) {
      toast.error(error.message || "Invite failed");
      return;
    }
    if ((data as any)?.pending) {
      toast.success(`Invite recorded for ${email}. They'll join your workspace on signup.`);
    } else {
      toast.success(`${email} added as ${(data as any)?.role ?? inviteRole}`);
    }
    setInviteEmail("");
    setInviteRole("editor");
    load();
  };

  const changeRole = async (m: Member, role: WorkspaceRole) => {
    if (!canManage || m.role === role) return;
    const { error } = await (supabase as any)
      .from("workspace_members")
      .update({ role })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  };

  const remove = async (m: Member) => {
    if (!canManage) return;
    if (m.role === "owner") { toast.error("You can't remove the owner."); return; }
    if (!confirm(`Remove ${m.display_name || m.user_id} from this workspace?`)) return;
    const { error } = await (supabase as any)
      .from("workspace_members")
      .delete()
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    load();
  };

  if (wsLoading) {
    return (
      <div className="glass-strong rounded-3xl p-6 border border-border/40 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading workspace…
      </div>
    );
  }

  if (!active) {
    return (
      <div className="glass-strong rounded-3xl p-6 border border-border/40">
        <p className="text-sm text-muted-foreground">
          Create a workspace first to invite team members.
        </p>
      </div>
    );
  }

  return (
    <section className="glass-strong rounded-3xl p-6 md:p-7 border border-border/40 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-accent" />
        <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
          Team members
        </span>
      </div>
      <h2 className="font-display text-xl font-bold mb-1">{active.name}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Invite your crew, set their access, and manage who can edit this workspace.
      </p>

      {canManage && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            type="email"
            placeholder="teammate@studio.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            disabled={inviting}
            className="flex-1"
            maxLength={254}
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={inviting}>
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Member</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline" /> Loading…
              </td></tr>
            )}
            {!loading && members.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                No members yet.
              </td></tr>
            )}
            {!loading && members.map((m) => {
              const cls = classifyUser(m.email);
              const isMe = m.user_id === user?.id;
              return (
                <tr key={m.id} className="border-t border-border/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      <div>
                        <div className="font-medium">
                          {m.display_name || m.email || m.user_id.slice(0, 8)}
                          {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        </div>
                        {m.email && (
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={
                      cls === "staff"
                        ? "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent"
                        : "text-xs text-muted-foreground"
                    }>
                      {cls === "staff" && <ShieldCheck className="w-3 h-3" />}
                      {userClassLabel(cls)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && m.role !== "owner" && !isMe ? (
                      <Select value={m.role} onValueChange={(v) => changeRole(m, v as WorkspaceRole)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize text-muted-foreground">{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && m.role !== "owner" && !isMe && (
                      <Button variant="ghost" size="icon" onClick={() => remove(m)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!canManage && (
        <p className="text-xs text-muted-foreground mt-4">
          Only workspace owners and admins can invite or change roles.
        </p>
      )}
    </section>
  );
}
