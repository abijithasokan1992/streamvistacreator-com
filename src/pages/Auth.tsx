import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { planByCycle, type Cycle } from "@/components/streamvista/plans";
import { CountryCodeSelect } from "@/components/auth/CountryCodeSelect";
import { COUNTRIES, type Country } from "@/lib/countries";
import { useHostMode, urlForHost } from "@/hooks/useHostMode";

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const SignupSchema = LoginSchema.extend({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  studioName: z.string().trim().max(160).optional().or(z.literal("")),
  // Mobile is optional. When present, we treat it as the user's WhatsApp number internally.
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
});

const VALID_CYCLES: Cycle[] = ["free", "creator"];

type View = "login" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user, loading } = useAuth();
  const hostMode = useHostMode();

  const nextPath = search.get("next") || "";
  // On the admin subdomain, EVERY visit to /auth is an admin login —
  // the "next" param is ignored and forced to /admin.
  const isAdminLogin = hostMode === "admin" || nextPath.startsWith("/admin");

  const planParam = search.get("plan") as Cycle | null;
  const planCycle: Cycle | null = planParam && VALID_CYCLES.includes(planParam) ? planParam : null;
  const plan = planCycle ? planByCycle(planCycle) : null;
  const isPaidPlan = !!plan && plan.cycle !== "free";

  const [view, setView] = useState<View>(isAdminLogin ? "login" : (planCycle ? "signup" : "login"));
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

  // Real-time validation flags
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  // Strong-enough: 8+ chars with at least one letter and one number
  const passwordValid =
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const passwordChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  };

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

    // Look up role first so we can enforce the host boundary.
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "");
    const roles = (roleRow || []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin");

    // ── Host boundary enforcement ──────────────────────────────
    if (hostMode === "admin") {
      // Admin subdomain: only admins are allowed past auth.
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("This portal is for administrators only.");
        // Push them to the public site
        window.location.replace(urlForHost("public", "/auth"));
        return;
      }
      navigate("/admin", { replace: true });
      return;
    }

    // Public host (including /admin on main domain): route admins to /admin,
    // everyone else to their normal dashboard.
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }

    // Non-admin on public host → straight to their dashboard. The OnboardingGate
    // will only divert to the wizard for legacy accounts whose step isn't 'done'.
    const nextParam = search.get("next");
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("/admin")) {
      navigate(nextParam, { replace: true });
      return;
    }
    const target = roles.includes("executive_producer") ? "/producer"
      : roles.includes("creator") ? "/vault"
      : "/client";
    navigate(target, { replace: true });
  };

  useEffect(() => {
    if (loading || !user) return;
    // If this session arrived via Google OAuth redirect, fire the appropriate
    // welcome / login alert before routing onward.
    try {
      const intent = sessionStorage.getItem("sv_oauth_intent");
      if (intent === "signup" || intent === "login") {
        sessionStorage.removeItem("sv_oauth_intent");
        void fireWelcomeAlert(intent, "google");
      }
    } catch {}
    continueAfterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // Fire the Welcome (signup) or Login-alert (sign-in) email + SMS/WhatsApp.
  // Safe to call after any successful auth — the edge function auto-detects
  // signup vs login from auth.users.created_at when intent is omitted.
  const fireWelcomeAlert = async (intent: "signup" | "login" | "auto", method?: string) => {
    try {
      await supabase.functions.invoke("send-welcome-alert", {
        body: { intent, method },
      });
    } catch (err) {
      // Non-blocking — auth has already succeeded.
      console.error("welcome-alert dispatch failed:", err);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    // Record the intent so the post-redirect handler knows whether to send a
    // Welcome or a Login alert when Google bounces the user back.
    try { sessionStorage.setItem("sv_oauth_intent", view === "signup" ? "signup" : "login"); } catch {}
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        // Force the account chooser on signup so the user can pick a fresh
        // Google identity; on login we let Google reuse the last session.
        prompt: view === "signup" ? "select_account" : "select_account",
      },
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed.");
    }
  };


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

      const rawMobile = (parsed.data.mobile ?? "").trim();
      const fullMobile = rawMobile
        ? `${country.dial} ${rawMobile.replace(/^\+?\d{1,4}\s*/, "")}`.trim()
        : "";
      const lastNameVal = (parsed.data.lastName ?? "").trim();
      const studioNameVal = (parsed.data.studioName ?? "").trim();
      const displayName = `${parsed.data.firstName} ${lastNameVal}`.trim();

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/vault`,
          data: {
            display_name: displayName,
            first_name: parsed.data.firstName,
            last_name: lastNameVal || null,
            studio_name: studioNameVal || null,
            // Mobile is captured once at signup and reused as the WhatsApp contact internally.
            whatsapp: fullMobile || null,
            country_code: country.code,
          },
        },
      });
      if (error) { setSubmitting(false); return toast.error(error.message); }

      const persistProfile = async () => {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (!uid) return;
        // Mark onboarding complete right away — we already have everything we need
        // to drop the user straight into their workspace. No second wizard.
        await supabase.from("user_profiles").upsert({
          user_id: uid,
          display_name: displayName || parsed.data.firstName,
          first_name: parsed.data.firstName,
          last_name: lastNameVal || null,
          studio_name: studioNameVal || null,
          whatsapp: fullMobile || null,
          onboarding_step: "done",
        }, { onConflict: "user_id" });
      };

      // If email confirmation is off, signUp returns a session — go straight in.
      if (data.session) {
        await persistProfile();
        setSubmitting(false);
        toast.success("Welcome to Cloud X.");
        void fireWelcomeAlert("signup", "email");
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
      void fireWelcomeAlert("signup", "email");
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
      void fireWelcomeAlert("login", "email");
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

          {view !== "forgot" && !isAdminLogin && (
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

          {isAdminLogin && view !== "forgot" && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-accent/30 bg-accent/5 text-[11px] text-muted-foreground text-center">
              <span className="font-semibold text-accent uppercase tracking-[0.2em]">Admin Console</span>
              <div className="mt-1">Sign in with your administrator credentials. New admin accounts and role changes are managed from inside the admin dashboard.</div>
            </div>
          )}

          {view !== "forgot" && !isAdminLogin && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full h-12 rounded-xl border border-border/60 bg-input/30 text-sm font-medium text-foreground hover:bg-input/50 transition-colors flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {view === "signup" ? "Sign up with Google" : "Sign in with Google"}
            </button>
          )}

          {view !== "forgot" && !isAdminLogin && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground tracking-widest">or</span>
              </div>
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
                    aria-label="First name"
                    required
                    autoComplete="given-name"
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name (optional)"
                    aria-label="Last name"
                    autoComplete="family-name"
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                </div>

                <input
                  type="text"
                  value={studioName}
                  onChange={e => setStudioName(e.target.value)}
                  placeholder="Studio / company name (optional)"
                  aria-label="Studio or company name"
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
                    placeholder="WhatsApp number (optional)"
                    aria-label="WhatsApp number"
                    autoComplete="tel-national"
                    maxLength={20}
                    className="flex-1 h-12 px-4 rounded-r-xl bg-input/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60 -mt-1 px-1">
                  Only first name, email & password are required. Mobile is used as your WhatsApp contact if provided.
                </p>
              </>
            )}

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email address"
                required
                autoComplete="email"
                className={cn(
                  "peer w-full h-12 pl-4 pr-11 rounded-xl bg-input/40 border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]",
                  emailValid
                    ? "border-emerald-400/60 focus:border-emerald-400"
                    : "border-border/60 focus:border-accent/70",
                )}
              />
              {emailValid && (
                <CheckCircle2
                  aria-label="Valid email"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 animate-fade-in"
                />
              )}
            </div>


            {view !== "forgot" && (
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    required
                    minLength={8}
                    autoComplete={view === "login" ? "current-password" : "new-password"}
                    className={cn(
                      "w-full h-12 pl-4 pr-20 rounded-xl bg-input/40 border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:bg-input/70 focus:shadow-[0_0_24px_-6px_hsl(var(--accent)/0.5)]",
                      passwordValid
                        ? "border-emerald-400/60 focus:border-emerald-400"
                        : "border-border/60 focus:border-accent/70",
                    )}
                  />

                  {passwordValid && (
                    <CheckCircle2
                      aria-label="Strong password"
                      className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 animate-fade-in"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {view === "signup" && password.length > 0 && !passwordValid && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                    <span className={cn("flex items-center gap-1", passwordChecks.length && "text-emerald-400")}>
                      <CheckCircle2 className="w-3 h-3" /> 8+ chars
                    </span>
                    <span className={cn("flex items-center gap-1", passwordChecks.letter && "text-emerald-400")}>
                      <CheckCircle2 className="w-3 h-3" /> letter
                    </span>
                    <span className={cn("flex items-center gap-1", passwordChecks.number && "text-emerald-400")}>
                      <CheckCircle2 className="w-3 h-3" /> number
                    </span>
                  </div>
                )}
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

