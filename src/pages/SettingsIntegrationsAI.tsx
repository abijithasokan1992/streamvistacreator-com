import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Copy, ExternalLink, ShieldCheck, Server, BookOpen, ArrowLeft, Loader2, Lock } from "lucide-react";
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

/**
 * AUTHENTICATED AI Assistant integration setup.
 *
 * Route: /settings/integrations/ai-assistants
 * Guard: requires a signed-in StreamVista user. Unauthenticated visitors are
 * redirected to /auth with a `next` param preserving this page.
 *
 * The public marketing overview lives at /connect and never exposes the raw
 * MCP endpoint, developer-mode instructions, or detailed setup steps.
 */
export default function SettingsIntegrationsAI() {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [serverMeta, setServerMeta] = useState<{ name?: string; version?: string; title?: string }>({});

  useEffect(() => {
    if (!session) return;
    fetch("/.lovable/mcp/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        setTools(m?.mcp?.tools ?? []);
        setServerMeta(m?.mcp?.server ?? {});
      })
      .catch(() => setTools([]));
  }, [session]);

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

        {/* Endpoint */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Server className="w-3.5 h-3.5" /> MCP server URL
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2.5">
            <code className="font-mono text-sm break-all flex-1">{MCP_URL}</code>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => copy(MCP_URL)} aria-label="Copy URL">
              <Copy className="w-4 h-4" />
            </button>
            <a className="text-muted-foreground hover:text-foreground" href={MCP_URL} target="_blank" rel="noreferrer" aria-label="Open">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-0.5">OAuth 2.1</span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-0.5">PKCE S256</span>
            <span className="rounded-full border border-border/50 text-muted-foreground px-2 py-0.5">Dynamic client registration</span>
            <span className="rounded-full border border-border/50 text-muted-foreground px-2 py-0.5">Streamable HTTP</span>
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

        {/* Tools */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" /> Advertised tools
            </div>
            <span className="text-[11px] text-muted-foreground">
              {serverMeta.title ?? serverMeta.name ?? "streamvista-mcp"} v{serverMeta.version ?? "—"} · {tools.length} tool{tools.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {tools.map((t) => (
              <div key={t.name} className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[12px]">{t.name}</code>
                  {t.title && <span className="text-xs text-muted-foreground">· {t.title}</span>}
                  {t.annotations?.readOnlyHint && (
                    <span className="text-[10px] rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5">read-only</span>
                  )}
                  {t.annotations?.destructiveHint && (
                    <span className="text-[10px] rounded-full border border-red-500/30 bg-red-500/10 text-red-300 px-1.5 py-0.5">destructive</span>
                  )}
                </div>
                {t.description && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>}
              </div>
            ))}
            {tools.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">Loading tool manifest…</div>
            )}
          </div>
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

        <div className="text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/my-workspace">Back to workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
