import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2, ShieldCheck, ShieldAlert, Zap, Pencil, XCircle, ExternalLink, KeyRound, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StatusResp {
  configured: boolean;
  key_preview: string | null;
  source: "env" | null;
}

const RESEND_KEYS_URL = "https://resend.com/api-keys";

export default function ResendCredentials() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState<null | boolean>(null);
  const [verifyMsg, setVerifyMsg] = useState<string>("");
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [sender, setSender] = useState<{ from_address: string; sender_name: string; sender_domain: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("resend-admin", { body: { action: "status" } });
    setLoading(false);
    if (error) { toast.error(error.message || "Could not load Resend status"); return null; }
    setStatus(data as StatusResp);
    return data as StatusResp;
  };

  const runTest = async (silent = false) => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("resend-admin", { body: { action: "test" } });
    setTesting(false);
    const ok = !error && !!data?.ok;
    setVerified(ok);
    setVerifyMsg(ok ? (data?.message || "Connection verified") : (error?.message ?? data?.error ?? "Verification failed"));
    if (!silent) {
      if (ok) toast.success(data?.message || "Resend connection verified");
      else toast.error(data?.error || "Resend verification failed");
    }
    return ok;
  };

  useEffect(() => {
    (async () => {
      const s = await loadStatus();
      if (s?.configured) await runTest(true);
    })();
  }, []);

  const statusBadge = () => {
    if (loading) return null;
    if (!status?.configured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3" /> Setup required
        </span>
      );
    }
    if (verified === true) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> Verified
        </span>
      );
    }
    if (verified === false) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 text-destructive text-[11px] font-semibold uppercase tracking-wider">
          <XCircle className="w-3 h-3" /> Verification failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        <Loader2 className="w-3 h-3 animate-spin" /> Verifying…
      </span>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent" /> Resend (Email Delivery)
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Powers premium invitations, transactional & marketing email. The API key is stored in encrypted backend secrets — never exposed to the browser.
          </p>
        </div>
        {statusBadge()}
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <InfoRow label="API key" value={status?.key_preview ?? "Not set"} />
            <InfoRow label="Source" value={status?.configured ? "Encrypted secret" : "—"} />
          </div>

          {verifyMsg && verified === false && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span className="font-mono break-all">{verifyMsg}</span>
            </div>
          )}

          <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Rotating the key?</p>
              <p className="text-muted-foreground">
                Resend keys are managed as encrypted backend secrets. Ask Lovable to update <span className="font-mono text-foreground">RESEND_API_KEY</span> — the secure form will appear in chat. Then click <span className="font-semibold text-foreground">Re-test</span> below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => runTest(false)}
              disabled={testing || !status?.configured}
              className={cn(
                "h-11 px-5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-all",
                status?.configured
                  ? "border border-border bg-secondary/40 hover:bg-secondary"
                  : "bg-gradient-primary text-primary-foreground glow-primary",
                "disabled:opacity-60",
              )}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {status?.configured ? "Re-test connection" : "Awaiting secret"}
            </button>
            <a
              href={RESEND_KEYS_URL}
              target="_blank" rel="noreferrer"
              className="h-11 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Manage on Resend <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-foreground text-[13px] mt-0.5 truncate">{value}</div>
    </div>
  );
}
