import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole, pickPrimaryRole, type AppRole } from "@/hooks/useAuth";

/**
 * Magic-link / OAuth callback target.
 *   1. Wait for the session to materialise.
 *   2. If the user has no role yet, apply the role they chose at signup
 *      via the server-side `set_initial_role` whitelist.
 *   3. Make sure a `user_profiles` row exists.
 *   4. Redirect to the canonical dashboard for that role.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, role, loading, refreshRole } = useAuth();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Could be an invalid / expired link — bounce to login.
      const params = new URLSearchParams(window.location.hash.slice(1));
      const err = params.get("error_description") || params.get("error");
      if (err) toast.error(decodeURIComponent(err));
      // Preserve the full original callback URL (with hash tokens / query params)
      // so the blocked-browser recovery UI can re-open it in Safari / Chrome.
      try {
        sessionStorage.setItem("sv_pending_auth_url", window.location.href);
      } catch { /* noop */ }
      navigate(`/auth?in_app_error=1${err ? "&err=" + encodeURIComponent(err) : ""}`, { replace: true });
      return;
    }
    // Clear any stale recovery stash once we have a real session.
    try { sessionStorage.removeItem("sv_pending_auth_url"); } catch { /* noop */ }

    let cancelled = false;
    (async () => {
      try {
        // 1. Apply the public signup role. New users may briefly receive the
        // legacy default role before this page runs, so do not require role=null.
        const stashed = (() => {
          try { return sessionStorage.getItem("sv_pending_role"); } catch { return null; }
        })();
        const metaRole = (user.user_metadata as Record<string, unknown> | undefined)?.requested_role;
        const chosen = (stashed || metaRole) as string | null;
        const publicSignupRoles = ["content_owner", "studio", "buyer"];
        const protectedRoles = ["admin", "super_admin", "qc_reviewer", "legal_reviewer", "localization_partner", "distributor"];

        if (chosen && publicSignupRoles.includes(chosen) && !protectedRoles.includes(role ?? "")) {
          await supabase.rpc("set_initial_role" as never, { _role: chosen } as never);
        }
        try { sessionStorage.removeItem("sv_pending_role"); } catch { /* noop */ }

        // 2. Ensure profile row.
        const displayName =
          (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined
          ?? (user.user_metadata as Record<string, unknown> | undefined)?.display_name as string | undefined
          ?? (() => { try { return sessionStorage.getItem("sv_pending_name") || undefined; } catch { return undefined; } })()
          ?? user.email?.split("@")[0]
          ?? "Member";

        await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            display_name: displayName,
            first_name: displayName.split(" ")[0],
            last_name: displayName.split(" ").slice(1).join(" ") || null,
            onboarding_step: "done",
          },
          { onConflict: "user_id" }
        );
        try { sessionStorage.removeItem("sv_pending_name"); } catch { /* noop */ }

        // 2b. Claim any legacy films (from the old scrapped app) staged under
        // this user's email. Each becomes a draft in content_titles they can
        // finish at their pace. Silent if there are none.
        try {
          const { data: claimed } = await supabase.rpc("claim_legacy_films" as never);
          const n = typeof claimed === "number" ? claimed : 0;
          if (n > 0) {
            toast.success(
              `${n} film${n === 1 ? "" : "s"} from your previous account restored as draft${n === 1 ? "" : "s"}. Finish them in your dashboard.`,
              { duration: 8000 }
            );
          }
        } catch (e) {
          console.warn("legacy claim skipped", e);
        }



        // 3. Refresh role + redirect.
        await refreshRole();
        if (cancelled) return;
        // Re-read role after the RPC took effect.
        const { data: rows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roles = (rows || []).map((r: any) => r.role as AppRole);
        const primary = pickPrimaryRole(roles);

        // If we came here mid-way through an OAuth consent flow, return there.
        let consentNext: string | null = null;
        try { consentNext = sessionStorage.getItem("sv_consent_next"); } catch { /* noop */ }
        if (consentNext && consentNext.startsWith("/") && !consentNext.startsWith("//")) {
          try { sessionStorage.removeItem("sv_consent_next"); } catch { /* noop */ }
          navigate(consentNext, { replace: true });
          return;
        }

        setMessage("Opening your workspace…");
        navigate(dashboardForRole(primary), { replace: true });
      } catch (err) {
        console.error("auth callback failed", err);
        toast.error("Couldn't complete sign-in. Please try again.");
        navigate("/auth?in_app_error=1", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user, role, loading, navigate, refreshRole]);

  return (
    <main className="min-h-dvh grid place-items-center bg-background text-foreground">
      <div className="text-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
