import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "cb_ref_code";

/**
 * Captures `?ref=<code>` from the URL on any landing page and attaches it
 * to the user's account once they sign up / sign in. Self-healing: stays in
 * localStorage until consumed or 30 days have passed.
 */
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem(KEY, JSON.stringify({ code: ref.trim(), ts: Date.now() }));
      }
    } catch {}

    const attach = async (email?: string | null) => {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { code: string; ts: number };
        if (!parsed?.code) return;
        if (Date.now() - parsed.ts > 30 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(KEY);
          return;
        }
        const { data, error } = await supabase.rpc("attach_referral", {
          _code: parsed.code,
          _email: email ?? null,
        });
        if (!error && data) localStorage.removeItem(KEY);
      } catch {}
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) attach(data.session.user.email);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        attach(session.user.email);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
