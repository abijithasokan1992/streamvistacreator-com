import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, BadgeCheck, AlertCircle, Tag, CreditCard, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { planByCycle, type Cycle } from "./plans";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { cn } from "@/lib/utils";

const ROLES = [
  "Production Studio",
  "Production House",
  "Post-Production Team",
  "VFX Facility",
  "Editor",
  "Cinematographer",
  "Director",
  "Digital Creator",
  "Independent Filmmaker",
  "Other",
];

const VALID_PROMO = "INDUSTRY100";
const PROMO_DISCOUNT = 0.1;

const GST_RATE = 0.18;

const Schema = z.object({
  accessCode: z.string().trim().max(50).optional(),
  clientName: z.string().trim().min(2, "Name required").max(200),
  professionalRole: z.string().min(1, "Select a role"),
  businessEmail: z.string().trim().email("Valid business email required").max(255).or(z.literal("")),
  contactPhone: z.string().trim().max(30).or(z.literal("")),
}).refine(d => d.businessEmail !== "" || d.contactPhone.length >= 7, {
  message: "Provide business email or WhatsApp number",
  path: ["businessEmail"],
});

interface Props {
  selected: Cycle;
}

type PromoState = "idle" | "valid" | "invalid";

export const OnboardingForm = ({ selected }: Props) => {
  const plan = planByCycle(selected);
  const [accessCode, setAccessCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoState, setPromoState] = useState<PromoState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [provider, setProvider] = useState<"razorpay" | "card">("razorpay");
  const [stripeCheckout, setStripeCheckout] = useState<null | { email?: string }>(null);

  const stripePriceId =
    selected === "monthly" ? "cloudx_monthly" :
    selected === "quarterly" ? "cloudx_quarterly" : "cloudx_yearly";

  const subtotal = useMemo(
    () => (promoApplied ? Math.round(plan.price * (1 - PROMO_DISCOUNT)) : plan.price),
    [plan.price, promoApplied]
  );
  const savings = plan.price - subtotal;
  const gstAmount = Math.round(subtotal * GST_RATE);
  const finalPrice = subtotal + gstAmount;

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (code === VALID_PROMO) {
      setPromoApplied(code);
      setPromoState("valid");
      toast.success("Promo applied — 10% discount unlocked");
    } else {
      setPromoApplied(null);
      setPromoState("invalid");
      toast.error("Invalid promo code");
    }
  };

  const removePromo = () => {
    setPromoApplied(null);
    setPromoState("idle");
    setPromoInput("");
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ accessCode, clientName, professionalRole, businessEmail, contactPhone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);

    const { data: inserted, error } = await supabase
      .from("onboarding_requests")
      .insert({
        client_name: parsed.data.clientName,
        professional_role: parsed.data.professionalRole,
        contact_phone: parsed.data.contactPhone || null,
        business_email: parsed.data.businessEmail || null,
        access_code: parsed.data.accessCode || null,
        selected_cycle: selected,
        base_price: plan.price,
        final_price: finalPrice,
        promo_code: promoApplied,
        onboarding_status: "pending",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      toast.error("Submission failed. Please try again.");
      return;
    }

    const onboardingId = inserted.id;

    // Branch on payment provider
    if (provider === "card") {
      setSubmitting(false);
      setStripeCheckout({ email: parsed.data.businessEmail || undefined });
      return;
    }

    const amountPaise = Math.round(finalPrice * 100);

    const ok = await loadRazorpay();
    if (!ok) {
      setSubmitting(false);
      toast.error("Couldn't load payment gateway. Check your connection.");
      return;
    }

    const { data: orderData, error: orderErr } = await supabase.functions.invoke(
      "create-razorpay-order",
      { body: { onboardingId, amount: amountPaise } }
    );
    if (orderErr || !orderData?.orderId) {
      setSubmitting(false);
      toast.error("Could not initiate payment. Please retry.");
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name: "StreamVista Cloud X",
      description: `${plan.label} · Crayons Creator Cloud`,
      prefill: { name: parsed.data.clientName, email: parsed.data.businessEmail || undefined, contact: parsed.data.contactPhone || undefined },
      theme: { color: "#6366f1" },
      handler: async (resp: any) => {
        const { data: vData } = await supabase.functions.invoke("verify-razorpay-payment", {
          body: {
            onboardingId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          },
        });
        setSubmitting(false);
        if (vData?.verified) {
          setDone(true);
          toast.success("Payment confirmed — welcome aboard!");
        } else {
          toast.error("Payment could not be verified. Contact support.");
        }
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          toast.info("Payment cancelled. Your details are saved — resume anytime.");
        },
      },
    });
    rzp.on("payment.failed", () => {
      setSubmitting(false);
      toast.error("Payment failed. Please try again.");
    });
    rzp.open();
  };

  if (done) {
    return (
      <section id="onboard" className="py-24">
        <div className="container max-w-2xl">
          <div className="glass-strong rounded-3xl p-12 text-center animate-scale-in glow-primary">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-primary grid place-items-center mb-6 glow-primary">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-3">Welcome to <span className="gradient-text">Cloud X</span></h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Your onboarding request is in. Our Crayons team will reach out on WhatsApp within 24 hours to provision your workspace.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <BadgeCheck className="w-4 h-4" /> Status: Pending Activation
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="onboard" className="py-24">
      <div className="container max-w-5xl">
        <div className="text-center mb-12 animate-fade-in">
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-4">Onboarding Workspace</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Reserve your <span className="gradient-text">Cloud X workspace</span>
          </h2>
          <p className="text-muted-foreground">A few details to get your team activated.</p>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* FORM */}
          <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 space-y-5 animate-fade-in">
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-xs uppercase tracking-wider text-muted-foreground">Access Authorization Code <span className="opacity-50">(optional)</span></Label>
              <Input id="accessCode" value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="e.g. SVX-2026-XXXX" className="bg-input/60 border-border h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-xs uppercase tracking-wider text-muted-foreground">Entity / Individual Name</Label>
              <Input id="clientName" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Studio name or your full name" className="bg-input/60 border-border h-12" required />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Professional Role</Label>
                <Select value={professionalRole} onValueChange={setProfessionalRole}>
                  <SelectTrigger className="bg-input/60 border-border h-12"><SelectValue placeholder="Select your role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Business Email</Label>
                <Input id="email" type="email" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} placeholder="ops@yourstudio.com" className="bg-input/60 border-border h-12" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp Contact <span className="opacity-50">(optional if email provided)</span></Label>
              <Input id="phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 98xxxxxx" className="bg-input/60 border-border h-12" />
            </div>

            {/* PROMO */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Promo Code</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value); setPromoState("idle"); }}
                    placeholder="Enter code"
                    disabled={!!promoApplied}
                    className="bg-input/60 border-border h-12 pl-10 uppercase"
                  />
                </div>
                {promoApplied ? (
                  <button type="button" onClick={removePromo} className="px-5 h-12 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">
                    Remove
                  </button>
                ) : (
                  <button type="button" onClick={handleApplyPromo} className="px-5 h-12 rounded-md bg-gradient-primary text-primary-foreground text-sm font-semibold hover:scale-[1.02] transition-transform">
                    Apply
                  </button>
                )}
              </div>
              {promoState === "valid" && (
                <p className="text-sm text-[hsl(var(--success))] flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Code {promoApplied} verified — 10% off applied.</p>
              )}
              {promoState === "invalid" && (
                <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Invalid promo code.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "w-full h-14 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold text-base glow-primary",
                "hover:scale-[1.01] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              )}
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <>Pay ₹{finalPrice.toLocaleString("en-IN")} & Activate →</>}
            </button>
            <p className="text-xs text-muted-foreground text-center">By submitting you agree to be contacted by the Crayons team to activate your workspace.</p>
          </form>

          {/* SUMMARY */}
          <aside className="glass-strong rounded-3xl p-8 h-fit lg:sticky lg:top-24 animate-fade-in">
            <div className="text-xs uppercase tracking-[0.2em] text-accent mb-2">Order Summary</div>
            <div className="font-display text-2xl font-bold mb-1">Launch Partner Plan</div>
            <div className="text-sm text-muted-foreground mb-6">{plan.label} billing · 50 TB · India</div>

            <div className="space-y-3 py-5 border-y border-border/60 text-sm">
              <Row label={`Base (${plan.label})`} value={`₹${plan.price.toLocaleString("en-IN")}`} />
              {promoApplied && (
                <Row label={`Promo (${promoApplied})`} value={`−₹${savings.toLocaleString("en-IN")}`} accent />
              )}
              <Row label="Subtotal" value={`₹${subtotal.toLocaleString("en-IN")}`} />
              <Row label="GST (18%)" value={`₹${gstAmount.toLocaleString("en-IN")}`} muted />
            </div>

            <div className="flex items-baseline justify-between pt-5">
              <span className="text-sm text-muted-foreground uppercase tracking-wider">Total due</span>
              <div className="text-right">
                <div className="font-display font-bold text-3xl gradient-text">₹{finalPrice.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground">incl. GST · {plan.cadence.replace("+ GST", "").trim()}</div>
              </div>
            </div>

            {promoApplied && (
              <div className="mt-5 px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs text-center font-semibold">
                You saved ₹{savings.toLocaleString("en-IN")} with {promoApplied}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

const Row = ({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("font-medium", accent && "text-accent", muted && "text-muted-foreground")}>{value}</span>
  </div>
);
