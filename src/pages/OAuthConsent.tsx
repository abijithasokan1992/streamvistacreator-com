import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Beta namespace typing shim — supabase.auth.oauth exists at runtime.
type OAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthNS }).oauth;

function isSameOriginPath(p: string | null): p is string {
  return !!p && p.startsWith("/") && !p.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        try { sessionStorage.setItem("sv_consent_next", next); } catch { /* noop */ }
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load authorization.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) { setBusy(false); return setError(error.message); }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Authorization failed.");
    }
  }

  if (error) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-black">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "an external app";
  const scopes: string[] = details.scopes ?? details.scope ?? [];

  return (
    <main className="min-h-dvh grid place-items-center bg-background text-foreground px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Connect</div>
          <h1 className="text-xl font-black tracking-tight mt-1">
            Allow {clientName} to access StreamVista?
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This lets <strong className="text-foreground">{clientName}</strong> use StreamVista Creator on your behalf.
          It will only see data you can see, and only through the tools this app exposes.
        </p>
        {Array.isArray(scopes) && scopes.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
            {scopes.map((s) => <li key={String(s)}>{String(s)}</li>)}
          </ul>
        )}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
        </div>
      </div>
    </main>
  );
}
