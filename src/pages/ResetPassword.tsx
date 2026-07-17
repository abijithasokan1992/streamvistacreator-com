import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap, KeyRound, CheckCircle2, Sparkles, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardForRole, type AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getAppOrigin } from "@/lib/site";
import { mapAuthError } from "@/lib/auth/authErrors";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";
import crayonsLogo from "@/assets/partner-crayons-pictures.png";

/**
 * Password recovery landing page.
 *
 * Reached from the recovery email link. Supabase exchanges the recovery token
 * for a temporary session before this component mounts, so `auth.uid()` is
 * already valid here.
 *
 * Two paths forward:
 *   1. Set a new password (primary, top of page).
 *   2. "Fast Link to Dashboard" — pay ₹1 via Razorpay and route straight to
 *      the dashboard without setting a new password.
 *
 * No raw recovery URL is ever rendered on the page.
 */

const PasswordSchema = z
  .string()
  .min(8, "Min 8 characters")
  .max(72)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "Use letters and numbers",
  });

async function pickDashboard(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return "/auth";
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r: any) => r.role as AppRole);
  const order: AppRole[] = ["admin", "executive_producer", "creator", "moderator", "client", "user"];
  const primary = order.find((r) => roles.includes(r)) ?? null;
  return dashboardForRole(primary);
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [fastSaving, setFastSaving] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [resending, setResending] = useState(false);


  // Wait for the Supabase client to absorb the recovery session from the URL hash.
  useEffect(() => {
    let cancelled = false;
    const ensure = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSessionReady(!!data.session);
      setSessionChecked(true);
    };
    ensure();
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (cancelled) return;
      if (evt === "PASSWORD_RECOVERY" || sess) {
        setSessionReady(!!sess);
        setSessionChecked(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const resendRecovery = async () => {
    const email = recoverEmail.trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) return toast.error("Enter a valid email");
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin()}/reset-password`,
    });
    setResending(false);
    if (error) return toast.error(mapAuthError(error).message);
    toast.success("Fresh recovery link sent — check your inbox.");
  };


  const checks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: confirm.length > 0 && confirm === password,
  };
  const pwdValid = checks.length && checks.letter && checks.number;

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (password !== confirm) return toast.error("Passwords don't match");
    if (!sessionReady) return toast.error("Recovery link expired — request a new one.");

    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    const target = await pickDashboard();
    navigate(target, { replace: true });
  };

  const runFastLink = async () => {
    if (!sessionReady) return toast.error("Recovery link expired — request a new one.");
    try { assertLiveCheckoutHost(); }
    catch (e: any) { return toast.error(e?.message || "Live payments are only available on the production domain."); }
    setFastSaving(true);

    try {
      await loadRazorpayScript();
    } catch {
      setFastSaving(false);
      return toast.error("Checkout failed to load — please retry.");
    }

    toast.loading("Preparing ₹1 fast link…", { id: "fl" });
    const { data, error } = await supabase.functions.invoke("fastlink-pay", {
      body: { action: "create" },
    });
    toast.dismiss("fl");
    if (error || !data?.orderId) {
      setFastSaving(false);
      return toast.error(error?.message || "Could not start payment.");
    }

    const Razorpay = (window as any).Razorpay;
    const { data: u } = await supabase.auth.getUser();
    const email = u?.user?.email ?? undefined;

    const rzp = new Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      name: "StreamVista Cloud X",
      description: "Fast Link to Dashboard",
      prefill: { email },
      theme: { color: "#3D7BFD" },
      handler: async (resp: any) => {
        toast.loading("Verifying payment…", { id: "fv" });
        const { data: v, error: vErr } = await supabase.functions.invoke("fastlink-pay", {
          body: {
            action: "verify",
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          },
        });
        toast.dismiss("fv");
        if (vErr || !v?.verified) {
          setFastSaving(false);
          return toast.error("Payment couldn't be verified. Contact support if you were charged.");
        }
        toast.success("Payment confirmed — routing to your dashboard.");
        const target = await pickDashboard();
        navigate(target, { replace: true });
      },
      modal: {
        ondismiss: () => {
          setFastSaving(false);
          toast.message("Checkout closed — you can retry anytime.");
        },
      },
    });
    rzp.on("payment.failed", () => {
      setFastSaving(false);
      toast.error("Payment failed — please try again.");
    });
    rzp.open();
  };

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-4">
          <Link to="/" className="block">
            <img
              src={crayonsLogo}
              alt="Crayons Pictures"
              className="mx-auto h-16 w-auto object-contain drop-shadow-lg"
            />
          </Link>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent">
              <Sparkles className="w-3.5 h-3.5" /> Account recovery
            </div>
            <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
            <p className="text-sm text-muted-foreground">
              Set a new password below, or use the Fast Link option to jump straight back in.
            </p>
          </div>
        </header>

        {sessionChecked && !sessionReady && (
          <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                Your recovery link has expired or was already used. Enter your email below to
                receive a fresh link — both options above will activate once you click it.
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-secondary/40 border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <button
                type="button"
                onClick={resendRecovery}
                disabled={resending}
                className="h-10 px-3 rounded-lg bg-accent/20 text-accent text-xs font-semibold hover:bg-accent/30 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {resending && <Loader2 className="w-3 h-3 animate-spin" />}
                Send link
              </button>
            </div>
          </div>
        )}



        {/* PRIMARY — new password input at the top */}
        <form onSubmit={submitPassword} className="glass rounded-2xl p-6 space-y-4">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Enter new password
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
              className={cn(
                "w-full h-12 px-3 pr-11 rounded-xl bg-secondary/40 border border-border/60 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-accent/40",
                pwdValid && "border-emerald-500/40",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <input
            type={showPwd ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className={cn(
              "w-full h-12 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/40",
              checks.match && "border-emerald-500/40",
            )}
          />

          {password.length > 0 && (
            <ul className="text-[11px] text-muted-foreground grid grid-cols-2 gap-y-1">
              <li className={cn("flex items-center gap-1", checks.length && "text-emerald-400")}>
                <CheckCircle2 className="w-3 h-3" /> 8+ characters
              </li>
              <li className={cn("flex items-center gap-1", checks.letter && "text-emerald-400")}>
                <CheckCircle2 className="w-3 h-3" /> Contains a letter
              </li>
              <li className={cn("flex items-center gap-1", checks.number && "text-emerald-400")}>
                <CheckCircle2 className="w-3 h-3" /> Contains a number
              </li>
              <li className={cn("flex items-center gap-1", checks.match && "text-emerald-400")}>
                <CheckCircle2 className="w-3 h-3" /> Both match
              </li>
            </ul>
          )}

          <button
            type="submit"
            disabled={savingPwd || !pwdValid || password !== confirm}
            className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {savingPwd && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password & continue
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="flex-1 h-px bg-border/60" />
          or
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* SECONDARY — Fast Link paywall */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold">Fast Link to Dashboard</h2>
              <p className="text-xs text-muted-foreground">
                Skip the password reset and jump straight back into your workspace. A one-time
                verification charge of <span className="text-foreground font-semibold">₹1</span> keeps
                this channel abuse-free.
              </p>
            </div>
          </div>

          <button
            onClick={runFastLink}
            disabled={fastSaving || !sessionReady}
            className="w-full h-12 rounded-xl border border-accent/40 bg-secondary/40 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {fastSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Pay ₹1 & open my dashboard
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            Charged securely via Razorpay. Your existing password stays unchanged.
          </p>
        </div>
      </div>
    </main>
  );
}
