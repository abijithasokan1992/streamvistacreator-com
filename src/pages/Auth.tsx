import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { planByCycle, type Cycle } from "@/components/streamvista/plans";
import { CountryCodeSelect } from "@/components/auth/CountryCodeSelect";
import { COUNTRIES, type Country } from "@/lib/countries";

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const SignupSchema = LoginSchema.extend({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  studioName: z.string().trim().min(1, "Studio / company name is required").max(160),
  mobile: z.string().trim().min(4, "Enter a valid mobile number").max(20),
});

const VALID_CYCLES: Cycle[] = ["free", "creator"];

type View = "login" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user, loading } = useAuth();

  const planParam = search.get("plan") as Cycle | null;
  const planCycle: Cycle | null = planParam && VALID_CYCLES.includes(planParam) ? planParam : null;
  const plan = planCycle ? planByCycle(planCycle) : null;
  const isPaidPlan = !!plan && plan.cycle !== "free";

  const [view, setView] = useState<View>(planCycle ? "signup" : "login");
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sign-up only fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [country, setCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === "IN") ?? COUNTRIES[0]
  );
  const [mobile, setMobile] = useState("");

  const continueAfterAuth = async () => {
    if (isPaidPlan && plan) {
      try {
        let onboardingId = search.get("onb") || "";
        if (!onboardingId) {
          try {
            const stash = JSON.parse(sessionStorage.getItem("sv_onboarding") || "{}");
            if (stash?.onboardingId) onboardingId = stash.onboardingId;
          } catch {}
        }
        if (!onboardingId) {
          // No pre-created onboarding record — send user through the onboarding wizard
          // where they can complete profile and then pay from the dashboard.
          navigate("/onboarding", { replace: true });
          return;
        }

        toast.loading("Preparing secure checkout...", { id: "co" });
        const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
          body: { onboardingId },
        });
        toast.dismiss("co");
        if (error || !data?.orderId) throw error || new Error("Order creation failed");

        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) {
          toast.error("Checkout failed to load — please refresh and retry.");
          return;
        }

        const rzp = new Razorpay({
          key: data.keyId,
          order_id: data.orderId,
          amount: data.amount,
          currency: data.currency,
          name: "StreamVista Cloud X",
          description: `${plan.label} workspace`,
          prefill: { email: email || undefined },
          theme: { color: "#3D7BFD" },
          handler: async (resp: any) => {
            toast.loading("Verifying payment...", { id: "vp" });
            const { data: v, error: vErr } = await supabase.functions.invoke("verify-razorpay-payment", {
              body: {
                onboardingId,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            });
            toast.dismiss("vp");
            if (vErr || !v?.verified) {
              toast.error("Payment couldn't be verified. Contact support if you were charged.");
              return;
            }
            try { sessionStorage.removeItem("sv_onboarding"); } catch {}
            toast.success("Payment confirmed — welcome to your workspace.");
            // Paid plan → creator workspace by default; if user already has a higher role, honour it.
            const { data: roleRow } = await supabase
              .from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "");
            const roles = (roleRow || []).map((r: any) => r.role);
            const target = roles.includes("admin") ? "/admin"
              : roles.includes("executive_producer") ? "/producer"
              : "/vault";
            navigate(target, { replace: true });
          },
          modal: {
            ondismiss: () => {
              toast.message("Checkout closed — you can retry anytime from your vault.");
              navigate("/vault", { replace: true });
            },
          },
        });
        rzp.on("payment.failed", () => {
          toast.error("Payment failed — please try again.");
        });
        rzp.open();
        return;
      } catch (e: any) {
        toast.dismiss("co");
        console.error("checkout error:", e);
        toast.error("Couldn't open checkout — taking you to your workspace to retry.");
      }
    }
    // Free flow / default: route through the onboarding gate. It decides
    // whether to send the user to the wizard or straight to their dashboard.
    const nextParam = search.get("next");
    if (nextParam && nextParam.startsWith("/")) {
      navigate(nextParam, { replace: true });
      return;
    }
    // Admins skip onboarding entirely.
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "");
    const roles = (roleRow || []).map((r: any) => r.role);
    if (roles.includes("admin")) {
      navigate("/admin", { replace: true });
      return;
    }
    navigate("/onboarding", { replace: true });
  };

  useEffect(() => {
    if (!loading && user) continueAfterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (view === "forgot") {
      const emailOk = z.string().email().safeParse(email);
      if (!emailOk.success) return toast.error("Enter a valid email");
      setSubmitting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Reset link sent — check your inbox.");
      setView("login");
      return;
    }

    if (view === "signup") {
      const parsed = SignupSchema.safeParse({
        email, password, firstName, lastName, studioName, mobile,
      });
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      setSubmitting(true);

      const fullMobile = `${country.dial} ${parsed.data.mobile.replace(/^\+?\d{1,4}\s*/, "")}`.trim();
      const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/vault`,
          data: {
            display_name: displayName,
            first_name: parsed.data.firstName,
            last_name: parsed.data.lastName,
            studio_name: parsed.data.studioName,
            whatsapp: fullMobile,
            country_code: country.code,
          },
        },
      });
      if (error) { setSubmitting(false); return toast.error(error.message); }

      const persistProfile = async () => {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (!uid) return;
        await supabase.from("user_profiles").upsert({
          user_id: uid,
          display_name: displayName,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          studio_name: parsed.data.studioName,
          whatsapp: fullMobile,
        }, { onConflict: "user_id" });
      };

      // If email confirmation is off, signUp returns a session — go straight in.
      if (data.session) {
        await persistProfile();
        setSubmitting(false);
        toast.success("Welcome to Cloud X.");
        await continueAfterAuth();
        return;
      }
      // Fallback: try immediate sign-in (works when auto-confirm is enabled server-side).
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (!siErr) await persistProfile();
      setSubmitting(false);
      if (siErr) {
        toast.success("Account created — check your inbox to verify, then sign in.");
        setView("login");
        return;
      }
      toast.success("Welcome to Cloud X.");
      await continueAfterAuth();
    } else {
      const parsed = LoginSchema.safeParse({ email, password });
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      await continueAfterAuth();
    }
  };

  const heading = view === "forgot" ? "Reset" : view === "signup" ? "Create" : "Sign in";
  const ctaLabel = submitting
    ? "One moment…"
    : view === "forgot"
    ? "Send reset link"
    : view === "signup"
    ? (isPaidPlan ? "Create account & continue" : "Create account")
    : (isPaidPlan ? "Sign in & continue" : "Login");

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground grid place-items-center px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[140px] animate-pulse" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent/20 blur-[140px] animate-pulse [animation-delay:1.6s]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background))_100%)]" />
      </div>

      <div className="relative w-full max-w-sm">
        <Link to="/" className="block text-center text-[11px] uppercase tracking-[0.45em] text-muted-foreground/80 mb-8 hover:text-foreground transition-colors">
          StreamVista <span className="text-accent">·</span> Cloud X
        </Link>

        <div className="glass-strong rounded-3xl p-9 animate-fade-in border border-white/5">
          <div className="text-center mb-8">
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight">
              <span className="gradient-text">{heading}</span>
            </h1>
            {view === "forgot" && (
              <p className="mt-2 text-xs text-muted-foreground/80">Enter your email and we'll send a reset link.</p>
            )}
            {plan && view !== "forgot" && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs">
                <Sparkles className="w-3 h-3 text-accent" />
                <span className="font-semibold">{plan.label}</span>
                <span className="text-accent">{plan.priceLabel}</span>
              </div>
            )}
          </div>

          {view !== "forgot" && (
            <div className="mb-6 grid grid-cols-2 gap-1 p-1 rounded-xl bg-input/30 border border-border/50">
              <button
                type="button"
                onClick={() => setView("login")}
                className={cn(
                  "h-9 rounded-lg text-xs font-semibold uppercase tracking-[0.15em] transition-all",
                  view === "login"
                    ? "bg-gradient-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setView("signup")}
                className={cn(
                  "h-9 rounded-lg text-xs font-semibold uppercase tracking-[0.15em] transition-all",
                  view === "signup"
                    ? "bg-gradient-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Create Account
              </button>
            </div>
          )}

          <form onSubmit={handle} className="space-y-3.5" autoComplete="on">

            {view === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    autoComplete="given-name"
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    autoComplete="family-name"
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                </div>

                <input
                  type="text"
                  value={studioName}
                  onChange={e => setStudioName(e.target.value)}
                  placeholder="Studio / company name"
                  required
                  autoComplete="organization"
                  maxLength={160}
                  className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                />

                <div className="flex">
                  <CountryCodeSelect value={country} onChange={setCountry} />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                    placeholder="Mobile number"
                    required
                    autoComplete="tel-national"
                    maxLength={20}
                    className="flex-1 h-12 px-4 rounded-r-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                </div>
              </>
            )}

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="peer w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
            />


            {view !== "forgot" && (
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={8}
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                  className="w-full h-12 pl-4 pr-12 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "relative w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold text-sm tracking-wide glow-primary",
                "hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-60 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {ctaLabel}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-[11px] tracking-[0.15em] uppercase">
            {view === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setView("forgot")}
                  className="text-muted-foreground/60 hover:text-accent transition-colors"
                >
                  Forgot password
                </button>
                <button
                  type="button"
                  onClick={() => setView("signup")}
                  className="text-muted-foreground/60 hover:text-accent transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
            {view === "signup" && (
              <button
                type="button"
                onClick={() => setView("login")}
                className="mx-auto text-muted-foreground/60 hover:text-accent transition-colors"
              >
                Have an account? Sign in
              </button>
            )}
            {view === "forgot" && (
              <button
                type="button"
                onClick={() => setView("login")}
                className="mx-auto text-muted-foreground/60 hover:text-accent transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>



        </div>
      </div>
    </main>
  );
}

