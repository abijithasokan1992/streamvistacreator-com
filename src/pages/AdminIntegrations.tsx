import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw, Loader2, Cloud, Bot, Search, CreditCard, Github, MessageSquare, Mail, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ServiceStatus = {
  id: string;
  label: string;
  connected: boolean;
  mode?: string;
  note?: string;
  last_checked?: string;
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
};

export default function AdminIntegrations() {
  const { user, isAdmin, loading } = useAuth();
  const [services, setServices] = useState<ServiceStatus[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("integrations-status", { body: {} });
    if (error) {
      setError(error.message);
    } else if (data?.services) {
      setServices(data.services);
      setCheckedAt(data.checked_at ?? new Date().toISOString());
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
      } else if (id === "oracle") {
        await supabase.functions.invoke("verify-oci-connection", { body: {} });
      }
      await load();
    } finally {
      setTesting(null);
    }
  };

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
              Central control for platform services. Reuses existing backend, RBAC, storage, and billing.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
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
              const canTest = svc.id === "razorpay" || svc.id === "oracle";
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
                        {svc.mode && (
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                            {svc.mode}
                          </div>
                        )}
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

                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/40">
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
                        ) : (
                          "Test connection"
                        )}
                      </Button>
                    )}
                    {cfg && (
                      <Link
                        to={cfg.to}
                        className="text-xs text-primary hover:underline ml-auto"
                      >
                        {cfg.label} →
                      </Link>
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
    </main>
  );
}
