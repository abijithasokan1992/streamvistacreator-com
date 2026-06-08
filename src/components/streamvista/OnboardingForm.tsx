import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, BadgeCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { planByCycle, type Cycle } from "./plans";
import { useNavigate } from "react-router-dom";

const ROLES = [
  "Creator", "Editor", "Director", "Cinematographer",
  "Production Studio", "Production House", "Post-Production Team",
  "VFX Facility", "Independent Filmmaker", "Other",
];

const Schema = z.object({
  clientName: z.string().trim().min(2, "Please enter your name").max(200),
  professionalRole: z.string().min(1, "Please pick your role"),
  businessEmail: z.string().trim().email("Please enter a valid email").max(255),
  contactPhone: z.string().trim().max(30).or(z.literal("")),
});

function fireWelcomeNotifications(email: string, name: string) {
  supabase.functions
    .invoke("send-transactional-email", {
      body: {
        templateName: "account-created",
        recipientEmail: email,
        idempotencyKey: `signup-${email}-${Date.now()}`,
        templateData: { name },
      },
    })
    .catch(() => {});
}

interface Props {
  selectedCycle?: Cycle;
}

export const OnboardingForm = ({ selectedCycle = "free" }: Props) => {
  const navigate = useNavigate();
  const plan = planByCycle(selectedCycle);
  const isPaid = plan.cycle !== "free";

  const [clientName, setClientName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ clientName, professionalRole, businessEmail, contactPhone });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    toast.loading(isPaid ? `Reserving your ${plan.label} workspace...` : "Setting up your StreamVista workspace...", { id: "onboard" });

    const onboardingId = crypto.randomUUID();

    const { error } = await supabase.from("onboarding_requests").insert({
      id: onboardingId,
      client_name: parsed.data.clientName,
      professional_role: parsed.data.professionalRole,
      contact_phone: parsed.data.contactPhone || null,
      business_email: parsed.data.businessEmail,
      selected_cycle: plan.cycle,
      base_price: plan.price,
      final_price: plan.price,
      onboarding_status: "pending",
      payment_status: isPaid ? "pending" : "free",
      plan_type: isPaid ? "paid" : "free",
    });

    toast.dismiss("onboard");

    if (error) {
      setSubmitting(false);
      console.error("[onboard] insert failed:", error);
      toast.error(error?.message || "Could not set up your account. Please try again.");
      return;
    }

    fireWelcomeNotifications(parsed.data.businessEmail, parsed.data.clientName);

    // Stash context so /auth can finish the journey (sign up → checkout for paid).
    try {
      sessionStorage.setItem("sv_onboarding", JSON.stringify({
        onboardingId,
        email: parsed.data.businessEmail,
        name: parsed.data.clientName,
        cycle: plan.cycle,
      }));
    } catch {}

    setSubmitting(false);

    if (isPaid) {
      toast.success(`${plan.label} reserved — create your account to continue to secure checkout.`);
      navigate(`/auth?plan=${plan.cycle}&email=${encodeURIComponent(parsed.data.businessEmail)}&onb=${onboardingId}`);
      return;
    }

    setDone(true);
    toast.success("You're in — sign in to access your vault and dashboard.");
  };

  if (done) {
    return (
      <section id="onboard" className="py-24">
        <div className="container max-w-2xl">
          <div className="glass-strong rounded-3xl p-12 text-center animate-scale-in glow-primary">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-primary grid place-items-center mb-6 glow-primary">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-3">Welcome to <span className="gradient-text">StreamVista</span></h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Your free workspace for <span className="text-foreground">{businessEmail}</span> is ready.
              Sign in to access your storage vault and dashboard.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <BadgeCheck className="w-4 h-4" /> Free plan · Active
            </div>
            <div className="mt-6">
              <a href={`/auth?email=${encodeURIComponent(businessEmail)}`}
                 className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary">
                Sign in to your workspace →
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="onboard" className="py-28">
      <div className="container max-w-3xl">
        <div className="mb-10 animate-fade-in text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-8 h-px bg-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              [ {isPaid ? `Continue with ${plan.label}` : "Get Started — Free"} ]
            </span>
            <div className="w-8 h-px bg-accent" />
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            {isPaid ? <>Create your <span className="gradient-text">{plan.label.toLowerCase()} workspace.</span></>
                    : <>Create your <span className="gradient-text">free account.</span></>}
          </h2>
          <p className="text-muted-foreground mt-4 text-sm">
            {isPaid
              ? "Tell us who you are — you'll create your sign-in and finish secure checkout next."
              : "Start on the Free plan. Upgrade from your account whenever you're ready."}
          </p>

          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Selected</span>
            <span className="font-semibold">{plan.label}</span>
            <span className="text-accent font-display">{plan.priceLabel}</span>
            <span className="text-muted-foreground text-xs">{plan.cadence}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 space-y-5 animate-fade-in">
          <div className="space-y-2">
            <Label htmlFor="clientName" className="text-sm">Your Name or Studio Name</Label>
            <Input id="clientName" value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Crayons Pictures" className="bg-input/60 border-border h-12" required />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-sm">What is your role?</Label>
              <Select value={professionalRole} onValueChange={setProfessionalRole}>
                <SelectTrigger className="bg-input/60 border-border h-12">
                  <SelectValue placeholder="e.g. Creator, Editor, Director" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email Address</Label>
              <Input id="email" type="email" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)}
                placeholder="e.g. picturecrayons@gmail.com" className="bg-input/60 border-border h-12" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm">WhatsApp Number (Optional)</Label>
            <Input id="phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="+91 9xxxxxxxxx" className="bg-input/60 border-border h-12" />
          </div>

          <button type="submit" disabled={submitting}
            className={cn(
              "w-full h-14 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold text-base glow-primary",
              "hover:scale-[1.01] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            )}>
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isPaid ? "Reserving your workspace..." : "Setting up your StreamVista workspace..."}</>
              : <>{isPaid ? `Continue to ${plan.label} checkout →` : "Create my Free account →"}</>}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            By continuing you agree to be contacted by our team about your workspace.
          </p>
        </form>
      </div>
    </section>
  );
};
