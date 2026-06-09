import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert, Copy, Check, ExternalLink, Zap } from "lucide-react";
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

const WEBHOOK_URL = "https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/razorpay-webhook";
const DASHBOARD_URL = "https://dashboard.razorpay.com/app/keys";

export default function RazorpayCredentials() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
    if (error) { toast.error(error.message || "Could not load Razorpay status"); return; }
    setStatus(data as StatusResp);
    if (data?.mode) setMode(data.mode);
  };

  useEffect(() => { loadStatus(); }, []);

  const onSave = async () => {
    if (!keyId.trim() && !keySecret.trim() && !webhookSecret.trim()) {
      // Only mode changed — still allow save.
    }
    setSaving(true);
    const payload: Record<string, any> = { id: true, mode };
    if (keyId.trim()) payload.key_id = keyId.trim();
    if (keySecret.trim()) payload.key_secret = keySecret.trim();
    if (webhookSecret.trim()) payload.webhook_secret = webhookSecret.trim();

    const { error } = await supabase
      .from("razorpay_config")
      .upsert(payload, { onConflict: "id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Razorpay credentials saved");
    setKeySecret(""); setWebhookSecret("");
    await loadStatus();
  };

  const onTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("razorpay-admin", {
      body: {
        action: "test",
        keyId: keyId.trim() || undefined,
        keySecret: keySecret.trim() || undefined,
      },
    });
    setTesting(false);
    if (error) { toast.error(error.message); return; }
    if (data?.ok) toast.success(data.message || "Connection verified");
    else toast.error(data?.error || "Connection failed");
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(WEBHOOK_URL); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error("Copy failed"); }
  };

  const statusBadge = () => {
    if (loading) return null;
    if (!status?.configured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3" /> Not configured
        </span>
      );
    }
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider",
        status.mode === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400",
      )}>
        <ShieldCheck className="w-3 h-3" /> {status.mode === "live" ? "Live" : "Test"} · {status.source}
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
      ) : (
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

          {/* Current state */}
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <InfoRow label="Active Key ID" value={status?.key_id_preview ?? "—"} />
            <InfoRow label="Webhook secret" value={status?.webhook_set ? "Configured" : "Not set"} />
            <InfoRow label="Source" value={status?.source ?? "—"} />
            <InfoRow label="Last updated" value={status?.updated_at ? new Date(status.updated_at).toLocaleString() : "—"} />
          </div>

          {/* Form */}
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

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Key Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  placeholder={status?.configured ? "•••••••• (leave blank to keep)" : "Paste from Razorpay dashboard"}
                  autoComplete="new-password"
                  className="w-full h-11 px-3 pr-11 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button type="button" onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Webhook Secret</label>
              <div className="relative">
                <input
                  type={showWebhook ? "text" : "password"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={status?.webhook_set ? "•••••••• (leave blank to keep)" : "Set when creating webhook in Razorpay"}
                  autoComplete="new-password"
                  className="w-full h-11 px-3 pr-11 rounded-xl bg-secondary/40 border border-border/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button type="button" onClick={() => setShowWebhook(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5">
                  {showWebhook ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold glow-primary text-sm disabled:opacity-60 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save credentials
              </button>
              <button
                onClick={onTest}
                disabled={testing}
                className="h-11 px-5 rounded-xl border border-accent/40 text-accent hover:bg-accent/10 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Test connection
              </button>
              <a
                href={DASHBOARD_URL}
                target="_blank" rel="noreferrer"
                className="h-11 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary inline-flex items-center gap-2"
              >
                Open Razorpay <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Webhook helper */}
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-2 text-xs">
            <p className="font-semibold text-foreground">Webhook URL (paste in Razorpay → Settings → Webhooks)</p>
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
              <span className="font-mono text-foreground">refund.processed</span>.
            </p>
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
