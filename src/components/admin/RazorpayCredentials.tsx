import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert, Copy, Check, ExternalLink, Zap, Pencil, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "test" | "live";

interface StatusResp {
  configured: boolean;
  source: "db" | "env" | "mixed" | null;
  mode: Mode;
  key_id_preview: string | null;
  webhook_set: boolean;
  updated_at: string | null;
}

// Derive the webhook URL from the deployed edge-function host so it always
// stays in sync with the actual endpoint, regardless of any custom frontend
// domain. Razorpay webhooks MUST target the backend function URL, not the
// site's custom domain (the frontend is a static SPA and cannot receive POSTs).
const SUPABASE_FN_BASE = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const WEBHOOK_URL = `${SUPABASE_FN_BASE}/functions/v1/razorpay-webhook`;
const SITE_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
const DASHBOARD_URL = "https://dashboard.razorpay.com/app/webhooks";

export default function RazorpayCredentials() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState<null | boolean>(null);
  const [verifyMsg, setVerifyMsg] = useState<string>("");
  const [editing, setEditing] = useState(false);

  const [status, setStatus] = useState<StatusResp | null>(null);

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [mode, setMode] = useState<Mode>("test");
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("razorpay-admin", {
      body: { action: "status" },
    });
    setLoading(false);
    if (error) { toast.error(error.message || "Could not load Razorpay status"); return null; }
    const s = data as StatusResp;
    setStatus(s);
    if (s?.mode) setMode(s.mode);
    setEditing(!s?.configured);
    return s;
  };

  const runTest = async (silent = false): Promise<boolean> => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("razorpay-admin", {
      body: { action: "test" },
    });
    setTesting(false);
    const ok = !error && !!data?.ok;
    setVerified(ok);
    setVerifyMsg(ok ? (data?.message || "Connection verified") : (error?.message ?? data?.error ?? "Verification failed"));
    if (!silent) {
      if (ok) toast.success(data?.message || "Razorpay connection verified");
      else toast.error(data?.error || "Razorpay verification failed");
    }
    return ok;
  };

  useEffect(() => {
    (async () => {
      const s = await loadStatus();
      if (s?.configured) await runTest(true);
    })();
  }, []);

  const onSave = async () => {
    // Light client-side validation
    if (keyId.trim()) {
      const expectedPrefix = mode === "live" ? "rzp_live_" : "rzp_test_";
      if (!keyId.trim().startsWith(expectedPrefix)) {
        toast.error(`Key ID for ${mode} mode must start with "${expectedPrefix}".`);
        return;
      }
    }

    setSaving(true);
    // Only the non-secret Key ID + mode live in the database. The Key Secret
    // and Webhook Secret are stored exclusively as backend environment
    // secrets (RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET) — never in DB.
    const payload: Record<string, any> = { id: true, mode };
    if (keyId.trim()) payload.key_id = keyId.trim();

    const { error } = await supabase
      .from("razorpay_config")
      .upsert(payload, { onConflict: "id" });
    if (error) { setSaving(false); toast.error(error.message); return; }
    const s = await loadStatus();
    setSaving(false);
    if (!s?.configured) {
      toast.message("Saved Key ID. Add RAZORPAY_KEY_SECRET in Backend Secrets to finish setup.");
      return;
    }
    const ok = await runTest(false);
    if (ok) setEditing(false);
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(WEBHOOK_URL); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error("Copy failed"); }
  };

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
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider",
          status.mode === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-500/15 text-emerald-400",
        )}>
          <ShieldCheck className="w-3 h-3" /> Verified · {status.mode}
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
            <CreditCard className="w-5 h-5 text-accent" /> Razorpay Credentials
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Used by checkout, payment verification and webhooks. Stored encrypted at rest; only admins can read or change them.
          </p>
        </div>
        {statusBadge()}
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : editing ? (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-secondary/40 border border-border/50 w-fit">
            {(["test", "live"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "h-8 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all",
                  mode === m
                    ? (m === "live" ? "bg-emerald-500 text-white" : "bg-gradient-primary text-primary-foreground")
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Key ID</label>
              <input
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder={mode === "live" ? "rzp_live_..." : "rzp_test_..."}
                autoComplete="off"
                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>

            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Key Secret & Webhook Secret</p>
              <p>
                For security, payment gateway secrets are stored only as backend
                environment variables — never in the database. Set / rotate them in
                <span className="font-mono text-foreground"> Backend → Secrets</span> as
                <span className="font-mono text-foreground"> RAZORPAY_KEY_SECRET</span> and
                <span className="font-mono text-foreground"> RAZORPAY_WEBHOOK_SECRET</span>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={onSave}
                disabled={saving || testing}
                className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
              >
                {(saving || testing) && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving…" : testing ? "Verifying…" : "Save & verify"}
              </button>
              {status?.configured && (
                <button
                  onClick={() => { setKeyId(""); setKeySecret(""); setWebhookSecret(""); setEditing(false); }}
                  className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold"
                >Cancel</button>
              )}
              <a
                href={DASHBOARD_URL}
                target="_blank" rel="noreferrer"
                className="h-11 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary inline-flex items-center gap-2"
              >
                Open Razorpay <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <InfoRow label="Active Key ID" value={status?.key_id_preview ?? "—"} />
            <InfoRow label="Webhook secret" value={status?.webhook_set ? "Configured" : "Not set"} />
            <InfoRow label="Mode" value={status?.mode ?? "—"} />
            <InfoRow label="Last updated" value={status?.updated_at ? new Date(status.updated_at).toLocaleString() : "—"} />
          </div>

          {verifyMsg && verified === false && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span className="font-mono break-all">{verifyMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setEditing(true)}
              className="h-11 px-5 rounded-xl border border-accent/40 text-accent hover:bg-accent/10 text-sm font-semibold inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit credentials
            </button>
            <button
              onClick={() => runTest(false)}
              disabled={testing}
              className="h-11 px-5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Re-test connection
            </button>
          </div>
        </>
      )}

      {/* Webhook helper — always visible, auto-synced with deployed edge function */}
      <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">Webhook URL (paste in Razorpay → Settings → Webhooks)</p>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Open Razorpay <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-md bg-background/60 border border-border/50 font-mono text-[11px] break-all">
            {WEBHOOK_URL}
          </code>
          <button onClick={copyWebhook} className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-secondary">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-muted-foreground">
          Subscribe to: <span className="font-mono text-foreground">payment.captured</span>,{" "}
          <span className="font-mono text-foreground">payment.failed</span>,{" "}
          <span className="font-mono text-foreground">order.paid</span>,{" "}
          <span className="font-mono text-foreground">refund.processed</span>,{" "}
          <span className="font-mono text-foreground">subscription.*</span>.
        </p>

        <div className="pt-3 mt-1 border-t border-border/30 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Razorpay website / origin checklist</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Canonical app + payment website (used by the app): <span className="font-mono text-foreground">https://streamvista.in</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
              <span>Approved corporate website: <span className="font-mono text-foreground">https://www.crayonspictures.com</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>
                Razorpay merchant review pending — dashboard may still show
                <span className="font-mono text-foreground"> https://www.crayonsloop.com</span> as
                the current primary website until approval. External operator state only — the app
                does NOT use Crayons Loop for callbacks, verify, webhook returns, invoices or auth.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>Preview only — do not treat as the live payment website: <span className="font-mono text-foreground">https://streamvista-creator.lovable.app</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="line-through opacity-70">https://app.crayonspictures.com</span>
              <span className="not-italic opacity-80">— deprecated, remove from Razorpay if still listed.</span>
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground pt-1">
            App-side payment success/failure handling is fully decoupled from the Razorpay website
            review status. Continue product build on the StreamVista Creator domain model; run a
            real Studio Vault payment after Razorpay approves the website cutover to complete live
            launch validation.
          </p>
          {SITE_ORIGIN && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Current browser origin (for reference): <span className="font-mono text-foreground">{SITE_ORIGIN}</span>
              {SITE_ORIGIN.includes("streamvista.in")
                ? <span className="ml-1 text-emerald-300">· production</span>
                : (SITE_ORIGIN.includes("lovable.app") || SITE_ORIGIN.includes("localhost"))
                ? <span className="ml-1 text-amber-300">· preview — not the canonical payment domain</span>
                : SITE_ORIGIN.includes("app.crayonspictures.com")
                ? <span className="ml-1 text-red-300">· deprecated domain</span>
                : null}
            </p>
          )}
        </div>
      </div>
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

