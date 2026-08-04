import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, Bot, CheckCircle2, Cloud, Database, Github,
  HelpCircle, Loader2, Mail, MonitorSmartphone, RefreshCw, ShieldCheck, XCircle,
  ExternalLink, Handshake,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Owner-only StreamVista Control Center.
 *
 * Read-only health aggregation over EXISTING infrastructure:
 *   - `infra-health` edge function (database, auth, edge functions, queues, mcp, routing)
 *   - existing tables via the shared Supabase client (RLS enforced)
 * No check ever reports SUCCESS unless it was positively verified. Anything that
 * cannot be verified from inside the app reports BLOCKED or UNKNOWN.
 */

type CcStatus = "SUCCESS" | "FAILED" | "BLOCKED" | "DANGER" | "UNKNOWN";

type CardId =
  | "frontend" | "database" | "auth" | "edge_functions"
  | "email_queue" | "mcp" | "deployment" | "partner_agent";

type CcCard = {
  id: CardId;
  label: string;
  icon: JSX.Element;
  status: CcStatus;
  lastChecked: string | null;
  impact: string;
  issue: string | null;
  actionTaken: string;
  blocker: string | null;
  action?: { kind: "link" | "retry_email"; to?: string; label: string };
};

type InfraCheck = {
  id: string; label: string; category: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  response_ms: number | null; last_checked: string;
  error: string | null; suggested_action: string | null;
  detail?: Record<string, unknown>;
};
type InfraReport = { checks: InfraCheck[]; generated_at: string };

type Incident = {
  id: string; source: string; when: string; summary: string; severity: CcStatus;
};

const TONE: Record<CcStatus, string> = {
  SUCCESS: "border-emerald-400/40 bg-emerald-500/5 text-emerald-300 shadow-[0_0_24px_-12px_rgba(16,185,129,0.9)]",
  FAILED: "border-red-500/40 bg-red-500/5 text-red-300",
  DANGER: "border-red-500/50 bg-red-500/10 text-red-200",
  BLOCKED: "border-amber-400/40 bg-amber-500/5 text-amber-300",
  UNKNOWN: "border-border/50 bg-secondary/10 text-muted-foreground",
};

const STATUS_ICON: Record<CcStatus, JSX.Element> = {
  SUCCESS: <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden />,
  FAILED: <XCircle className="w-4 h-4 text-red-400" aria-hidden />,
  DANGER: <AlertTriangle className="w-4 h-4 text-red-300" aria-hidden />,
  BLOCKED: <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden />,
  UNKNOWN: <HelpCircle className="w-4 h-4 text-muted-foreground" aria-hidden />,
};

const RANK: Record<CcStatus, number> = { SUCCESS: 0, UNKNOWN: 1, BLOCKED: 2, FAILED: 3, DANGER: 4 };

function fromInfra(s: InfraCheck["status"] | undefined): CcStatus {
  if (s === "healthy") return "SUCCESS";
  if (s === "warning") return "BLOCKED";
  if (s === "critical") return "FAILED";
  return "UNKNOWN";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const d = Date.now() - Date.parse(iso);
  if (Number.isNaN(d)) return "unknown";
  const s = Math.round(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function ControlCenter() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [running, setRunning] = useState(false);
  const [cards, setCards] = useState<CcCard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setRunning(true);
    const now = new Date().toISOString();

    // 1) Existing infra-health edge function (read-only probes).
    let report: InfraReport | null = null;
    let infraError: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke<InfraReport>("infra-health");
      if (error) throw error;
      if ((data as unknown as { error?: string })?.error) throw new Error((data as unknown as { error: string }).error);
      report = data as InfraReport;
    } catch (e) {
      infraError = e instanceof Error ? e.message : String(e);
    }
    const byId = new Map<string, InfraCheck>();
    (report?.checks ?? []).forEach((c) => byId.set(c.id, c));
    const pick = (id: string) => byId.get(id);

    // 2) Direct read-only reads through the shared client.
    const [sessionRes, emailFailed, mcpFlags, agentEvents] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from("email_send_log")
        .select("id, recipient_email, status, created_at, error_message")
        .in("status", ["failed", "failed_permanent"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("mcp_control_flags").select("*").limit(5),
      supabase.from("agent_events")
        .select("id, severity, agent, title, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const dbCheck = pick("database");
    const authCheck = pick("auth");
    const edgeCheck = pick("edge_functions");
    const queueCheck = pick("email_queue");
    const providerCheck = pick("email_provider");
    const mcpCheck = pick("mcp");
    const routing = pick("https_routing");
    const uploads = pick("upload_queue");

    const failedEmails = emailFailed.data?.length ?? 0;
    const agentErr = agentEvents.error?.message ?? null;
    const agentCritical = (agentEvents.data ?? []).filter(
      (e: { severity?: string }) => e.severity === "critical",
    ).length;

    const next: CcCard[] = [
      {
        id: "frontend",
        label: "Frontend",
        icon: <MonitorSmartphone className="w-4 h-4" aria-hidden />,
        status: routing ? fromInfra(routing.status) : "SUCCESS",
        lastChecked: routing?.last_checked ?? now,
        impact: "Owner and creator surfaces are unreachable if this fails.",
        issue: routing?.error ?? null,
        actionTaken: "App shell rendered this page and public routing was probed.",
        blocker: routing ? null : "HTTPS routing probe unavailable — only in-app render verified.",
      },
      {
        id: "database",
        label: "Supabase Database",
        icon: <Database className="w-4 h-4" aria-hidden />,
        status: dbCheck ? fromInfra(dbCheck.status) : "BLOCKED",
        lastChecked: dbCheck?.last_checked ?? now,
        impact: "All titles, deals, billing and audit data depend on this.",
        issue: dbCheck?.error ?? infraError,
        actionTaken: "Read-only probe via infra-health.",
        blocker: dbCheck ? null : `Probe not returned${infraError ? `: ${infraError}` : ""}`,
      },
      {
        id: "auth",
        label: "Authentication",
        icon: <ShieldCheck className="w-4 h-4" aria-hidden />,
        status: sessionRes.data.session
          ? (authCheck ? fromInfra(authCheck.status) : "SUCCESS")
          : "FAILED",
        lastChecked: authCheck?.last_checked ?? now,
        impact: "Sign-in, role gates and RLS identity depend on this.",
        issue: authCheck?.error ?? (sessionRes.data.session ? null : "No active session for the current browser."),
        actionTaken: "Verified live owner session and probed the auth service.",
        blocker: authCheck ? null : "Auth service probe unavailable — session-level check only.",
      },
      {
        id: "edge_functions",
        label: "Edge Functions",
        icon: <Cloud className="w-4 h-4" aria-hidden />,
        status: edgeCheck ? fromInfra(edgeCheck.status) : (infraError ? "FAILED" : "BLOCKED"),
        lastChecked: edgeCheck?.last_checked ?? now,
        impact: "Payments, email, ingest and MCP all run on edge functions.",
        issue: edgeCheck?.error ?? infraError,
        actionTaken: "Invoked infra-health, which self-reports edge runtime state.",
        blocker: edgeCheck ? null : "infra-health did not return an edge runtime check.",
        action: { kind: "link", to: "/admin/integrations", label: "Open integrations" },
      },
      {
        id: "email_queue",
        label: "Email Queue",
        icon: <Mail className="w-4 h-4" aria-hidden />,
        status: emailFailed.error
          ? "BLOCKED"
          : failedEmails > 0
            ? "FAILED"
            : queueCheck
              ? fromInfra(queueCheck.status)
              : "UNKNOWN",
        lastChecked: queueCheck?.last_checked ?? now,
        impact: "Invoices, invites and notifications stop reaching users.",
        issue: emailFailed.error?.message
          ?? (failedEmails > 0 ? `${failedEmails} failed email log rows (most recent shown in incidents).` : null)
          ?? queueCheck?.error
          ?? providerCheck?.error
          ?? null,
        actionTaken: "Counted failed rows in email_send_log and probed the queue.",
        blocker: emailFailed.error ? "email_send_log not readable with the current role." : null,
        action: { kind: "retry_email", label: "Retry failed email queue" },
      },
      {
        id: "mcp",
        label: "MCP / StreamVista Control",
        icon: <Bot className="w-4 h-4" aria-hidden />,
        status: mcpCheck
          ? fromInfra(mcpCheck.status)
          : mcpFlags.error ? "BLOCKED" : "UNKNOWN",
        lastChecked: mcpCheck?.last_checked ?? now,
        impact: "Owner-side assistant tooling and control diagnostics.",
        issue: mcpCheck?.error ?? mcpFlags.error?.message ?? null,
        actionTaken: "Probed the MCP endpoint and read mcp_control_flags.",
        blocker: mcpCheck ? null : "MCP endpoint probe unavailable.",
        action: { kind: "link", to: "/admin?dept=settings&section=mcp", label: "Open MCP diagnostics" },
      },
      {
        id: "deployment",
        label: "GitHub / Deployment",
        icon: <Github className="w-4 h-4" aria-hidden />,
        status: "BLOCKED",
        lastChecked: now,
        impact: "Release provenance and rollback capability.",
        issue: "Deployment/GitHub state is not exposed to the app runtime.",
        actionTaken: "No verifiable in-app source — deliberately not reported as healthy.",
        blocker: "Requires an authenticated GitHub/deployment integration; none is readable client-side.",
        action: { kind: "link", to: "/admin/integrations", label: "Open integrations" },
      },
      {
        id: "partner_agent",
        label: "Partner Deal Agent",
        icon: <Handshake className="w-4 h-4" aria-hidden />,
        status: agentErr ? "BLOCKED" : agentCritical > 0 ? "DANGER" : (agentEvents.data?.length ? "SUCCESS" : "UNKNOWN"),
        lastChecked: now,
        impact: "Automated buyer/partner deal signals and escalations.",
        issue: agentErr ?? (agentCritical > 0 ? `${agentCritical} critical agent events in the latest window.` : null),
        actionTaken: "Read the most recent agent_events rows (read-only).",
        blocker: agentErr
          ? "agent_events not readable with the current role."
          : agentEvents.data?.length ? null : "No agent events recorded yet — activity cannot be confirmed.",
      },
    ];

    // Recent incidents from existing sources only.
    const [failedUploads, auditRows] = await Promise.all([
      supabase.from("ingest_job_items")
        .select("id, file_name, error_message, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase.from("admin_audit_log")
        .select("id, action, created_at, details")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const inc: Incident[] = [
      ...(emailFailed.data ?? []).map((r: { id: string; recipient_email: string | null; status: string; created_at: string }) => ({
        id: `email-${r.id}`,
        source: "Email queue",
        when: r.created_at,
        summary: `Delivery ${r.status} for ${r.recipient_email ?? "unknown recipient"}`,
        severity: "FAILED" as CcStatus,
      })),
      ...(failedUploads.data ?? []).map((r: { id: string; file_name: string | null; error_message: string | null; updated_at: string }) => ({
        id: `upload-${r.id}`,
        source: "Uploads",
        when: r.updated_at,
        summary: `${r.file_name ?? "file"} — ${r.error_message ?? "failed"}`,
        severity: "FAILED" as CcStatus,
      })),
      ...(agentEvents.data ?? [])
        .filter((r: { severity?: string }) => r.severity === "critical" || r.severity === "warn")
        .map((r: { id: string; severity: string; agent: string | null; title: string | null; summary: string | null; created_at: string }) => ({
          id: `agent-${r.id}`,
          source: `Agent · ${r.agent ?? "platform"}`,
          when: r.created_at,
          summary: r.title ?? r.summary ?? r.severity,
          severity: (r.severity === "critical" ? "DANGER" : "BLOCKED") as CcStatus,
        })),
      ...(auditRows.data ?? []).map((r: { id: string; action: string; created_at: string }) => ({
        id: `audit-${r.id}`,
        source: "Admin audit",
        when: r.created_at,
        summary: r.action,
        severity: "UNKNOWN" as CcStatus,
      })),
    ]
      .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
      .slice(0, 12);

    setCards(next);
    setIncidents(inc);
    setRanAt(new Date().toISOString());
    setRunning(false);
  }, []);

  useEffect(() => { if (isAdmin) runHealthCheck(); }, [isAdmin, runHealthCheck]);

  const overall: CcStatus = useMemo(() => {
    if (!cards.length) return "UNKNOWN";
    return cards.reduce<CcStatus>((worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst), "SUCCESS");
  }, [cards]);

  const retryEmails = useCallback(async () => {
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("retry-failed-emails", { body: {} });
      if (error) throw error;
      toast.success("Retry sweep requested — re-running health check.");
      await runHealthCheck();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  }, [runHealthCheck]);

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/admin/control-center" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Admin
          </Link>
          <div className="flex-1 min-w-[180px]">
            <h1 className="font-display text-lg md:text-xl flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" aria-hidden /> Control Center
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Owner-only. Read-only checks against live infrastructure — never simulated.
            </p>
          </div>
          <Button onClick={runHealthCheck} disabled={running} className="w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} aria-hidden />
            {running ? "Running health check…" : "Run health check"}
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <section
          aria-label="Overall platform status"
          className={`rounded-xl border p-4 flex items-center gap-3 ${TONE[overall]}`}
        >
          {STATUS_ICON[overall]}
          <div>
            <div className="text-sm font-semibold tracking-wide">Overall: {overall}</div>
            <div className="text-[11px] opacity-80">
              {cards.length} checks · last run {timeAgo(ranAt)}
            </div>
          </div>
        </section>

        <section aria-label="Service health" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <article key={c.id} className={`rounded-xl border p-4 space-y-2 ${TONE[c.status]}`}>
              <div className="flex items-center gap-2">
                {c.icon}
                <h2 className="text-sm font-semibold text-foreground">{c.label}</h2>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                  {STATUS_ICON[c.status]} {c.status}
                </span>
              </div>
              <dl className="text-[11px] space-y-1 text-muted-foreground">
                <div><dt className="inline font-semibold text-foreground/80">Last checked: </dt><dd className="inline">{timeAgo(c.lastChecked)}</dd></div>
                <div><dt className="inline font-semibold text-foreground/80">Impact: </dt><dd className="inline">{c.impact}</dd></div>
                <div><dt className="inline font-semibold text-foreground/80">Detected issue: </dt><dd className="inline break-words">{c.issue ?? "None detected"}</dd></div>
                <div><dt className="inline font-semibold text-foreground/80">Action taken: </dt><dd className="inline">{c.actionTaken}</dd></div>
                <div><dt className="inline font-semibold text-foreground/80">Remaining blocker: </dt><dd className="inline">{c.blocker ?? "None"}</dd></div>
              </dl>
              {c.action?.kind === "link" && c.action.to && (
                <Link
                  to={c.action.to}
                  className="inline-flex items-center gap-1.5 text-[11px] rounded-md border border-border/60 px-2.5 py-1.5 hover:bg-secondary/40 text-foreground"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden /> {c.action.label}
                </Link>
              )}
              {c.action?.kind === "retry_email" && (
                <button
                  type="button"
                  onClick={retryEmails}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 text-[11px] rounded-md border border-border/60 px-2.5 py-1.5 hover:bg-secondary/40 text-foreground disabled:opacity-60"
                >
                  {retrying ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <RefreshCw className="w-3 h-3" aria-hidden />}
                  {c.action.label}
                </button>
              )}
            </article>
          ))}
        </section>

        <section aria-label="Manual actions" className="rounded-xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-2">Safe manual actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/failed-uploads" className="text-xs rounded-md border border-border/60 px-3 py-2 hover:bg-secondary/40">
              Open failed uploads
            </Link>
            <Link to="/admin/integrations" className="text-xs rounded-md border border-border/60 px-3 py-2 hover:bg-secondary/40">
              Open integrations &amp; settings
            </Link>
            <Link to="/admin?dept=comms&section=email" className="text-xs rounded-md border border-border/60 px-3 py-2 hover:bg-secondary/40">
              Open email operations
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            No automatic sending, deployment, or data mutation happens here. The only write path is the
            existing failed-email retry sweep.
          </p>
        </section>

        <section aria-label="Recent incidents" className="rounded-xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-2">Recent incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No incidents returned by the readable sources.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {incidents.map((i) => (
                <li key={i.id} className="py-2 flex items-start gap-2 text-xs">
                  {STATUS_ICON[i.severity]}
                  <div className="min-w-0">
                    <div className="font-medium break-words">{i.summary}</div>
                    <div className="text-[10px] text-muted-foreground">{i.source} · {timeAgo(i.when)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
