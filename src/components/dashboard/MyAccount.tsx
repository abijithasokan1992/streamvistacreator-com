import { useEffect, useRef, useState } from "react";
import { Loader2, User, CreditCard, FileText, BarChart3, Wallet, Globe, ImagePlus, LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBranding, uploadBrandingFile, fetchBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { PLANS, planByCycle, type Cycle } from "@/components/streamvista/plans";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface Profile {
  user_id: string;
  display_name: string | null;
  studio_name: string | null;
  whatsapp: string | null;
  plan_tier: "free" | "monthly" | "quarterly" | "yearly";
  personal_logo_url: string | null;
}

const GST_RATE = 0.18;

export default function MyAccount() {
  const { user } = useAuth();
  const branding = useBranding();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) {
        const { data: created } = await supabase.from("user_profiles").insert({
          user_id: user.id,
          display_name: user.email?.split("@")[0],
          plan_tier: "free",
        }).select("*").single();
        setProfile(created as Profile);
      } else {
        setProfile(data as Profile);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || !profile) {
    return <Card className="p-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></Card>;
  }

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("user_profiles").update({
      display_name: profile.display_name,
      studio_name: profile.studio_name,
      whatsapp: profile.whatsapp,
    }).eq("user_id", profile.user_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5" />
        <h2 className="font-semibold text-lg">My Account</h2>
        <Badge variant={profile.plan_tier === "free" ? "secondary" : "default"} className="capitalize">
          {profile.plan_tier} plan
        </Badge>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
          <TabsTrigger value="profile"><User className="w-3.5 h-3.5 mr-1.5" /> Profile</TabsTrigger>
          <TabsTrigger value="account"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Account</TabsTrigger>
          <TabsTrigger value="statements"><FileText className="w-3.5 h-3.5 mr-1.5" /> Statements</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Your Name</Label>
              <Input value={profile.display_name ?? ""} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} placeholder="e.g. Abi Asokan" />
            </div>
            <div>
              <Label>Studio Name (Optional)</Label>
              <Input value={profile.studio_name ?? ""} onChange={(e) => setProfile({ ...profile, studio_name: e.target.value })} placeholder="e.g. Crayons Pictures" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input value={profile.whatsapp ?? ""} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} placeholder="+91 …" />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save profile
          </Button>

          <BrandLogoUpload
            profile={profile}
            onUpdate={(url) => setProfile({ ...profile, personal_logo_url: url })}
            allowed={!!branding?.allow_user_logos}
            paidOnly={!!branding?.user_logos_paid_only}
          />

          <SupportRequestForm />
        </TabsContent>

        <TabsContent value="account" className="space-y-5">
          <UpgradeSection currentTier={profile.plan_tier} email={user?.email ?? undefined} name={profile.display_name ?? undefined} userId={profile.user_id} onUpgraded={(tier) => setProfile({ ...profile, plan_tier: tier })} />
        </TabsContent>

        <TabsContent value="statements">
          <Statements userId={profile.user_id} />
        </TabsContent>

        <TabsContent value="analytics">
          <Analytics userId={profile.user_id} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/* ---------------- Brand logo upload (gated) ---------------- */
function BrandLogoUpload({ profile, onUpdate, allowed, paidOnly }: {
  profile: Profile;
  onUpdate: (url: string | null) => void;
  allowed: boolean;
  paidOnly: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const locked = !allowed || (paidOnly && profile.plan_tier === "free");

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `users/${profile.user_id}/logo-${Date.now()}-${file.name}`;
      const url = await uploadBrandingFile(file, path);
      const { error } = await supabase.from("user_profiles").update({ personal_logo_url: url }).eq("user_id", profile.user_id);
      if (error) throw error;
      onUpdate(url);
      toast.success("Logo updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="border border-border rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <ImagePlus className="w-4 h-4" />
        <span className="text-sm font-medium">Your Brand Logo</span>
        {locked && <Badge variant="secondary" className="text-[10px]">Paid plan only</Badge>}
      </div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-lg bg-secondary/40 border grid place-items-center overflow-hidden">
          {profile.personal_logo_url
            ? <img src={profile.personal_logo_url} alt="" className="max-h-full max-w-full object-contain" />
            : <span className="text-[10px] text-muted-foreground">No logo</span>}
        </div>
        <div className="flex-1 text-xs text-muted-foreground">
          {locked
            ? "Upgrade to a paid plan to add your studio's brand logo to your shared files."
            : "Upload a square image for best results. We keep aspect ratio automatically."}
        </div>
        <Button variant="outline" size="sm" disabled={locked || busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload"}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
      </div>
    </div>
  );
}

/* ---------------- Support requests ---------------- */
function SupportRequestForm() {
  const { user } = useAuth();
  const [type, setType] = useState<string>("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("support_requests")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMine(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const send = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast.error("Fill subject and message"); return;
    }
    setSending(true);
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id, request_type: type, subject: subject.trim(), message: message.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Request sent — we'll be in touch");
    setSubject(""); setMessage(""); load();
  };

  return (
    <div className="border border-border rounded-xl p-4 mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-4 h-4" />
        <span className="text-sm font-medium">Need something?</span>
      </div>
      <p className="text-xs text-muted-foreground">Request extra storage, ask for help, send archival requests, or ask about upgrading.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="support">General support</SelectItem>
            <SelectItem value="service">Request extra service</SelectItem>
            <SelectItem value="archival">Archival request</SelectItem>
            <SelectItem value="upgrade">Plan upgrade help</SelectItem>
            <SelectItem value="other">Something else</SelectItem>
          </SelectContent>
        </Select>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="How can we help?"
        className="w-full px-3 py-2 rounded-md bg-input/60 border border-border text-sm" />
      <Button onClick={send} disabled={sending} size="sm">
        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
        Send request
      </Button>

      {mine.length > 0 && (
        <div className="space-y-2 pt-3 border-t">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Your requests</div>
          {mine.map((r) => (
            <div key={r.id} className="text-sm border rounded-lg p-3">
              <div className="flex justify-between flex-wrap gap-2">
                <span className="font-medium">{r.subject}</span>
                <Badge variant="outline" className="capitalize text-[10px]">{r.status.replace("_", " ")}</Badge>
              </div>
              <div className="text-xs text-muted-foreground capitalize">{r.request_type} · {new Date(r.created_at).toLocaleDateString()}</div>
              {r.admin_reply && (
                <div className="mt-2 p-2 rounded bg-accent/10 text-xs"><span className="font-semibold">Reply:</span> {r.admin_reply}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Upgrade / Payment ---------------- */
function UpgradeSection({ currentTier, email, name, userId, onUpgraded }: { currentTier: string; email?: string; name?: string; userId: string; onUpgraded: (tier: Profile["plan_tier"]) => void; }) {
  const [selected, setSelected] = useState<Cycle>("monthly");
  const [provider, setProvider] = useState<"razorpay" | "card">("razorpay");
  const [busy, setBusy] = useState(false);
  const [stripeOpen, setStripeOpen] = useState(false);

  const plan = planByCycle(selected);
  const subtotal = plan.price;
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;

  const stripePriceId =
    selected === "monthly" ? "cloudx_monthly" :
    selected === "quarterly" ? "cloudx_quarterly" : "cloudx_yearly";

  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const startUpgrade = async () => {
    if (selected === "free") { toast.info("You're already on the Free plan"); return; }
    setBusy(true);
    const onboardingId = crypto.randomUUID();
    // Create an onboarding_request row to record this upgrade attempt
    const { error } = await supabase.from("onboarding_requests").insert({
      id: onboardingId,
      client_name: name ?? "Account upgrade",
      professional_role: "Existing user",
      business_email: email,
      selected_cycle: selected,
      base_price: plan.price,
      final_price: total,
      onboarding_status: "pending",
    });
    if (error) { setBusy(false); toast.error("Could not start upgrade"); return; }

    if (provider === "card") { setBusy(false); setStripeOpen(true); return; }

    const ok = await loadRazorpay();
    if (!ok) { setBusy(false); toast.error("Could not load payment gateway"); return; }
    const { data: orderData, error: orderErr } = await supabase.functions.invoke("create-razorpay-order", {
      body: { onboardingId },
    });
    if (orderErr || !orderData?.orderId) { setBusy(false); toast.error("Could not initiate payment"); return; }

    const rzp = new (window as any).Razorpay({
      key: orderData.keyId, amount: orderData.amount, currency: orderData.currency, order_id: orderData.orderId,
      name: "StreamVista Cloud X", description: `${plan.label} upgrade`,
      prefill: { name, email },
      theme: { color: "#6366f1" },
      handler: async (resp: any) => {
        const { data: vData } = await supabase.functions.invoke("verify-razorpay-payment", {
          body: {
            onboardingId: inserted.id,
            userId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          },
        });
        setBusy(false);
        if (vData?.verified) {
          onUpgraded(selected as Profile["plan_tier"]);
          toast.success(`Upgrade confirmed — you're now on the ${plan.label} plan`);
        } else toast.error("Payment could not be verified");
      },
      modal: { ondismiss: () => { setBusy(false); toast.info("Payment cancelled"); } },
    });
    rzp.open();
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-medium mb-2">Choose a plan</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PLANS.map((p) => (
            <button key={p.cycle}
              onClick={() => setSelected(p.cycle)}
              className={cn("border rounded-xl p-3 text-left transition",
                selected === p.cycle ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
                currentTier === p.cycle && "ring-1 ring-accent")}>
              <div className="text-xs uppercase text-muted-foreground">{p.label}</div>
              <div className="font-semibold">{p.priceLabel}</div>
              <div className="text-[11px] text-muted-foreground">{p.cadence}</div>
            </button>
          ))}
        </div>
      </div>

      {selected !== "free" && (
        <>
          <div>
            <div className="text-sm font-medium mb-2">Payment method</div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setProvider("razorpay")}
                className={cn("h-14 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold",
                  provider === "razorpay" ? "border-primary bg-primary/10" : "border-border")}>
                <Wallet className="w-4 h-4" /> UPI / Netbanking <span className="text-[10px] opacity-70">(India)</span>
              </button>
              <button type="button" onClick={() => setProvider("card")}
                className={cn("h-14 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold",
                  provider === "card" ? "border-primary bg-primary/10" : "border-border")}>
                <Globe className="w-4 h-4" /> Card <span className="text-[10px] opacity-70">(Global)</span>
              </button>
            </div>
          </div>

          <div className="border rounded-xl p-4 text-sm space-y-1 bg-secondary/30">
            <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{gst.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-2 border-t font-semibold"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
          </div>

          <Button onClick={startUpgrade} disabled={busy} className="w-full h-12">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Pay ₹{total.toLocaleString("en-IN")} &amp; Activate
          </Button>

          {stripeOpen && (
            <div className="mt-3 rounded-xl border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-accent">Secure card checkout</span>
                <button onClick={() => setStripeOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
              <StripeEmbeddedCheckout priceId={stripePriceId} customerEmail={email}
                returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Statements (purchases) ---------------- */
function Statements({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("onboarding_requests")
        .select("id, selected_cycle, final_price, payment_status, razorpay_payment_id, created_at")
        .order("created_at", { ascending: false });
      setRows(data ?? []); setLoading(false);
    })();
  }, [userId]);

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
  if (!rows.length) return <p className="text-sm text-muted-foreground">No purchases yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex justify-between text-sm border rounded-lg p-3 flex-wrap gap-2">
          <div>
            <div className="font-medium capitalize">{r.selected_cycle} plan</div>
            <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">₹{Number(r.final_price).toLocaleString("en-IN")}</div>
            <Badge variant={r.payment_status === "paid" ? "default" : "secondary"} className="text-[10px] capitalize">{r.payment_status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Analytics ---------------- */
function Analytics({ userId }: { userId: string }) {
  const [stats, setStats] = useState<{ files: number; bytes: number; downloads: number } | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("shared_files")
        .select("size_bytes, download_count").eq("owner_id", userId);
      const files = data?.length ?? 0;
      const bytes = (data ?? []).reduce((s: number, r: any) => s + Number(r.size_bytes || 0), 0);
      const downloads = (data ?? []).reduce((s: number, r: any) => s + Number(r.download_count || 0), 0);
      setStats({ files, bytes, downloads });
    })();
  }, [userId]);

  if (!stats) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
  const gb = stats.bytes / 1073741824;
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <Stat label="Files shared" value={stats.files.toString()} />
      <Stat label="Storage used" value={`${gb.toFixed(2)} GB`} />
      <Stat label="Total downloads" value={stats.downloads.toString()} />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
