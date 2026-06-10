import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAppOrigin } from "@/lib/site";

/**
 * Admin self-service credentials. Lets the signed-in admin rotate the email
 * address or password used to access /admin. All updates go through Supabase
 * Auth — the database role assignment is untouched.
 */
export default function AdminCredentials() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const updateEmail = async () => {
    const parsed = z.string().email().max(255).safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    if (parsed.data === user?.email) return toast.message("That's already your admin email.");
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: `${getAppOrigin()}/admin` },
    );
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Verification email sent — confirm from both inboxes to finish the change.");
  };

  const updatePassword = async () => {
    if (!user?.email) return toast.error("No admin email on session");
    if (!currentPassword) return toast.error("Enter your current password");
    const ok = z.string().min(8, "Min 8 characters").max(72).safeParse(password);
    if (!ok.success) return toast.error(ok.error.issues[0].message);
    if (password !== confirm) return toast.error("Passwords don't match");
    if (password === currentPassword) return toast.error("New password must differ from current");

    setSavingPwd(true);
    // Strictly verify the current password by re-authenticating against Supabase Auth.
    // On success the session is refreshed; on failure no rotation happens.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      setSavingPwd(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    setCurrentPassword(""); setPassword(""); setConfirm("");
    toast.success("Admin password updated.");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Admin Credentials</h2>
          <p className="text-xs text-muted-foreground">Rotate the sign-in email or password for this admin account.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Admin email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={updateEmail}
            disabled={savingEmail}
            className="h-10 px-4 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-60 inline-flex items-center gap-2"
          >
            {savingEmail && <Loader2 className="w-4 h-4 animate-spin" />} Update email
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Current password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            autoComplete="current-password"
            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pt-2">
            <KeyRound className="w-3.5 h-3.5" /> New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={updatePassword}
            disabled={savingPwd}
            className="h-10 px-4 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-60 inline-flex items-center gap-2"
          >
            {savingPwd && <Loader2 className="w-4 h-4 animate-spin" />} Update password
          </button>
        </div>
      </div>
    </div>
  );
}
