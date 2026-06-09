import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowRight, Check, Sparkles, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { PLANS, type Cycle } from "@/components/streamvista/plans";
import { cn } from "@/lib/utils";

const ROLES = [
  "Creator", "Editor", "Director", "Cinematographer",
  "Production Studio", "Production House", "Post-Production Team",
  "VFX Facility", "Independent Filmmaker", "Other",
];

type Step = "profile" | "plan" | "done";

/**
 * Strictly linear post-signup wizard.
 *   Step 1 — Profile & Role
 *   Step 2 — Plan selection
 *   Step 3 — Workspace dashboard
 *
 * Server-side `user_profiles.onboarding_step` is the source of truth; the gate
 * uses it to keep users from skipping or looping back.
 */
export default function Onboarding() {
  const { user, role, loading, refreshRole } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("profile");
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Plan
  const [selectedCycle, setSelectedCycle] = useState<Cycle>("free");

  // ----- Bootstrap: route guards & hydration -----
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("first_name,last_name,studio_name,whatsapp,professional_role,onboarding_step,plan_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setStudioName(data.studio_name ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setProfessionalRole((data as any).professional_role ?? "");
        setSelectedCycle(((data.plan_tier as Cycle) ?? "free"));
        const s = (data.onboarding_step as Step) ?? "profile";
        if (s === "done") { navigate(dashboardForRole(role ?? "client"), { replace: true }); return; }
        setStep(s);
      }
      setHydrating(false);
    })();
  }, [user, loading, role, navigate]);

  const saveProfile = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim() || !studioName.trim() || !professionalRole) {
      toast.error("Please complete every field to continue.");
      return;
    }
    setSaving(true);
    const display = `${firstName.trim()} ${lastName.trim()}`.trim();
    const studioLower = studioName.trim().toLowerCase();
    const studioSlug =
      studioLower.includes("crayons") && studioLower.includes("pictures") ? "crayons_pictures"
      : (studioLower.includes("abhijith") || studioLower.includes("abijith")) ? "abhijith_asokan_productions"
      : "independent";
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: display,
      studio_name: studioName.trim(),
      studio_slug: studioSlug,
      whatsapp: whatsapp.trim() || null,
      professional_role: professionalRole,
      onboarding_step: "plan",
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    setStep("plan");
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_profiles").update({
      plan_tier: selectedCycle,
      onboarding_step: "done",
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshRole();

    // Persist completion banner state for first dashboard visit
    try {
      sessionStorage.setItem("sv_onboarding_just_completed", "1");
      localStorage.setItem(`sv_onboarding_done_${user.id}`, new Date().toISOString());
    } catch {}

    // Optional: fire onboarding-complete email (silently no-op if template/function missing)
    const displayName = `${firstName} ${lastName}`.trim() || studioName || user.email || "there";
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "onboarding-complete",
        recipientEmail: user.email,
        idempotencyKey: `onboarding-complete-${user.id}`,
        templateData: {
          name: displayName,
          studio: studioName,
          plan: selectedCycle,
          role: professionalRole,
          whatsapp: whatsapp || null,
        },
      },
    }).catch(() => {});

    toast.success("You're all set — welcome to StreamVista.", {
      description: `Workspace ready for ${studioName || displayName} on the ${selectedCycle} plan.`,
      duration: 6000,
    });
    navigate(dashboardForRole(role ?? "client"), { replace: true });
  };

  if (loading || hydrating) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground grid place-items-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent/20 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {(["profile", "plan", "done"] as Step[]).map((s, i) => {
            const order = { profile: 0, plan: 1, done: 2 } as const;
            const active = order[step] === i;
            const complete = order[step] > i;
            return (
              <div key={s} className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full grid place-items-center text-xs font-semibold border transition-all",
                  complete && "bg-accent text-accent-foreground border-accent",
                  active && !complete && "bg-gradient-primary text-primary-foreground border-transparent glow-primary",
                  !active && !complete && "border-border/60 text-muted-foreground"
                )}>{complete ? <Check className="w-4 h-4" /> : i + 1}</div>
                {i < 2 && <div className={cn("w-12 h-px", order[step] > i ? "bg-accent" : "bg-border/60")} />}
              </div>
            );
          })}
        </div>

        <div className="glass-strong rounded-3xl p-8 md:p-10 border border-white/5 animate-fade-in">
          {step === "profile" && (
            <>
              <div className="text-center mb-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Step 1 of 2</span>
                <h1 className="font-display text-3xl md:text-4xl font-bold mt-2"><span className="gradient-text">Tell us who you are.</span></h1>
                <p className="text-sm text-muted-foreground mt-2">We'll tailor your workspace to your craft.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field placeholder="First name" value={firstName} onChange={setFirstName} />
                <Field placeholder="Last name" value={lastName} onChange={setLastName} />
              </div>
              <div className="mt-3">
                <Field placeholder="Studio / company name" value={studioName} onChange={setStudioName} />
              </div>
              <div className="mt-3">
                <select
                  value={professionalRole}
                  onChange={(e) => setProfessionalRole(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm focus:border-accent/70 outline-none"
                >
                  <option value="">What is your role?</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mt-3">
                <Field placeholder="WhatsApp (optional)" value={whatsapp} onChange={setWhatsapp} type="tel" />
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="mt-6 w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue to plan <ArrowRight className="w-4 h-4" /></>}
              </button>
            </>
          )}

          {step === "plan" && (
            <>
              <div className="text-center mb-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Step 2 of 2</span>
                <h1 className="font-display text-3xl md:text-4xl font-bold mt-2"><span className="gradient-text">Choose your plan.</span></h1>
                <p className="text-sm text-muted-foreground mt-2">Start free — upgrade anytime from your dashboard.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {PLANS.map(p => {
                  const active = selectedCycle === p.cycle;
                  return (
                    <button
                      key={p.cycle}
                      type="button"
                      onClick={() => setSelectedCycle(p.cycle)}
                      className={cn(
                        "relative text-left rounded-2xl p-5 border transition-all",
                        active
                          ? "border-accent/70 bg-accent/10 glow-primary"
                          : "border-border/60 hover:border-accent/40 bg-input/30"
                      )}
                    >
                      {active && <BadgeCheck className="absolute top-3 right-3 w-5 h-5 text-accent" />}
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.cadence}</span>
                      </div>
                      <div className="font-display text-xl font-bold">{p.label}</div>
                      <div className="font-display text-2xl text-accent mt-1">{p.priceLabel}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStep("profile")}
                  className="h-12 px-5 rounded-xl border border-border/60 text-sm font-medium hover:bg-secondary/40"
                >
                  Back
                </button>
                <button
                  onClick={finish}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enter my workspace <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
              {selectedCycle !== "free" && (
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  You'll be able to complete secure checkout from your dashboard.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm placeholder:text-muted-foreground/60 outline-none focus:border-accent/70 focus:bg-input/70"
    />
  );
}
