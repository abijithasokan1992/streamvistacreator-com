import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardForRole, pickPrimaryRole, type AppRole } from "@/hooks/useAuth";
import { safeNextPath } from "@/lib/auth/safeNext";
import { mapAuthError } from "@/lib/auth/authErrors";

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
  const [sessionChecked, setSessionChecked] = useState(false);

  // Supabase may need a moment to exchange callback tokens and publish the
  // session to the auth hook. Do not treat the first user=null render as a
  // failed login, especially on hosted preview deployments.
  useEffect(() => {
    if (loading || user || sessionChecked) return;

    let cancelled = false;
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const queryParams = new URLSearchParams(window.location.search);
      const rawErr =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        queryParams.get("error_description") ||
        queryParams.get("error");

      if (rawErr) {
        const mapped = mapAuthError(decodeURIComponent(rawErr));
        toast.error(mapped.message);
        try { sessionStorage.setItem("sv_pending_auth_url", window.location.href); } catch { /* noop */ }
        navigate(`/auth?in_app_error=1&reason=${encodeURIComponent(mapped.code)}`, { replace: true });
        return;
      }

      setMessage("Verifying your secure session…");

      // Give the SDK time to process PKCE/hash callback state before the final
      // session check. This avoids false failures on Vercel and slower devices.
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      if (cancelled) return;

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        const mapped = mapAuthError(error);
        toast.error(mapped.message);
        try { sessionStorage.setItem("sv_pending_auth_url", window.location.href); } catch { /* noop */ }
        navigate(`/auth?in_app_error=1&reason=${encodeURIComponent(mapped.code)}`, { replace: true });
        return;
      }

      if (!data.session) {
        try { sessionStorage.setItem("sv_pending_auth_url", window.location.href); } catch { /* noop */ }
        navigate("/auth?in_app_error=1&reason=invalid_link", { replace: true });
        return;
      }

      // The auth listener should now update useAuth. Mark the check complete and
      // leave this screen in place until that state arrives.
      setSessionChecked(true);
    };

    void checkSession();
    return () => { cancelled = true; };
  }, [loading, user, sessionChecked, navigate]);

  useEffect(() => {
    if (loading || !user) return;

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
          const { error: roleError } = await supabase.rpc("set_initial_role" as never, { _role: chosen } as never);
          if (roleError) throw roleError;
        }
        try { sessionStorage.removeItem("sv_pending_role"); } catch { /* noop */ }

        // 2. Ensure profile row.
        const displayName =
          (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined
          ?? (user.user_metadata as Record<string, unknown> | undefined)?.display_name as string | undefined
          ?? (() => { try { return sessionStorage.getItem("sv_pending_name") || undefined; } catch { return undefined; } })()
          ?? user.email?.split("@")[0]
          ?? "Member";

        const { error: profileError } = await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            display_name: displayName,
            first_name: displayName.split(" ")[0],
            last_name: displayName.split(" ").slice(1).join(" ") || null,
            onboarding_step: "done",
          },
          { onConflict: "user_id" }
        );
        if (profileError) throw profileError;
        try { sessionStorage.removeItem("sv_pending_name"); } catch { /* noop */ }

        // 2b. Claim any legacy films (from the old scrapped app) staged under
        // this user's email. Each becomes a draft in content_titles they can
        // finish at their pace. Silent if there are none, but log failures for diagnosis.
        try {
          const { data: claimed, error: claimError } = await supabase.rpc("claim_legacy_films" as never);
          if (claimError) throw claimError;
          const n = Number(claimed ?? 0);
          if (n > 0) {
            toast.success(
              `Welcome back! ${n} legacy film${n === 1 ? "" : "s"} restored as draft${n === 1 ? "" : "s"}. Complete each title to 100% and submit for review.`,
              { duration: 10000 }
            );
          }
        } catch (e) {
          console.warn("legacy claim skipped", e);
        }

        // 3. Refresh role + redirect.
        await refreshRole();
        if (cancelled) return;
        // Re-read role after the RPC took effect.
        const { data: rows, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (rolesError) throw rolesError;
        const roles = (rows || []).map((r: any) => r.role as AppRole);
        const primary = pickPrimaryRole(roles);

        // If we came here mid-way through an OAuth consent flow, return there.
        let consentNextRaw: string | null = null;
        try { consentNextRaw = sessionStorage.getItem("sv_consent_next"); } catch { /* noop */ }
        const consentNext = safeNextPath(consentNextRaw);
        if (consentNext) {
          try { sessionStorage.removeItem("sv_consent_next"); } catch { /* noop */ }
          navigate(consentNext, { replace: true });
          return;
        }

        setMessage("Opening your workspace…");
        const dash = dashboardForRole(primary);
        // First-login / account-creation intro — one-time, skippable, non-blocking.
        let seen = false;
        try { seen = !!localStorage.getItem(`sv:seen-workspace-intro:${user.id}`); } catch { /* noop */ }
        if (!seen) {
          navigate(`/my-workspace?first=1&next=${encodeURIComponent(dash)}`, { replace: true });
        } else {
          navigate(dash, { replace: true });
        }
      } catch (err) {
        console.error("auth callback failed", err);
        const mapped = mapAuthError(err);
        toast.error(mapped.message || "Couldn't complete sign-in. Please try again.");
        navigate(`/auth?in_app_error=1&reason=${encodeURIComponent(mapped.code)}`, { replace: true });
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
