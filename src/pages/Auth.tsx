import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>("email");

  useEffect(() => {
    if (!loading && user) navigate("/vault", { replace: true });
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
        options: { emailRedirectTo: `${window.location.origin}/vault` },
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Workspace created — check your inbox to verify.");
      setMode("login");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      navigate("/vault");
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground grid place-items-center px-4">
      {/* Cinematic ambient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[140px] animate-pulse" />
        <div className="absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-accent/20 blur-[140px] animate-pulse [animation-delay:1.6s]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background))_100%)]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="block text-center text-[11px] uppercase tracking-[0.45em] text-muted-foreground/80 mb-10 hover:text-foreground transition-colors">
          StreamVista <span className="text-accent">·</span> Cloud X
        </Link>

        <div className="glass-strong rounded-3xl p-10 animate-fade-in border border-white/5">
          <div className="text-center mb-9">
            <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">
              Workspace <span className="gradient-text">Login</span>
            </h1>
          </div>

          <form onSubmit={handle} className="space-y-5" autoComplete="on">
            {/* Email field with pulsating glow when focused */}
            <div className={cn("relative group", focused === "email" && "is-active")}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                placeholder="you@studio.com"
                required
                autoComplete="email"
                className="peer w-full h-14 px-5 rounded-2xl bg-input/40 border border-border/60 text-base text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70"
              />
              <span className={cn(
                "pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500",
                "ring-2 ring-accent/40 shadow-[0_0_28px_-4px_hsl(var(--accent)/0.55)] opacity-0",
                "peer-focus:opacity-100 peer-focus:animate-pulse"
              )} />
            </div>

            <div className={cn("relative group", focused === "password" && "is-active")}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="peer w-full h-14 px-5 rounded-2xl bg-input/40 border border-border/60 text-base text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-accent/70 focus:bg-input/70"
              />
              <span className={cn(
                "pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500",
                "ring-2 ring-accent/40 shadow-[0_0_28px_-4px_hsl(var(--accent)/0.55)] opacity-0",
                "peer-focus:opacity-100 peer-focus:animate-pulse"
              )} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="relative w-full h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-display font-semibold text-[15px] tracking-wide glow-primary hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> One moment…</>
              ) : (
                mode === "login" ? "Enter Workspace" : "Create Workspace"
              )}
            </button>

            {/* Subtle mode toggle — no clunky helper text */}
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-[12px] tracking-[0.2em] uppercase text-muted-foreground/70 hover:text-accent transition-colors"
              >
                {mode === "login" ? "Request access" : "Have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
