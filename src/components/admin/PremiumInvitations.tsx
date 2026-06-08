import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Plus, Mail, Copy, Check, Ticket, Trash2, Share2, Award, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeStoragePrice, formatInr } from "@/lib/storage-pricing";

// Hardcoded defaults per business rule: 1 TB, 30 days, no discount, ₹650 + 18% GST
const DEFAULT_STORAGE_TB = 1;
const DEFAULT_VALIDITY_DAYS = 30;
const DEFAULT_DISCOUNT = 0;

// Email routing
const FROM_EMAIL = "abijithasokan@crayonspictures.com";
const CC_EMAILS = ["picturecrayons@gmail.com", "abijithasokan1992@gmail.com"];

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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted/50 text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400",
  redeemed: "bg-green-500/15 text-green-400",
  expired: "bg-destructive/15 text-destructive",
  revoked: "bg-destructive/15 text-destructive",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-destructive/15 text-destructive",
};

export default function PremiumInvitations() {
  const [rows, setRows] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  useEffect(() => {
    const ch = supabase
      .channel("admin-invitations")
      .on("postgres_changes", { event: "*", schema: "public", table: "premium_invitations" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setRows(prev => [payload.new as Invitation, ...prev.filter(r => r.id !== (payload.new as Invitation).id)]);
        } else if (payload.eventType === "UPDATE") {
          setRows(prev => prev.map(r => r.id === (payload.new as Invitation).id ? (payload.new as Invitation) : r));
        } else if (payload.eventType === "DELETE") {
          setRows(prev => prev.filter(r => r.id !== (payload.old as Invitation).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = (token: string) => `${origin}/invite/${encodeURIComponent(token)}`;
  const refUrl = (code: string | null) => code ? `${origin}/?ref=${encodeURIComponent(code)}` : "";

  const copyLink = async (inv: Invitation) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv.token));
      setCopiedId(inv.id);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const markSent = async (inv: Invitation, channel: string) => {
    const channels = Array.from(new Set([...(inv.sent_channels ?? []), channel]));
    await supabase.from("premium_invitations")
      .update({ sent_channels: channels, status: inv.status === "pending" ? "sent" : inv.status })
      .eq("id", inv.id);
  };

  const emailBodyFor = (inv: Invitation) => {
    const price = computeStoragePrice(inv.storage_tb, inv.discount_percent, inv.is_free);
    const name = inv.invitee_name || (inv.invitee_email?.split("@")[0] ?? "there");
    const refLink = refUrl(inv.referral_code);
    return [
      `Hi ${name},`,
      ``,
      `As a personal contact, here is your exclusive pricing for the Creator Cloud.`,
      ``,
      `• Storage: ${inv.storage_tb} TB`,
      `• Validity: ${inv.validity_days} days`,
      `• Your price: ${inv.is_free ? "FREE" : `${formatInr(price.totalInr)} (₹650/TB + 18% GST)`}`,
      ``,
      `Activate your account here:`,
      inviteUrl(inv.token),
      ``,
      `🎁 Your personal referral link:`,
      refLink,
      ``,
      `Share the link above on your WhatsApp status or social media. For every person who joins through your link, you will earn additional cloud storage or monthly revenue.`,
      ``,
      `Warmly,`,
      `Abijith Asokan`,
      `Crayons Pictures`,
    ].join("\n");
  };

  const sendEmail = (inv: Invitation) => {
    if (!inv.invitee_email) return toast.error("No email on this invite");
    const subject = "Your exclusive Crayons Creator Cloud invite";
    const cc = CC_EMAILS.join(",");
    // Admin will be signed into FROM_EMAIL in their mail client — From is set automatically.
    const url = `mailto:${encodeURIComponent(inv.invitee_email)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBodyFor(inv))}`;
    window.location.href = url;
    markSent(inv, "email");
  };

  const revoke = async (inv: Invitation) => {
    if (!confirm(`Revoke invite for ${inv.invitee_email ?? inv.invitee_name}?`)) return;
    const { error } = await supabase.from("premium_invitations").update({ status: "revoked" }).eq("id", inv.id);
    if (error) toast.error(error.message); else toast.success("Revoked");
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-accent" /> Premium Invitations</h2>
            <p className="text-xs text-muted-foreground mt-1">1 TB · ₹650 + 18% GST · 30-day validity · auto from {FROM_EMAIL}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Send invite</Button>
            </DialogTrigger>
            <NewInvitationDialog onCreated={() => setOpen(false)} />
          </Dialog>
        </div>

        {loading ? (
          <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No invitations yet. Send one to get started.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map(inv => {
              const price = computeStoragePrice(inv.storage_tb, inv.discount_percent, inv.is_free);
              return (
                <li key={inv.id} className="border border-border/60 rounded-xl p-4 grid md:grid-cols-[1.3fr_1fr_auto] gap-4 items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> {inv.invitee_email}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                    </div>
                    {inv.referral_code && (
                      <p className="text-[11px] text-muted-foreground mt-2 font-mono break-all">ref: {refUrl(inv.referral_code)}</p>
                    )}
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div><span className="text-muted-foreground">Storage:</span> <b>{inv.storage_tb} TB</b></div>
                    <div><span className="text-muted-foreground">Validity:</span> {inv.validity_days} days</div>
                    <div><span className="text-muted-foreground">Total:</span> <b>{formatInr(price.totalInr)}</b></div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button size="sm" variant="outline" onClick={() => copyLink(inv)} className="gap-1">
                      {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => sendEmail(inv)} className="gap-1" disabled={!inv.invitee_email}>
                      <Send className="w-3.5 h-3.5" /> Send email
                    </Button>
                    {inv.status !== "revoked" && inv.status !== "redeemed" && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(inv)} className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReferralsAdminPanel />
    </div>
  );
}

function NewInvitationDialog({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    setSaving(true);
    const expires_at = new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 86400_000).toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("premium_invitations").insert({
      invitee_name: e.split("@")[0],
      invitee_email: e,
      storage_tb: DEFAULT_STORAGE_TB,
      discount_percent: DEFAULT_DISCOUNT,
      validity_days: DEFAULT_VALIDITY_DAYS,
      is_free: false,
      expires_at,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invitation created — open the email button to send");
    setEmail("");
    onCreated();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>New premium invitation</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="inv-email">Email address</Label>
          <Input
            id="inv-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="creator@example.com"
            maxLength={255}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) submit(); }}
          />
        </div>
        <div className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground space-y-0.5">
          <div>Storage: <span className="text-foreground font-semibold">1 TB</span></div>
          <div>Validity: <span className="text-foreground font-semibold">30 days</span></div>
          <div>Price: <span className="text-foreground font-semibold">₹650 + 18% GST = ₹767</span></div>
          <div>From: <span className="text-foreground">{FROM_EMAIL}</span></div>
          <div>CC: <span className="text-foreground">{CC_EMAILS.join(", ")}</span></div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send invite
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

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
    const patch: Partial<ReferralRow> & { approved_by: string | null; approved_at: string | null } = {
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
            <ReferralAdminRow key={r.id} row={r} onApprove={(t, a) => setStatus(r, "approved", t, a)} onReject={() => setStatus(r, "rejected")} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferralAdminRow({ row, onApprove, onReject }: { row: ReferralRow; onApprove: (t: "storage_tb" | "inr", a: number) => void; onReject: () => void }) {
  const [rewardType, setRewardType] = useState<"storage_tb" | "inr">(row.reward_type ?? "storage_tb");
  const [amount, setAmount] = useState<number>(row.reward_amount || 1);
  return (
    <li className="border border-border/60 rounded-xl p-4 grid md:grid-cols-[1.2fr_1fr_auto] gap-3 items-center">
      <div className="text-sm">
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
          {row.referred_email ?? "(unknown email)"}
          <span className={`text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${STATUS_STYLES[row.status]}`}>{row.status}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">code: {row.referrer_code}</p>
      </div>
      {row.status === "pending" ? (
        <div className="flex gap-2 items-center">
          <Select value={rewardType} onValueChange={(v: "storage_tb" | "inr") => setRewardType(v)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="storage_tb">Storage (TB)</SelectItem>
              <SelectItem value="inr">Revenue (₹)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            step={rewardType === "storage_tb" ? 0.1 : 1}
            value={amount}
            onChange={e => setAmount(Math.max(0, parseFloat(e.target.value || "0")))}
            className="h-9 w-24"
          />
        </div>
      ) : (
        <div className="text-sm">
          {row.reward_type === "storage_tb" && <span><b>{row.reward_amount}</b> TB</span>}
          {row.reward_type === "inr" && <span><b>{formatInr(row.reward_amount)}</b></span>}
          {!row.reward_type && <span className="text-muted-foreground">—</span>}
        </div>
      )}
      <div className="flex gap-2 md:justify-end">
        {row.status === "pending" ? (
          <>
            <Button size="sm" onClick={() => onApprove(rewardType, amount)} className="gap-1"><Check className="w-3.5 h-3.5" /> Approve</Button>
            <Button size="sm" variant="ghost" onClick={onReject} className="text-destructive hover:text-destructive gap-1"><X className="w-3.5 h-3.5" /> Reject</Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</span>
        )}
      </div>
    </li>
  );
}
