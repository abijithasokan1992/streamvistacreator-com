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
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<"profile" | "plan" | "done" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (loading) return;
      if (!user) { if (alive) setChecking(false); return; }
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_step")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setStep(((data?.onboarding_step as any) ?? "profile"));
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
  if (!isAdmin && step !== "done") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
