import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MailX, CheckCircle2, AlertTriangle } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "success" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing token in the unsubscribe link." });
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState({ kind: "invalid", message: body?.error || "Invalid or expired link." });
          return;
        }
        if (body?.valid === false && body?.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "ready" });
      } catch (e: any) {
        setState({ kind: "invalid", message: e?.message || "Could not validate link." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) return setState({ kind: "error", message: error.message });
    if ((data as any)?.success) return setState({ kind: "success" });
    if ((data as any)?.reason === "already_unsubscribed") return setState({ kind: "already" });
    setState({ kind: "error", message: "Could not process unsubscribe." });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground grid place-items-center px-4">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 border border-border/40 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-primary grid place-items-center glow-primary">
          <MailX className="w-6 h-6 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Unsubscribe</h1>

        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Validating your link…
          </p>
        )}

        {state.kind === "ready" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Confirm that you no longer want to receive emails from StreamVista at this address.
            </p>
            <button
              onClick={confirm}
              className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.kind === "submitting" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </p>
        )}

        {state.kind === "success" && (
          <p className="text-sm text-accent inline-flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4" /> You've been unsubscribed.
          </p>
        )}

        {state.kind === "already" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <CheckCircle2 className="w-4 h-4 text-accent" /> This address is already unsubscribed.
          </p>
        )}

        {(state.kind === "invalid" || state.kind === "error") && (
          <p className="text-sm text-destructive inline-flex items-center gap-2 justify-center">
            <AlertTriangle className="w-4 h-4" /> {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
