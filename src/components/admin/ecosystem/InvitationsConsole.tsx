import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Plus, RefreshCw, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  notes: string | null;
}

const ROLE_OPTIONS = [
  { value: "content_owner", label: "Creator" },
  { value: "studio", label: "Studio" },
  { value: "buyer", label: "Buyer" },
  { value: "channel_partner", label: "Channel Partner" },
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  expired: "bg-muted/40 text-muted-foreground border-border/60",
  revoked: "bg-destructive/15 text-destructive border-destructive/40",
};

export default function InvitationsConsole() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("content_owner");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "accepted">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("role_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Could not load invitations"); return; }
    setRows((data ?? []) as Invite[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : r.status === filter)),
    [rows, filter],
  );

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    const expires = new Date();
    expires.setDate(expires.getDate() + 14);
    const { error } = await (supabase as any)
      .from("role_invitations")
      .insert({
        email: email.trim().toLowerCase(),
        role,
        status: "pending",
        invited_by: user?.id ?? null,
        notes: notes.trim() || null,
        expires_at: expires.toISOString(),
      });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation created");
    setEmail(""); setNotes("");
    load();
  };

  const copyLink = async (row: Invite) => {
    const url = `${window.location.origin}/auth?invite=${row.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(row.id);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" />
          <h3 className="font-display text-lg font-semibold">Invitations</h3>
          <span className="text-xs text-muted-foreground">Role-aware onboarding for every org kind.</span>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/40 flex items-center gap-1.5"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <form onSubmit={sendInvite} className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto] rounded-xl border border-border/40 p-3 bg-background/40">
        <input
          type="email" required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="invitee@example.com"
          className="px-3 py-2 rounded-md text-sm bg-background border border-border/60 focus:outline-none focus:border-accent"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 rounded-md text-sm bg-background border border-border/60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="px-3 py-2 rounded-md text-sm bg-background border border-border/60 focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-gradient-primary text-primary-foreground disabled:opacity-60 flex items-center gap-1.5"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Send
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "accepted"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-colors capitalize",
              filter === k
                ? "bg-accent/20 border-accent/60 text-accent"
                : "border-border/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/20">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Expires</th>
              <th className="text-left px-3 py-2">Link</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Loading…
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No invitations.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/20">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.role}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_TONE[r.status] ?? "")}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.expires_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => copyLink(r)}
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/50 hover:bg-secondary/40"
                  >
                    {copiedId === r.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
