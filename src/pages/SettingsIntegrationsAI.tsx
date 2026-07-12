import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  Copy,
  ExternalLink,
  ShieldCheck,
  Server,
  BookOpen,
  ArrowLeft,
  Loader2,
  Lock,
  ChevronDown,
  LayoutDashboard,
  Film,
  Clapperboard,
  HardDrive,
  UploadCloud,
  Scale,
  Receipt,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";

const projectRef =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ??
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "");

const MCP_URL = `https://${projectRef}.supabase.co/functions/v1/mcp`;

interface ToolEntry {
  name: string;
  title?: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

type CapabilityGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  match: (name: string) => boolean;
};

// Grouping is display-only; tool authorization is enforced server-side by RLS.
const GROUPS: CapabilityGroup[] = [
  {
    key: "workspace",
    label: "Workspace Overview",
    icon: LayoutDashboard,
    blurb: "Identity, workspace status, today's activity, and team.",
    match: (n) =>
      [
        "whoami",
        "ctrl_whoami",
        "creator_my_workspace",
        "get_workspace_status",
        "get_today_activity",
        "show_todays_work",
        "show_recent_activity",
        "show_team",
      ].includes(n),
  },
  {
    key: "titles",
    label: "Titles",
    icon: Film,
    blurb: "Browse titles, review status, and search your catalog.",
    match: (n) =>
      n.includes("title") ||
      n === "list_creators" ||
      n === "search_workspace_records" ||
      n === "creator_review_notes",
  },
  {
    key: "productions",
    label: "Productions",
    icon: Clapperboard,
    blurb: "Production projects and their current stage.",
    match: (n) => n.includes("production"),
  },
  {
    key: "storage",
    label: "Storage",
    icon: HardDrive,
    blurb: "Storage usage, quotas, and file search.",
    match: (n) => n.includes("storage") || n === "search_files",
  },
  {
    key: "uploads",
    label: "Uploads",
    icon: UploadCloud,
    blurb: "Upload progress, ingest jobs, and failed transfers.",
    match: (n) => n.includes("upload") || n.includes("ingest"),
  },
  {
    key: "rights",
    label: "Rights",
    icon: Scale,
    blurb: "Rights status, distribution offers, and deliveries.",
    match: (n) =>
      n === "creator_rights_status" ||
      n === "creator_distribution_status" ||
      n === "creator_list_assets" ||
      n === "show_deliveries",
  },
  {
    key: "billing",
    label: "Billing",
    icon: Receipt,
    blurb: "Invoices, payments, and buyer accounts.",
    match: (n) =>
      n === "show_billing" || n === "list_payments" || n === "list_invoices" || n === "list_buyers",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: Bell,
    blurb: "Alerts, delivery failures, and system advisories.",
    match: (n) =>
      n === "creator_notifications" ||
      n === "list_failed_emails" ||
      n === "get_security_advisors" ||
      n === "get_edge_function_logs" ||
      n === "get_database_schema",
  },
];

function groupTools(tools: ToolEntry[]) {
  const remaining = new Set(tools.map((t) => t.name));
  const grouped = GROUPS.map((g) => {
    const items = tools.filter((t) => g.match(t.name));
    items.forEach((t) => remaining.delete(t.name));
    return { ...g, items };
  });
  const other = tools.filter((t) => remaining.has(t.name));
  return { grouped, other };
}

/**
 * AUTHENTICATED AI Assistant integration setup.
 *
 * Route: /settings/integrations/ai-assistants
 * Guard: requires a signed-in StreamVista user. Unauthenticated visitors are
 * redirected to /auth with a `next` param preserving this page.
 */
export default function SettingsIntegrationsAI() {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const [tools, setTools] = useState<ToolEntry[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch("/.lovable/mcp/manifest.json")
      .then((r) => r.json())
      .then((m) => setTools(m?.mcp?.tools ?? []))
      .catch(() => setTools([]));
  }, [session]);

  const { grouped, other } = useMemo(() => groupTools(tools), [tools]);

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("Copied"));

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="AI Assistant Integrations — Workspace Settings"
        description="Configure your StreamVista workspace's MCP integration for ChatGPT, Claude, and other AI assistants."
        path="/settings/integrations/ai-assistants"
      />
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/my-workspace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Workspace
          </Link>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
            Settings · Integrations · AI Assistants
          </span>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Model Context Protocol</p>
          <h1 className="font-display text-3xl md:text-4xl mt-2">AI Assistant integrations</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
            Connect ChatGPT, Claude, or any MCP-compatible AI client to <strong>your</strong> StreamVista
            workspace. Every request runs as {user?.email ?? "you"} and is scoped by row-level security —
            other workspaces remain invisible.
          </p>
        </div>

        {/* Connection status */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Connection status</div>
              <div className="mt-1 text-sm">
                Signed in as <span className="font-medium">{user?.email}</span>
              </div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px]">
              Ready to connect
            </span>
          </div>
        </div>

        {/* Connection endpoint card */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/60 to-card/30 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Server className="w-3.5 h-3.5" /> Connection Endpoint
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Paste this URL into ChatGPT or Claude when adding the StreamVista connector.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5">
              <code className="font-mono text-sm break-all">{MCP_URL}</code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => copy(MCP_URL)} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={MCP_URL} target="_blank" rel="noreferrer" aria-label="Open endpoint">
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* ChatGPT setup */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" /> Connect ChatGPT
          </div>
          <ol className="space-y-2 text-sm list-decimal pl-5 text-foreground/90">
            <li>
              Open{" "}
              <a className="underline" href="https://chatgpt.com/#settings/Connectors/Advanced" target="_blank" rel="noreferrer">
                ChatGPT Settings → Connectors → Advanced
              </a>{" "}
              and enable Developer mode. Review the risk notice.
            </li>
            <li>In the composer, open the “+” menu and enable Developer mode.</li>
            <li>Click <strong>Add sources</strong>, then <strong>Connect more</strong>.</li>
            <li>Name the connector "StreamVista" and paste the URL above.</li>
            <li>Sign in with your StreamVista account when prompted.</li>
          </ol>
        </div>

        {/* Claude setup */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" /> Connect Claude
          </div>
          <ol className="space-y-2 text-sm list-decimal pl-5 text-foreground/90">
            <li>
              Open{" "}
              <a className="underline" href="https://claude.ai/customize/connectors?modal=add-custom-connector" target="_blank" rel="noreferrer">
                Claude → Add custom connector
              </a>
              .
            </li>
            <li>Name the connector "StreamVista" and paste the URL above.</li>
            <li>Sign in with your StreamVista account when prompted.</li>
            <li>Enable the connector from the chat composer.</li>
          </ol>
        </div>

        {/* Permissions */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> Permissions
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground/90 list-disc pl-5">
            <li>Read-only by default — assistants cannot publish, delete, or spend on your behalf.</li>
            <li>Scoped to your workspace via row-level security. Other workspaces are invisible.</li>
            <li>Service-role credentials and secrets are never exposed to the assistant.</li>
            <li>Widening beyond read-only requires a separate workspace-admin approval.</li>
          </ul>
        </div>

        {/* Available capabilities — grouped */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" /> Available capabilities
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            What connected assistants can do inside your workspace. All capabilities are read-only.
          </p>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {grouped.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.key}
                  className="rounded-xl border border-border/40 bg-background/40 p-4 flex items-start gap-3"
                >
                  <div className="rounded-lg bg-secondary/40 p-2 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {g.label}
                      <span className="text-[10px] text-muted-foreground">
                        {g.items.length} {g.items.length === 1 ? "capability" : "capabilities"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <details className="group mt-5 rounded-xl border border-border/40 bg-background/30 [&[open]>summary_svg]:rotate-180">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none px-4 py-3">
              <span className="text-sm">View all capabilities</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-4">
              {grouped
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.key}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      {g.label}
                    </div>
                    <div className="grid gap-1.5">
                      {g.items.map((t) => (
                        <div key={t.name} className="rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono text-[12px]">{t.name}</code>
                            {t.title && <span className="text-xs text-muted-foreground">· {t.title}</span>}
                            {t.annotations?.readOnlyHint && (
                              <span className="text-[10px] rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5">
                                read-only
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {other.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Other</div>
                  <div className="grid gap-1.5">
                    {other.map((t) => (
                      <div key={t.name} className="rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                        <code className="font-mono text-[12px]">{t.name}</code>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tools.length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">Loading tool manifest…</div>
              )}
            </div>
          </details>
        </div>

        {/* Revoke */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            Revoke access
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            To disconnect an assistant, remove the StreamVista connector from that assistant's settings
            (ChatGPT → Connectors, or Claude → Connectors). Your OAuth tokens are invalidated immediately.
            For per-session audit information, contact{" "}
            <Link to="/contact" className="underline hover:text-foreground">StreamVista support</Link>.
          </p>
        </div>

        {/* Advanced technical details */}
        <details className="group rounded-2xl border border-border/60 bg-card/40 [&[open]>summary_svg]:rotate-180">
          <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none px-6 py-4">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Advanced technical details
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
          </summary>
          <div className="px-6 pb-6 space-y-3">
            <p className="text-xs text-muted-foreground">
              Transport and authentication standards used by the MCP endpoint.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-0.5">
                OAuth 2.1
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-0.5">
                PKCE S256
              </span>
              <span className="rounded-full border border-border/50 text-muted-foreground px-2 py-0.5">
                Dynamic Client Registration
              </span>
              <span className="rounded-full border border-border/50 text-muted-foreground px-2 py-0.5">
                Streamable HTTP
              </span>
            </ul>
          </div>
        </details>

        <div className="text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/my-workspace">Back to workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
