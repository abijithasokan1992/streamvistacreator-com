import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowRight, Sparkles, SkipForward, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import CinematicOnboarding from "@/components/CinematicOnboarding";
import { Seo } from "@/components/Seo";

const ROLES = [
  "Creator", "Editor", "Director", "Cinematographer",
  "Production Studio", "Production House", "Post-Production Team",
  "VFX Facility", "Independent Filmmaker", "Other",
];

/**
 * One-screen, frictionless onboarding.
 *   • Cinematic intro + terms acceptance gates entry.
 *   • Only the name + role are required.
 *   • Studio + WhatsApp are optional and tucked under a disclosure.
 *   • Plan defaults to Free — users upgrade from the dashboard later.
 *   • No multi-step wizard, no plan picker, no delay.
 */
export default function Onboarding() {
  const { user, role, loading, refreshRole } = useAuth();
  const navigate = useNavigate();

  const [showCinematic, setShowCinematic] = useState(true);

  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [studioName, setStudioName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const accessCodeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("first_name,last_name,studio_name,whatsapp,professional_role,onboarding_step,access_authorization_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setStudioName(data.studio_name ?? "");
        setWhatsapp(data.whatsapp ?? "");
        setProfessionalRole((data as any).professional_role ?? "");
        setAccessCode((data as any).access_authorization_code ?? "");
        if (data.onboarding_step === "done") {
          navigate(dashboardForRole(role ?? "client"), { replace: true });
          return;
        }
      }
      setHydrating(false);
    })();
  }, [user, loading, role, navigate]);

  // Auto-focus the Access Authorization Code once the form is visible.
  useEffect(() => {
    if (hydrating || showCinematic) return;
    const t = window.setTimeout(() => accessCodeRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [hydrating, showCinematic]);

  const finish = async () => {
    if (!user) return;
    if (!firstName.trim() || !professionalRole) {
      toast.error("Just your first name and role — that's it.");
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
      last_name: lastName.trim() || null,
      display_name: display || firstName.trim(),
      studio_name: studioName.trim() || null,
      studio_slug: studioSlug,
      whatsapp: whatsapp.trim() || null,
      professional_role: professionalRole,
      access_authorization_code: accessCode.trim() || null,
      plan_tier: "free",
      onboarding_step: "done",
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshRole();

    try {
      sessionStorage.setItem("sv_onboarding_just_completed", "1");
      localStorage.setItem(`sv_onboarding_done_${user.id}`, new Date().toISOString());
    } catch {}

    toast.success("Welcome to StreamVista.", { duration: 4000 });
    navigate(dashboardForRole(role ?? "client"), { replace: true });
  };

  const skipToDashboard = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: user.id,
      first_name: firstName.trim() || "Creator",
      display_name: firstName.trim() || "Creator",
      professional_role: professionalRole || "Creator",
      access_authorization_code: accessCode.trim() || null,
      plan_tier: "free",
      onboarding_step: "done",
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshRole();
    try {
      sessionStorage.setItem("sv_onboarding_just_completed", "1");
      localStorage.setItem(`sv_onboarding_done_${user.id}`, new Date().toISOString());
    } catch {}
    toast.success("Welcome to StreamVista.", { duration: 4000 });
    navigate(dashboardForRole(role ?? "client"), { replace: true });
  };

  if (loading || hydrating) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  if (showCinematic) {
    return (
      <CinematicOnboarding onComplete={() => setShowCinematic(false)} />
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground grid place-items-center px-4 py-12">
      <Seo
        title="Get Started with StreamVista — 30-Second Onboarding"
        description="Create your StreamVista account in under a minute. Tell us your name and role to unlock your creator or studio workspace for films, series and shows."
        path="/onboarding"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent/20 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass-strong rounded-3xl p-7 md:p-9 border border-white/5 animate-fade-in">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/40 bg-accent/5 mb-4">
              <Sparkles className="w-3 h-3 text-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">30 seconds — promise</span>
            </div>
            <h1 className="font-display text-3xl font-bold">
              <span className="gradient-text">Quick hello.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Two fields and you're in. Everything else lives in your dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field placeholder="First name *" value={firstName} onChange={setFirstName} />
            <Field placeholder="Last name" value={lastName} onChange={setLastName} />
          </div>

          <div className="mt-3">
            <select
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm focus:border-accent/70 outline-none"
            >
              <option value="">Your role *</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="mt-3">
            <label htmlFor="access-auth-code" className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5 font-mono">
              <KeyRound className="w-3 h-3 text-accent" />
              Access Authorization Code
            </label>
            <input
              id="access-auth-code"
              ref={accessCodeRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.slice(0, 64))}
              placeholder="Optional — enter if you were issued one"
              className="w-full h-12 px-4 rounded-xl bg-input/40 border border-accent/30 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground outline-none focus:border-accent/70 focus:bg-input/70"
            />
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Stored privately with your onboarding record for admin review.
            </p>
          </div>

          {!showOptional ? (
            <button
              type="button"
              onClick={() => setShowOptional(true)}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              + Add studio name or WhatsApp (optional)
            </button>
          ) : (
            <div className="mt-3 space-y-3 animate-fade-in">
              <Field placeholder="Studio / company (optional)" value={studioName} onChange={setStudioName} />
              <Field placeholder="WhatsApp (optional)" value={whatsapp} onChange={setWhatsapp} type="tel" />
            </div>
          )}

          <button
            onClick={finish}
            disabled={saving}
            className="mt-6 w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enter workspace <ArrowRight className="w-4 h-4" /></>}
          </button>

          <button
            onClick={skipToDashboard}
            disabled={saving}
            className="mt-3 w-full h-12 rounded-xl border border-border/60 bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Skip optional fields <SkipForward className="w-4 h-4" /></>}
          </button>

          <p className="mt-4 text-[11px] text-muted-foreground/70 text-center">
            Starts on the Free plan (128 GB). Upgrade anytime — no card required now.
          </p>
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
      className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm placeholder:text-muted-foreground outline-none focus:border-accent/70 focus:bg-input/70"
    />
  );
}
