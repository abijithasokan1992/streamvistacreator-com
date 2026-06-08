import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

/** Fire-and-forget welcome notifications (Email now; SMS/WhatsApp stubbed).
 *  Never awaited from the signup flow so it can't block or break the UI. */
function fireWelcomeNotifications(email: string, name: string) {
  // Email via existing app-email function if deployed; silently ignore if not.
  supabase.functions
    .invoke("send-transactional-email", {
      body: {
        templateName: "account-created",
        recipientEmail: email,
        idempotencyKey: `signup-${email}-${Date.now()}`,
        templateData: { name },
      },
    })
    .catch(() => { /* infra optional — stub */ });
  // SMS + WhatsApp: stubbed for now, wired once Twilio creds are added.
}

export const OnboardingForm = () => {
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
    toast.loading("Setting up your StreamVista workspace...", { id: "onboard" });

    const { error } = await supabase.from("onboarding_requests").insert({
      client_name: parsed.data.clientName,
      professional_role: parsed.data.professionalRole,
      contact_phone: parsed.data.contactPhone || null,
      business_email: parsed.data.businessEmail,
      selected_cycle: "free",
      base_price: 0,
      final_price: 0,
      onboarding_status: "pending",
      payment_status: "free",
      plan_type: "free",
    });

    toast.dismiss("onboard");

    if (error) {
      setSubmitting(false);
      console.error("[onboard] insert failed:", error);
      toast.error(error.message || "Could not set up your account. Please try again.");
      return;
    }

    // Trigger welcome notifications asynchronously — do NOT await.
    fireWelcomeNotifications(parsed.data.businessEmail, parsed.data.clientName);

    setSubmitting(false);
    setDone(true);
    toast.success("You're in — check your inbox for next steps");
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
              Your free workspace is being set up. We've sent the next steps to <span className="text-foreground">{businessEmail}</span>.
              Sign in to start sharing files, and upgrade anytime from your account.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold">
              <BadgeCheck className="w-4 h-4" /> Free plan · Active
            </div>
            <div className="mt-6">
              <a href="/auth" className="text-sm text-accent underline underline-offset-4">Sign in to your account →</a>
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
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">[ Get Started — Free ]</span>
            <div className="w-8 h-px bg-accent" />
          </div>
          <h2 className="font-display font-black uppercase leading-[0.9] tracking-tight text-4xl md:text-6xl">
            Create your <span className="gradient-text">free account.</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-sm">
            Start on the Free plan. Upgrade from your account whenever you're ready.
          </p>
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
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your StreamVista workspace...</> : <>Create my Free account →</>}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            By creating an account you agree to be contacted by our team about your workspace.
          </p>
        </form>
      </div>
    </section>
  );
};
