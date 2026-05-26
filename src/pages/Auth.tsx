import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Schema = z.object({
  email: z.string().trim().email("Valid email required").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/admin", { replace: true });
  }, [user, loading, navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Account created. Check your inbox to confirm, then sign in.");
      setMode("login");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Signed in");
      navigate("/admin");
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-xs uppercase tracking-[0.3em] text-muted-foreground mb-6">
          ← StreamVista Cloud X
        </Link>
        <div className="glass-strong rounded-3xl p-8 animate-fade-in">
          <div className="text-center mb-7">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-primary grid place-items-center glow-primary mb-4">
              <ShieldCheck className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold">{mode === "login" ? "Admin Sign In" : "Create Admin Account"}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === "login" ? "Access the Crayons control panel." : "Bootstrap your operations workspace."}
            </p>
          </div>
          <form onSubmit={handle} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-input/60 h-12" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-input/60 h-12" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            <button type="submit" disabled={submitting} className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold glow-primary hover:scale-[1.01] transition-transform disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
          <div className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? (
              <>New here? <button onClick={() => setMode("signup")} className="text-accent hover:underline font-semibold">Create account</button></>
            ) : (
              <>Have an account? <button onClick={() => setMode("login")} className="text-accent hover:underline font-semibold">Sign in</button></>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          First user to sign in can claim admin role from the dashboard.
        </p>
      </div>
    </main>
  );
}
