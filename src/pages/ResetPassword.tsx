import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2, Sparkles, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardForRole, type AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getAppOrigin } from "@/lib/site";
import { mapAuthError } from "@/lib/auth/authErrors";
import crayonsLogo from "@/assets/partner-crayons-pictures.png";

/**
 * Password recovery landing page.
 *
 * Reached from the recovery email link. Supabase exchanges the recovery token
 * for a temporary session before this component mounts, so `auth.uid()` is
 * already valid here.
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

export default function ResetPassword() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
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
    if (error) return toast.error(mapAuthError(error).message);
    toast.success("Password updated.");
    const target = await pickDashboard();
    navigate(target, { replace: true });
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
              Set a new password below to securely return to your workspace.
            </p>
          </div>
        </header>

        {sessionChecked && !sessionReady && (
          <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                Your recovery link has expired or was already used. Enter your email below to
                receive a fresh link.
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

      </div>
    </main>
  );
}
