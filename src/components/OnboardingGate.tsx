import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Linear onboarding gate.
 *
 * - Unauthenticated → /auth (carrying next= for round-trip)
 * - Authenticated but profile step != 'done' → /onboarding
 * - Otherwise renders children.
 *
 * Admins always bypass onboarding so the control panel is reachable.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<"profile" | "plan" | "done" | null>(null);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (loading) return;
      if (!user) { if (alive) setChecking(false); return; }
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_step, is_suspended")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setStep(((data?.onboarding_step as any) ?? "profile"));
      setSuspended(!!(data as any)?.is_suspended);
      setChecking(false);
    })();
    return () => { alive = false; };
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (suspended && !isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold">Account on hold</h1>
          <p className="text-sm text-muted-foreground">
            This account has been temporarily suspended by an administrator. Please contact support if you believe this is a mistake.
          </p>
          <button onClick={signOut} className="px-4 py-2 rounded-md border border-border hover:bg-secondary text-sm">
            Sign out
          </button>
        </div>
      </div>
    );
  }
  if (!isAdmin && step !== "done") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
