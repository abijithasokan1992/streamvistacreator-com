import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, ShieldCheck, Server, BookOpen, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

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

export default function Connectors() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [serverMeta, setServerMeta] = useState<{ name?: string; version?: string; title?: string }>({});

  useEffect(() => {
    fetch("/.lovable/mcp/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        setTools(m?.mcp?.tools ?? []);
        setServerMeta(m?.mcp?.server ?? {});
      })
      .catch(() => setTools([]));
  }, []);

  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("Copied"));

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo
        title="StreamVista Connectors — MCP Endpoint & Tools"
        description="Connect StreamVista to any MCP-compatible AI client using OAuth 2.1. Full list of advertised tools and integration steps."
      />
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> StreamVista
          </Link>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">Developer · Connectors</span>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Model Context Protocol</p>
          <h1 className="font-display text-3xl md:text-4xl mt-2">Connect your AI client to StreamVista</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
            StreamVista exposes a secure MCP server so signed-in users can grant AI clients access to their own workspace data.
            Any MCP-compatible client that supports OAuth 2.1 with dynamic client registration can connect — Claude Desktop, Cursor, Codex, MCP Inspector, and others.
          </p>
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

        {/* How to connect */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" /> How to connect
          </div>
          <ol className="space-y-3 text-sm text-foreground/90 list-decimal pl-5">
            <li>Open your MCP client's connector settings and choose "Add MCP server" (or equivalent).</li>
            <li>Paste the MCP server URL above. Any transport option can be left as default — the server negotiates automatically.</li>
            <li>The client will register itself and open a StreamVista consent page in your browser.</li>
            <li>Sign in to your StreamVista account and approve access. Only tools your role is allowed to use will return data.</li>
            <li>Return to your client. Advertised tools appear automatically and are scoped to your workspace via RLS.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Every request is verified against Supabase-issued ES256 JWTs. Tokens are never shared between users, and revoking access from the consent page invalidates the client's tokens immediately.
          </p>
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
                {t.description && (
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                )}
              </div>
            ))}
            {tools.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">Loading tool manifest…</div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Need help? Contact <Link to="/contact" className="underline hover:text-foreground">StreamVista support</Link>.
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Return to StreamVista</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
