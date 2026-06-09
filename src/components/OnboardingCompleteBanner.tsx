import { useEffect, useState } from "react";
import { BadgeCheck, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Persistent confirmation banner shown on the dashboard after onboarding completes.
 * Pulls plan_tier from user_profiles, and fires a one-time celebratory toast on first
 * paint after the wizard (signalled via sessionStorage flag).
 */
export default function OnboardingCompleteBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [studio, setStudio] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      const ts = localStorage.getItem(`sv_onboarding_done_${user.id}`);
      if (ts) setCompletedAt(ts);
      setDismissed(localStorage.getItem(`sv_onboarding_banner_dismissed_${user.id}`) === "1");
    } catch {}

    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("plan_tier,studio_name,onboarding_step")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.onboarding_step !== "done") return;
      setPlan(data.plan_tier ?? "free");
      setStudio(data.studio_name ?? null);
    })();

    // One-time celebratory toast after wizard
    try {
      if (sessionStorage.getItem("sv_onboarding_just_completed") === "1") {
        sessionStorage.removeItem("sv_onboarding_just_completed");
        toast.success("Onboarding complete", {
          description: "Your StreamVista workspace is ready.",
          icon: <BadgeCheck className="w-4 h-4" />,
        });
      }
    } catch {}
  }, [user]);

  if (!user || dismissed || !plan) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(`sv_onboarding_banner_dismissed_${user.id}`, "1"); } catch {}
  };

  return (
    <div className="relative mb-6 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-primary/5 to-transparent p-4 sm:p-5 glow-primary animate-fade-in">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-muted-foreground/70 hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary shrink-0">
          <BadgeCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-base">Onboarding complete</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] uppercase tracking-wider font-mono">
              <Sparkles className="w-3 h-3" /> {plan} plan
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {studio ? <>Workspace ready for <span className="text-foreground">{studio}</span>.</> : <>Your workspace is ready.</>}
            {completedAt && <> Confirmation sent to your inbox.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
