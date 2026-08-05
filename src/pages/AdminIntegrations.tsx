import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, XCircle, RefreshCw, Loader2, Cloud, Bot, Search, CreditCard,
  Github, MessageSquare, Mail, FileText, Sparkles, ExternalLink, Send, ShieldCheck, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ServiceStatus = {
  id: string;
  label: string;
  connected: boolean;
  health: "healthy" | "degraded" | "unknown" | "down";
  mode?: string;
  note?: string;
  version?: string;
  permissions?: string[];
  docs_url?: string;
  last_sync?: string;
  last_activity?: string;
  last_checked?: string;
  extra?: Record<string, unknown>;
};

const ICONS: Record<string, JSX.Element> = {
  oracle: <Cloud className="w-5 h-5" />,
  gpt55: <Sparkles className="w-5 h-5" />,
  gemini_enterprise: <Bot className="w-5 h-5" />,
  firecrawl: <Search className="w-5 h-5" />,
  razorpay: <CreditCard className="w-5 h-5" />,
  github: <Github className="w-5 h-5" />,
  gatewayapi: <MessageSquare className="w-5 h-5" />,
  gmail: <Mail className="w-5 h-5" />,
  sanity: <FileText className="w-5 h-5" />,
};

const CONFIG_LINKS: Record<string, { to: string; label: string }> = {
  oracle: { to: "/admin/storage", label: "Storage governance" },
  razorpay: { to: "/admin/billing", label: "Billing settings" },
  gmail: { to: "/admin/comms", label: "Email settings" },
  sanity: { to: "/admin/content", label: "Content management" },
  firecrawl: { to: "/admin/research", label: "Intelligence Center" },
  gpt55: { to: "/admin/assistant", label: "Assistant orchestration" },
};

function formatBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log10(n) / 3), u.length - 1);
  return `${(n / Math.pow(1000, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

function relTime(iso?: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminIntegrations() {
  const { user, isAdmin, loading } = useAuth();
  const [services, setServices] = useState<ServiceStatus[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState("");
  const [smsMessage, setSmsMessage] = useState("StreamVista test notification");
  const [smsSending, setSmsSending] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("integrations-status", { body: {} });
    if (error) setError(error.message);
    else if ((data as { services?: ServiceStatus[] })?.services) {
      setServices((data as { services: ServiceStatus[] }).services);
      setCheckedAt((data as { checked_at?: string }).checked_at ?? new Date().toISOString());
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const summary = useMemo(() => {
    if (!services) return null;
    const connected = services.filter((s) => s.connected).length;
    return `${connected} of ${services.length} services connected`;
  }, [services]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const testConnection = async (id: string) => {
    setTesting(id);
    try {
      if (id === "razorpay") {
        await supabase.functions.invoke("check-razorpay-status", { body: {} });
        toast.success("Razorpay checked");
      } else if (id === "oracle") {
        await supabase.functions.invoke("verify-oci-connection", { body: {} });
        toast.success("Oracle Cloud checked");
      } else if (id === "gatewayapi") {
        setSmsOpen(true);
        return;
      } else if (id === "firecrawl") {
        const { data } = await supabase.functions.invoke("research-firecrawl", {
          body: { query: "streamvista test", limit: 1 },
        });
        if ((data as { error?: string })?.error) toast.error("Firecrawl unreachable");
        else toast.success("Firecrawl reachable");
      } else if (id === "gpt55" || id === "gemini_enterprise") {
        const { data } = await supabase.functions.invoke("assistant-chat", {
          body: { messages: [{ role: "user", content: "ping" }] },
        });
        if ((data as { error?: string })?.error) toast.error("Assistant unreachable");
        else toast.success("Assistant reachable");
      }
      await load();
    } catch (e) {
      toast.error(`Test failed: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  };

  const sendTestSms = async () => {
    setSmsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-test", {
        body: { recipient: smsRecipient, message: smsMessage },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error(`SMS failed: ${error?.message ?? (data as { error?: string }).error}`);
      } else {
        toast.success("Test SMS dispatched");
        setSmsOpen(false);
      }
    } finally {
      setSmsSending(false);
    }
  };

  const testable = new Set(["oracle", "razorpay", "gatewayapi", "firecrawl", "gpt55", "gemini_enterprise"]);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to admin
            </Link>
            <h1 className="font-display text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Health, activity, and permissions for every connected service. Reuses existing
              backend, RBAC, storage, and billing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/deployments"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-sky-400/40 text-sky-300 hover:bg-sky-500/10"
              aria-label="Open Deployment Control"
            >
              <Cloud className="w-3.5 h-3.5" /> Deployment Control
            </Link>
            <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </header>

        {summary && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{summary}</span>
            {checkedAt && <span>· Last checked {new Date(checkedAt).toLocaleTimeString()}</span>}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load integrations: {error}
          </div>
        )}

        {!services && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading integrations…
          </div>
        )}

        {services && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((svc) => {
              const cfg = CONFIG_LINKS[svc.id];
              const canTest = testable.has(svc.id);
              const extra = svc.extra ?? {};
              return (
                <div
                  key={svc.id}
                  className="glass rounded-2xl p-5 flex flex-col gap-3 border border-border/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-secondary/60 grid place-items-center text-accent">
                        {ICONS[svc.id] ?? <Cloud className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm leading-tight">{svc.label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 flex gap-1.5">
                          {svc.version && <span>{svc.version}</span>}
                          {svc.mode && <span>· {svc.mode}</span>}
                        </div>
                      </div>
                    </div>
                    {svc.connected ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not connected
                      </Badge>
                    )}
                  </div>

                  {svc.note && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{svc.note}</p>
                  )}

                  {/* Oracle Cloud extended detail */}
                  {svc.id === "oracle" && svc.connected && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] rounded-lg bg-secondary/30 p-2.5 border border-border/40">
                      <div>
                        <div className="text-muted-foreground">Used capacity</div>
                        <div className="font-medium">{formatBytes(Number(extra.used_bytes ?? 0))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Active uploads</div>
                        <div className="font-medium">{String(extra.active_uploads ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Archive</div>
                        <div className="font-medium">{extra.archive_bucket ? "Enabled" : "Standard tier"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Region</div>
                        <div className="font-medium">{String(extra.region ?? "—")}</div>
                      </div>
                    </div>
                  )}

                  {svc.id === "github" && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] rounded-lg bg-secondary/30 p-2.5 border border-border/40">
                      <div>
                        <div className="text-muted-foreground">Repository</div>
                        <div className="font-medium truncate">{String(extra.repository ?? "—")}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Branch</div>
                        <div className="font-medium truncate">{String(extra.branch ?? "main")}</div>
                      </div>
                    </div>
                  )}

                  {svc.id === "gatewayapi" && (
                    <div className="flex gap-1.5 flex-wrap">
                      {extra.sms && <Badge variant="secondary" className="text-[10px]">SMS</Badge>}
                      {extra.rcs && <Badge variant="secondary" className="text-[10px]">RCS</Badge>}
                      {extra.email_fallback && (
                        <Badge variant="secondary" className="text-[10px]">Email fallback</Badge>
                      )}
                    </div>
                  )}

                  {svc.permissions && svc.permissions.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                      {svc.permissions.slice(0, 4).map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Last sync {relTime(svc.last_sync ?? svc.last_checked)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Activity {relTime(svc.last_activity)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/40 flex-wrap">
                    {canTest && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnection(svc.id)}
                        disabled={testing === svc.id}
                        className="h-8 text-xs"
                      >
                        {testing === svc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : svc.id === "gatewayapi" ? (
                          <><Send className="w-3 h-3 mr-1" /> Test SMS</>
                        ) : (
                          "Test connection"
                        )}
                      </Button>
                    )}
                    {cfg && (
                      <Link
                        to={cfg.to}
                        className="text-xs text-primary hover:underline"
                      >
                        {cfg.label} →
                      </Link>
                    )}
                    {svc.docs_url && (
                      <a
                        href={svc.docs_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
                      >
                        Docs <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="glass rounded-2xl p-5 border border-dashed border-border/60 text-xs text-muted-foreground">
          Secrets never appear here. Configuration for each service lives in its existing admin
          surface (linked above) or the platform secrets vault. Reuse-only: no duplicate modules,
          no schema changes, existing RBAC applies.
        </div>
      </div>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test GatewayAPI SMS</DialogTitle>
            <DialogDescription>
              Sends a single SMS via the existing GatewayAPI connector. Uses the current
              notification pipeline; no duplicate sender is created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Recipient (MSISDN with country code)</label>
              <Input
                value={smsRecipient}
                onChange={(e) => setSmsRecipient(e.target.value)}
                placeholder="e.g. 919812345678"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message</label>
              <Input value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSmsOpen(false)} disabled={smsSending}>
              Cancel
            </Button>
            <Button onClick={sendTestSms} disabled={smsSending || !smsRecipient.replace(/\D/g, "")}>
              {smsSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="ml-2">Send test</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
