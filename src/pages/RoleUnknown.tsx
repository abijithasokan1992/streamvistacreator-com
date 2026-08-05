import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, LifeBuoy, RefreshCw, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { safeNextPath } from "@/lib/auth/safeNext";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  lookup_failed: {
    title: "We couldn't verify your access role",
    body: "The role lookup service returned an error. Please retry, or contact support if this keeps happening.",
  },
  lookup_exception: {
    title: "Role lookup unavailable",
    body: "Your session is valid but we couldn't reach the role directory. Try again in a moment.",
  },
  no_role: {
    title: "No role assigned to this account",
    body: "Your account exists but has not been assigned a workspace role yet. Complete onboarding or ask an administrator to grant access.",
  },
  unmapped_role: {
    title: "Your role isn't wired to a dashboard yet",
    body: "Your account has a role we don't have a landing surface for. Support can route you manually.",
  },
  access_denied: {
    title: "This workspace is not available to your role",
    body: "Your account is signed in, but the requested area is outside your assigned role or organisation permissions. No protected data was shown.",
  },
};

export default function RoleUnknown() {
  const [params] = useSearchParams();
  const reason = params.get("reason") ?? "no_role";
  const from = safeNextPath(params.get("from"));
  const copy = useMemo(
    () => REASON_COPY[reason] ?? REASON_COPY.no_role,
    [reason],
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <>
      <Seo
        title="Access role unavailable — StreamVista"
        description="We couldn't determine or authorise your dashboard role. Contact support or retry."
        path="/auth/role-unknown"
      />
      <main className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md w-full rounded-2xl border border-amber-400/30 bg-amber-500/[0.04] p-6 md:p-8 shadow-xl">
          <div className="flex items-center gap-2 text-amber-300 text-xs uppercase tracking-[0.18em] font-mono">
            <AlertTriangle className="w-4 h-4" />
            Access hold
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-3 tracking-tight">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {copy.body}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-4 font-mono break-all">
            Reference: <span className="text-foreground/80">{reason}</span>
            {from ? <> · Route: <span className="text-foreground/80">{from}</span></> : null}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {reason === "access_denied" ? (
              <Button asChild size="sm" variant="default">
                <Link to="/dashboard">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> My dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="default">
                <Link to="/onboarding">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry onboarding
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/contact?topic=access">
                <LifeBuoy className="w-3.5 h-3.5 mr-1.5" /> Contact support
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
