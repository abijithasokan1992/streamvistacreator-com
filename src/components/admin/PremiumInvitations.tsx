import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Plus, MessageCircle, Mail, Phone, Copy, Check, Ticket, Trash2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { computeStoragePrice, formatInr } from "@/lib/storage-pricing";

interface Invitation {
  id: string;
  token: string;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  storage_tb: number;
  discount_percent: number;
  validity_days: number;
  is_free: boolean;
  note: string | null;
  status: string;
  sent_channels: string[];
  expires_at: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted/50 text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400",
  redeemed: "bg-green-500/15 text-green-400",
  expired: "bg-destructive/15 text-destructive",
  revoked: "bg-destructive/15 text-destructive",
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

  // Realtime
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

  const inviteUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${encodeURIComponent(token)}`;

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

  const messageFor = (inv: Invitation) => {
    const price = computeStoragePrice(inv.storage_tb, inv.discount_percent, inv.is_free);
    const offer = inv.is_free
      ? `${inv.storage_tb} TB FREE for ${inv.validity_days} days`
      : `${inv.storage_tb} TB of premium storage — only ${formatInr(price.totalInr)} (incl. 18% GST) for ${inv.validity_days} days${inv.discount_percent > 0 ? ` · ${inv.discount_percent}% off` : ""}`;
    return `Hi ${inv.invitee_name}, you've been invited to Crayons Premium: ${offer}. Activate: ${inviteUrl(inv.token)}`;
  };

  const sendWhatsApp = (inv: Invitation) => {
    if (!inv.invitee_phone) return toast.error("No phone number on this invite");
    const num = inv.invitee_phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(messageFor(inv))}`, "_blank");
    markSent(inv, "whatsapp");
  };
  const sendSms = (inv: Invitation) => {
    if (!inv.invitee_phone) return toast.error("No phone number on this invite");
    window.location.href = `sms:${inv.invitee_phone}?body=${encodeURIComponent(messageFor(inv))}`;
    markSent(inv, "sms");
  };
  const sendEmail = (inv: Invitation) => {
    if (!inv.invitee_email) return toast.error("No email on this invite");
    const subject = "You're invited to Crayons Premium";
    window.location.href = `mailto:${inv.invitee_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageFor(inv))}`;
    markSent(inv, "email");
  };

  const revoke = async (inv: Invitation) => {
    if (!confirm(`Revoke invite for ${inv.invitee_name}?`)) return;
    const { error } = await supabase.from("premium_invitations").update({ status: "revoked" }).eq("id", inv.id);
    if (error) toast.error(error.message); else toast.success("Revoked");
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-accent" /> Premium Invitations</h2>
          <p className="text-xs text-muted-foreground mt-1">₹650/TB + 18% GST · custom vouchers, free tiers, multi-channel send</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New invitation</Button>
          </DialogTrigger>
          <NewInvitationDialog onCreated={() => setOpen(false)} />
        </Dialog>
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No invitations yet. Create one to get started.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map(inv => {
            const price = computeStoragePrice(inv.storage_tb, inv.discount_percent, inv.is_free);
            return (
              <li key={inv.id} className="border border-border/60 rounded-xl p-4 grid md:grid-cols-[1.3fr_1fr_auto] gap-4 items-start">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{inv.invitee_name}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                    {inv.is_free && <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-accent/15 text-accent flex items-center gap-1"><Gift className="w-3 h-3" /> Free tier</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    {inv.invitee_email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {inv.invitee_email}</span>}
                    {inv.invitee_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {inv.invitee_phone}</span>}
                  </div>
                  {inv.note && <p className="text-xs text-muted-foreground mt-2 italic">"{inv.note}"</p>}
                </div>
                <div className="text-sm space-y-0.5">
                  <div><span className="text-muted-foreground">Storage:</span> <b>{inv.storage_tb} TB</b></div>
                  <div><span className="text-muted-foreground">Validity:</span> {inv.validity_days} days</div>
                  <div><span className="text-muted-foreground">Total:</span> <b>{formatInr(price.totalInr)}</b> <span className="text-xs text-muted-foreground">({inv.discount_percent}% off · incl. GST)</span></div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button size="sm" variant="outline" onClick={() => copyLink(inv)} className="gap-1">
                    {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sendWhatsApp(inv)} className="gap-1" disabled={!inv.invitee_phone}>
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sendSms(inv)} className="gap-1" disabled={!inv.invitee_phone}>
                    <Send className="w-3.5 h-3.5" /> SMS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sendEmail(inv)} className="gap-1" disabled={!inv.invitee_email}>
                    <Mail className="w-3.5 h-3.5" /> Email
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
  );
}

function NewInvitationDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storageTb, setStorageTb] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [validity, setValidity] = useState(30);
  const [isFree, setIsFree] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const price = computeStoragePrice(storageTb, discount, isFree);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!email.trim() && !phone.trim()) return toast.error("Provide email or phone");
    setSaving(true);
    const expires_at = new Date(Date.now() + validity * 86400_000).toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("premium_invitations").insert({
      invitee_name: name.trim(),
      invitee_email: email.trim() || null,
      invitee_phone: phone.trim() || null,
      storage_tb: storageTb,
      discount_percent: discount,
      validity_days: validity,
      is_free: isFree,
      note: note.trim() || null,
      expires_at,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invitation created");
    setName(""); setEmail(""); setPhone(""); setStorageTb(1); setDiscount(0); setValidity(30); setIsFree(false); setNote("");
    onCreated();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New premium invitation</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="inv-name">Invitee name *</Label>
          <Input id="inv-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-phone">Phone (E.164)</Label>
            <Input id="inv-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210" maxLength={20} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="inv-tb">Storage (TB)</Label>
            <Input id="inv-tb" type="number" min={1} max={1000} value={storageTb} onChange={e => setStorageTb(Math.max(1, parseInt(e.target.value || "1", 10)))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-disc">Discount %</Label>
            <Input id="inv-disc" type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value || "0"))))} disabled={isFree} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-val">Validity (days)</Label>
            <Input id="inv-val" type="number" min={1} max={3650} value={validity} onChange={e => setValidity(Math.max(1, parseInt(e.target.value || "30", 10)))} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <Label htmlFor="inv-free" className="cursor-pointer">Free tier</Label>
            <p className="text-xs text-muted-foreground">Override discount — zero cost</p>
          </div>
          <Switch id="inv-free" checked={isFree} onCheckedChange={setIsFree} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-note">Note (internal)</Label>
          <Textarea id="inv-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} />
        </div>
        <div className="rounded-lg bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Base ({storageTb} TB × ₹650)</span><span>{formatInr(price.baseInr)}</span></div>
          {discount > 0 && !isFree && <div className="flex justify-between text-accent"><span>Discount ({discount}%)</span><span>−{formatInr(price.baseInr - price.discountedInr)}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>{formatInr(price.gstInr)}</span></div>
          <div className="flex justify-between font-bold mt-1 pt-1 border-t border-border/40"><span>Total</span><span>{formatInr(price.totalInr)}</span></div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create invitation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
