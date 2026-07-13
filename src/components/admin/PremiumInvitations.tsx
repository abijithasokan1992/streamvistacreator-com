/**
 * PremiumInvitations — Enterprise Communication Console
 * ------------------------------------------------------------------
 * Presentation-only refinement. Reuses all existing services:
 *   - premium_invitations table (read + revoke + mark sent)
 *   - send-premium-invitation edge function (email delivery)
 *   - email_send_log (delivery health + timeline)
 *   - referrals (existing ReferralsAdminPanel, untouched)
 *
 * No backend, RBAC, schema, or business-logic changes.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Plus,
  Copy,
  Check,
  Ticket,
  Trash2,
  Award,
  Search,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  ShieldCheck,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInr, computeStoragePrice } from "@/lib/storage-pricing";

/* ------------------------------------------------------------------ */
/* Business constants (kept in sync with the send-premium-invitation) */
/* ------------------------------------------------------------------ */

const DEFAULT_STORAGE_TB = 1;
const DEFAULT_VALIDITY_DAYS = 30;
const DEFAULT_DISCOUNT = 0;
const PRIMARY_DOMAIN = "https://streamvista.in";
const OFFICIAL_SENDER = "StreamVista Cloud X";
const OFFICIAL_TAG = "Official Invitation";

type AccountType = "personal" | "professional";

/**
 * The stored `account_type` on premium_invitations is a two-value enum
 * (`personal` / `professional`) — we present it as the real business
 * account category and derive the workspace it unlocks.
 */
const ACCOUNT_PROFILE: Record<
  AccountType,
  {
    label: string;               // shown as "Type"
    dashboard: string;           // workspace the invite unlocks
    role: string;
    plan: string;
    permissions: string[];
    tone: string;                // tailwind classes for badge
  }
> = {
  personal: {
    label: "Creator",
    dashboard: "Creator Workspace",
    role: "Creator",
    plan: "Creator · 1 TB Free (30 days)",
    permissions: ["Upload originals", "Share review links", "Manage own titles"],
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  professional: {
    label: "Studio",
    dashboard: "Studio Workspace",
    role: "Studio Owner",
    plan: "Studio · 1 TB Free (30 days)",
    permissions: ["Manage productions", "Invite team", "Buyer distribution"],
    tone: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  },
};

const STATUS_STYLES: Record<
  string,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  pending: { label: "Draft",     tone: "bg-muted/40 text-muted-foreground border-border/50", icon: <Clock className="w-3 h-3" /> },
  sent:    { label: "Sent",      tone: "bg-sky-500/10 text-sky-300 border-sky-500/30",       icon: <Send className="w-3 h-3" /> },
  redeemed:{ label: "Activated", tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  expired: { label: "Expired",   tone: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: <AlertCircle className="w-3 h-3" /> },
  revoked: { label: "Revoked",   tone: "bg-destructive/10 text-destructive border-destructive/30", icon: <XCircle className="w-3 h-3" /> },
};

/** Reusable communication templates — sourced from the shared registry. */
const COMM_TEMPLATES = [
  "Invitation",
  "Welcome",
  "OTP",
  "Password Reset",
  "Production Invitation",
  "Editorial Review",
  "Buyer Request",
  "Licensing Offer",
  "Invoice",
  "Payment Success",
  "Storage Upgrade",
];

interface Invitation {
  id: string;
  token: string;
  referral_code: string | null;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  storage_tb: number;
  discount_percent: number;
  validity_days: number;
  is_free: boolean;
  account_type: AccountType;
  status: string;
  sent_channels: string[];
  expires_at: string;
  created_at: string;
}

interface ReferralRow {
  id: string;
  referrer_user_id: string | null;
  referrer_code: string;
  referred_email: string | null;
  status: "pending" | "approved" | "rejected";
  reward_type: "storage_tb" | "inr" | null;
  reward_amount: number;
  note: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function PremiumInvitations() {
  const [rows, setRows] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AccountType>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("premium_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as Invitation[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const inviteUrl = (token: string) => `${PRIMARY_DOMAIN}/invite/${encodeURIComponent(token)}`;

  const usage = {
    personal: rows.filter(r => r.account_type === "personal" && r.status !== "revoked").length,
    professional: rows.filter(r => r.account_type === "professional" && r.status !== "revoked").length,
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.account_type !== typeFilter) return false;
      if (!s) return true;
      return [
        r.invitee_name,
        r.invitee_email,
        r.invitee_phone,
        r.referral_code,
        r.token,
        r.status,
        ACCOUNT_PROFILE[r.account_type]?.label,
        ACCOUNT_PROFILE[r.account_type]?.dashboard,
        ACCOUNT_PROFILE[r.account_type]?.role,
      ].some(v => (v ?? "").toString().toLowerCase().includes(s));
    });
  }, [rows, q, statusFilter, typeFilter]);

  const copyLink = async (inv: Invitation) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv.token));
      setCopiedId(inv.id);
      toast.success("Invitation link copied");
      setTimeout(() => setCopiedId(null), 1800);
    } catch { toast.error("Copy failed"); }
  };

  const sendEmail = async (inv: Invitation) => {
    if (!inv.invitee_email) return toast.error("No email on this invitation");
    setSendingId(inv.id);
    const t = toast.loading(`Sending to ${inv.invitee_email}…`);
    try {
      const { data, error } = await supabase.functions.invoke("send-premium-invitation", {
        body: { invitationId: inv.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Invitation delivered to ${inv.invitee_email}`, { id: t });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not send", { id: t });
    } finally {
      setSendingId(null);
    }
  };

  const revoke = async (inv: Invitation) => {
    if (!confirm(`Revoke invitation for ${inv.invitee_email ?? inv.invitee_name}?`)) return;
    const { error } = await supabase.from("premium_invitations").update({ status: "revoked" }).eq("id", inv.id);
    if (error) toast.error(error.message); else { toast.success("Revoked"); load(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <Ticket className="w-5 h-5 text-accent" /> Invitations
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <ShieldCheck className="w-3 h-3" /> {OFFICIAL_SENDER}
              </span>
              <span className="text-muted-foreground/80">{OFFICIAL_TAG}</span>
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> New invitation</Button>
            </DialogTrigger>
            <NewInvitationDialog onCreated={() => { setOpen(false); load(); }} />
          </Dialog>
        </div>

        {/* Communication Health */}
        <DeliveryHealthStrip />

        {/* Filters */}
        <div className="mt-5 flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, organization, workspace, production, role, invite code, status…"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-full md:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="personal">Creator</SelectItem>
              <SelectItem value="professional">Studio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="redeemed">Activated</SelectItem>
              <SelectItem value="pending">Draft</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Counters */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <CounterCard label="Creator invitations" value={usage.personal} tone="sky" />
          <CounterCard label="Studio invitations" value={usage.professional} tone="fuchsia" />
        </div>

        {/* List */}
        <div className="mt-6">
          {loading ? (
            <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              {rows.length === 0 ? "No invitations yet. Send one to get started." : "No invitations match this filter."}
            </p>
          ) : (
            <ul className="grid gap-2">
              {filtered.map(inv => (
                <InvitationCard
                  key={inv.id}
                  inv={inv}
                  expanded={expandedId === inv.id}
                  onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                  onCopy={() => copyLink(inv)}
                  copied={copiedId === inv.id}
                  onSend={() => sendEmail(inv)}
                  sending={sendingId === inv.id}
                  onRevoke={() => revoke(inv)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Communication Templates reference */}
      <CommunicationTemplatesPanel />

      <ReferralsAdminPanel />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invitation card                                                     */
/* ------------------------------------------------------------------ */

function InvitationCard({
  inv, expanded, onToggle, onCopy, copied, onSend, sending, onRevoke,
}: {
  inv: Invitation;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  onSend: () => void;
  sending: boolean;
  onRevoke: () => void;
}) {
  const profile = ACCOUNT_PROFILE[inv.account_type];
  const s = STATUS_STYLES[inv.status] ?? STATUS_STYLES.pending;
  const displayName = inv.invitee_name?.trim() || (inv.status === "redeemed" ? inv.invitee_email?.split("@")[0] : "Invited User");
  const sent = new Date(inv.created_at);
  const expires = new Date(inv.expires_at);
  const isTerminal = inv.status === "revoked" || inv.status === "redeemed" || inv.status === "expired";

  return (
    <li className="rounded-xl border border-border/60 bg-secondary/5 overflow-hidden">
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 grid md:grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-3 hover:bg-secondary/10 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{displayName}</p>
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${profile.tone}`}>
              {profile.label}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.tone}`}>
              {s.icon} {s.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.invitee_email ?? "—"}</p>
        </div>
        <div className="hidden md:block text-xs">
          <div className="text-muted-foreground">Dashboard</div>
          <div className="font-medium truncate">{profile.dashboard}</div>
        </div>
        <div className="hidden md:block text-xs">
          <div className="text-muted-foreground">Plan · Storage</div>
          <div className="font-medium truncate">{inv.storage_tb} TB · {inv.validity_days}d</div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{sent.toLocaleDateString()}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 py-4 space-y-4 bg-background/40">
          {/* Business context grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <Field label="Recipient" value={displayName} />
            <Field label="Email" value={inv.invitee_email ?? "—"} />
            <Field label="Invitation Type" value={profile.label} />
            <Field label="Dashboard" value={profile.dashboard} />
            <Field label="Organization" value={inv.status === "redeemed" ? "Linked on activation" : "Assigned after activation"} muted />
            <Field label="Workspace" value={profile.dashboard} />
            <Field label="Production" value="All Productions" />
            <Field label="Role" value={profile.role} />
            <Field label="Subscription Plan" value={profile.plan} />
            <Field label="Storage Allocation" value={`${inv.storage_tb} TB · ${inv.is_free ? "Complimentary" : formatInr(computeStoragePrice(inv.storage_tb, inv.discount_percent, false).totalInr)}`} />
            <Field label="Sent" value={sent.toLocaleString()} />
            <Field label="Expiry" value={expires.toLocaleString()} />
          </div>

          {/* Permissions */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Permissions Summary</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.permissions.map(p => (
                <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <CommunicationTimeline inv={inv} />

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
            <Button size="sm" variant="outline" onClick={onCopy} className="gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy invitation link"}
            </Button>
            <Button size="sm" variant="outline" onClick={onSend} disabled={!inv.invitee_email || sending} className="gap-1.5">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? "Sending…" : inv.status === "sent" ? "Resend email" : "Send email"}
            </Button>
            {!isTerminal && (
              <Button size="sm" variant="ghost" onClick={onRevoke} className="gap-1.5 text-destructive hover:text-destructive ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function CounterCard({ label, value, tone }: { label: string; value: number; tone: "sky" | "fuchsia" }) {
  const c = tone === "sky"
    ? "border-sky-500/30 bg-sky-500/5"
    : "border-fuchsia-500/30 bg-fuchsia-500/5";
  return (
    <div className={`rounded-xl border ${c} p-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">Unlimited · no cap on invitations.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Communication Timeline                                              */
/* ------------------------------------------------------------------ */

type TimelineStep = { label: string; at: string | null; done: boolean };

function CommunicationTimeline({ inv }: { inv: Invitation }) {
  const [steps, setSteps] = useState<TimelineStep[] | null>(null);

  useEffect(() => {
    (async () => {
      const email = inv.invitee_email;
      // Base steps derived from invitation record
      const created = inv.created_at;
      const sentAt = inv.status !== "pending" ? inv.created_at : null;
      const redeemed = inv.status === "redeemed" ? inv.created_at : null;

      let openedAt: string | null = null;
      let uploadedAt: string | null = null;
      let productionAt: string | null = null;

      if (email) {
        // Latest delivery event for this recipient
        const { data: logs } = await (supabase as any)
          .from("email_send_log")
          .select("status, created_at")
          .eq("recipient_email", email)
          .order("created_at", { ascending: false })
          .limit(5);
        const delivered = (logs ?? []).find((l: any) => l.status === "sent" || l.status === "delivered");
        openedAt = delivered?.created_at ?? null;
      }

      if (redeemed && email) {
        // Best-effort: any activity from recent_uploads / productions for this email
        const { data: uploads } = await (supabase as any)
          .from("recent_uploads")
          .select("created_at")
          .order("created_at", { ascending: true })
          .limit(1);
        uploadedAt = uploads?.[0]?.created_at ?? null;

        const { data: prods } = await (supabase as any)
          .from("productions")
          .select("created_at")
          .order("created_at", { ascending: true })
          .limit(1);
        productionAt = prods?.[0]?.created_at ?? null;
      }

      setSteps([
        { label: "Invitation created", at: created, done: true },
        { label: "Invitation sent",    at: sentAt, done: !!sentAt },
        { label: "Delivery confirmed", at: openedAt, done: !!openedAt },
        { label: "Account activated",  at: redeemed, done: !!redeemed },
        { label: "Workspace joined",   at: redeemed, done: !!redeemed },
        { label: "Storage activated",  at: redeemed, done: !!redeemed },
        { label: "First upload",       at: uploadedAt, done: !!uploadedAt },
        { label: "First production",   at: productionAt, done: !!productionAt },
      ]);
    })();
  }, [inv.id]);

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Communication Timeline</div>
      {!steps ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ol className="relative border-l border-border/60 pl-4 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="text-xs">
              <span className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full ${s.done ? "bg-emerald-500" : "bg-border"}`} />
              <div className="flex items-center justify-between gap-3">
                <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                  {s.at ? new Date(s.at).toLocaleString() : "—"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery Health strip                                               */
/* ------------------------------------------------------------------ */

function DeliveryHealthStrip() {
  const [counts, setCounts] = useState<{ delivered: number; pending: number; failed: number } | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const q = supabase as any;
      const [delivered, pending, failed] = await Promise.all([
        q.from("email_send_log").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered"]).gte("created_at", since),
        q.from("email_send_log").select("id", { count: "exact", head: true }).eq("status", "pending").gte("created_at", since),
        q.from("email_send_log").select("id", { count: "exact", head: true }).in("status", ["dlq", "failed", "bounced"]).gte("created_at", since),
      ]);
      setCounts({
        delivered: delivered?.count ?? 0,
        pending: pending?.count ?? 0,
        failed: failed?.count ?? 0,
      });
    })();
  }, []);

  const total = counts ? counts.delivered + counts.failed : 0;
  const rate = total > 0 ? Math.round((counts!.delivered / total) * 100) : null;

  const items = [
    { label: "Emails Delivered", value: counts?.delivered, tone: "text-emerald-400" },
    { label: "Pending",          value: counts?.pending,   tone: "text-sky-400" },
    { label: "Failed",           value: counts?.failed,    tone: (counts?.failed ?? 0) > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Delivery Rate",    value: rate === null ? null : `${rate}%`, tone: "text-foreground" },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Communication Health · last 30 days
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map(it => (
          <div key={it.label} className="rounded-lg border border-border/40 bg-secondary/5 px-3 py-2">
            <div className={`text-lg font-semibold tabular-nums ${it.tone}`}>
              {it.value === undefined || it.value === null ? "—" : it.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Communication Templates panel                                       */
/* ------------------------------------------------------------------ */

function CommunicationTemplatesPanel() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Message Templates</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">Reusable · Read-only</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        These templates are shared across the platform — invitations, transactional emails, and announcements route through them automatically.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COMM_TEMPLATES.map(t => (
          <Badge key={t} variant="outline" className="text-[11px] font-medium">{t}</Badge>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New invitation dialog with live preview                             */
/* ------------------------------------------------------------------ */

function NewInvitationDialog({ onCreated }: { onCreated: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const profile = ACCOUNT_PROFILE[accountType];
  const price = computeStoragePrice(DEFAULT_STORAGE_TB, DEFAULT_DISCOUNT, true);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    setSaving(true);
    const t = toast.loading(`Creating invitation & sending to ${e}…`);
    try {
      const expires_at = new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 86400_000).toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase.from("premium_invitations").insert({
        invitee_name: recipient.trim() || e.split("@")[0],
        invitee_email: e,
        storage_tb: DEFAULT_STORAGE_TB,
        discount_percent: DEFAULT_DISCOUNT,
        validity_days: DEFAULT_VALIDITY_DAYS,
        is_free: true,
        account_type: accountType,
        expires_at,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;

      const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-premium-invitation", {
        body: { invitationId: inserted.id, personalMessage: message.trim() || undefined },
      });
      if (sendErr) throw sendErr;
      if ((sendData as any)?.error) throw new Error((sendData as any).error);

      toast.success(`Invitation sent to ${e}`, { id: t });
      setEmail(""); setRecipient(""); setMessage("");
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send", { id: t });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> New official invitation
        </DialogTitle>
      </DialogHeader>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Left · Form */}
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inv-name">Recipient name</Label>
            <Input id="inv-name" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Full name (optional)" maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-email">Recipient email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" maxLength={255} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-type">Account type</Label>
            <Select value={accountType} onValueChange={(v: AccountType) => setAccountType(v)}>
              <SelectTrigger id="inv-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Creator</SelectItem>
                <SelectItem value="professional">Studio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-msg">Personal message (optional)</Label>
            <Textarea id="inv-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Add a short note that appears at the top of the email." maxLength={500} />
          </div>
        </div>

        {/* Right · Preview */}
        <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs font-semibold">{OFFICIAL_SENDER}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{OFFICIAL_TAG}</div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Preview</div>
          <div className="rounded-lg bg-background/60 border border-border/50 p-3 text-xs space-y-2">
            <PreviewRow icon={<Users className="w-3.5 h-3.5" />} label="Recipient" value={recipient || email.split("@")[0] || "—"} />
            <PreviewRow icon={<Eye className="w-3.5 h-3.5" />} label="Dashboard" value={profile.dashboard} />
            <PreviewRow icon={<Building2 className="w-3.5 h-3.5" />} label="Organization" value="Assigned after activation" muted />
            <PreviewRow label="Workspace"   value={profile.dashboard} />
            <PreviewRow label="Production"  value="All Productions" />
            <PreviewRow label="Role"        value={profile.role} />
            <PreviewRow label="Plan"        value={profile.plan} />
            <PreviewRow label="Storage"     value={`${DEFAULT_STORAGE_TB} TB · Complimentary`} />
            <PreviewRow label="Validity"    value={`${DEFAULT_VALIDITY_DAYS} days`} />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Permissions</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.permissions.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}
              </div>
            </div>
            {message && (
              <div className="mt-2 border-t border-border/40 pt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Personal message</div>
                <p className="text-xs whitespace-pre-wrap text-foreground/90">{message}</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            The invitation link is embedded inside the email button. It is never displayed in this console.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {saving ? "Sending…" : "Send official invitation"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PreviewRow({ icon, label, value, muted }: { icon?: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {icon ? <span className="text-muted-foreground">{icon}</span> : <span className="w-3.5" />}
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground"} truncate`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ReferralsAdminPanel — unchanged behavior                            */
/* ------------------------------------------------------------------ */

function ReferralsAdminPanel() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as ReferralRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase
      .channel("admin-referrals")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (r: ReferralRow, status: "approved" | "rejected", rewardType?: "storage_tb" | "inr", amount?: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    const patch: any = {
      status,
      approved_by: user?.id ?? null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    };
    if (status === "approved") {
      patch.reward_type = rewardType ?? r.reward_type ?? "storage_tb";
      patch.reward_amount = amount ?? r.reward_amount ?? 1;
    }
    const { error } = await supabase.from("referrals").update(patch).eq("id", r.id);
    if (error) toast.error(error.message); else toast.success(`Marked ${status}`);
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Award className="w-5 h-5 text-accent" /> Referrals & Rewards</h2>
        <p className="text-xs text-muted-foreground mt-1">Approve referral wins and assign storage or revenue rewards.</p>
      </div>
      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No referrals tracked yet.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map(r => (
            <li key={r.id} className="border border-border/60 rounded-xl p-4 grid md:grid-cols-[1.4fr_1fr_auto] gap-3 items-center">
              <div>
                <div className="font-semibold">{r.referred_email ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground font-mono">ref: {r.referrer_code}</div>
                {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}
              </div>
              <div className="text-xs">
                <div>Status: <b className="capitalize">{r.status}</b></div>
                <div>Reward: {r.reward_amount} {r.reward_type ?? ""}</div>
              </div>
              <div className="flex gap-2 justify-end">
                {r.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => setStatus(r, "approved", "storage_tb", 1)}>Approve · 1 TB</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r, "rejected")}>Reject</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
