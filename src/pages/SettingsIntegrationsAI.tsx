import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Boxes,
  CheckCircle2,
  Copy,
  ExternalLink,
  Film,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  Palette,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WandSparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";

const projectRef =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ??
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "");

const MCP_URL = projectRef ? `https://${projectRef}.supabase.co/functions/v1/mcp` : "";

type ToolEntry = { name: string; title?: string; description?: string };
type AppEntry = {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge: string;
  external?: boolean;
};

const APPS: AppEntry[] = [
  {
    name: "Creator Workspace",
    description: "Titles, rights, uploads, files, review notes and creator operations.",
    href: "/my-workspace",
    icon: Film,
    badge: "Core",
  },
  {
    name: "Admin Studio OS",
    description: "QC, legal, marketplace, deals, payments, delivery and platform control.",
    href: "/admin",
    icon: LayoutDashboard,
    badge: "Admin",
  },
  {
    name: "AI Assistants",
    description: "Connect ChatGPT, Claude and other MCP-compatible assistants.",
    href: "/settings/integrations/ai-assistants",
    icon: Bot,
    badge: "MCP",
  },
  {
    name: "Design Studio AI",
    description: "Prompt-first visual UI/UX builder with responsive preview and export.",
    href: "https://streamvista-design-studio.vercel.app",
    icon: Palette,
    badge: "Builder",
    external: true,
  },
  {
    name: "StreamVista Cloud X",
    description: "Platform operations, system modules and infrastructure workspace.",
    href: "https://streamvista.in",
    icon: Boxes,
    badge: "Platform",
    external: true,
  },
  {
    name: "Workflow Control",
    description: "Operational flows for titles, approvals, delivery and revenue actions.",
    href: "/connect",
    icon: Workflow,
    badge: "Operations",
  },
];

export default function SettingsIntegrationsAI() {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const [tools, setTools] = useState<ToolEntry[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch("/.lovable/mcp/manifest.json")
      .then((response) => response.json())
      .then((manifest) => setTools(manifest?.mcp?.tools ?? []))
      .catch(() => setTools([]));
  }, [session]);

  const toolGroups = useMemo(() => {
    const names = tools.map((tool) => tool.name);
    return [
      { label: "Workspace", count: names.filter((name) => name.includes("workspace") || name.includes("whoami")).length },
      { label: "Titles & Rights", count: names.filter((name) => name.includes("title") || name.includes("rights")).length },
      { label: "Files & Delivery", count: names.filter((name) => name.includes("file") || name.includes("upload") || name.includes("delivery")).length },
      { label: "Business", count: names.filter((name) => name.includes("billing") || name.includes("payment") || name.includes("invoice")).length },
    ];
  }, [tools]);

  if (loading) {
    return <main className="min-h-dvh grid place-items-center bg-background"><Loader2 className="w-5 h-5 animate-spin" /></main>;
  }

  const next = encodeURIComponent(location.pathname);
  const copyEndpoint = () => {
    if (!MCP_URL) return toast.error("MCP endpoint is not configured");
    navigator.clipboard.writeText(MCP_URL).then(() => toast.success("Endpoint copied"));
  };

  if (!session) {
    return (
      <main className="min-h-dvh bg-background text-foreground">
        <Seo title="StreamVista App Hub" description="Access StreamVista apps, AI assistants and workspace tools." path={location.pathname} />
        <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkles className="w-3.5 h-3.5" /> StreamVista App Hub
            </div>
            <h1 className="font-display text-4xl md:text-6xl mt-6 leading-tight">One account. Every StreamVista app.</h1>
            <p className="text-muted-foreground mt-5 text-base md:text-lg max-w-2xl">
              Create an account or sign in once to access Creator Workspace, Admin Studio OS, AI Assistants, Design Studio and operational tools.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="gap-2"><Link to={`/auth?mode=signup&next=${next}`}><UserPlus className="w-4 h-4" /> Create Account</Link></Button>
              <Button asChild size="lg" variant="outline" className="gap-2"><Link to={`/auth?mode=login&next=${next}`}><LogIn className="w-4 h-4" /> Sign In</Link></Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
            {APPS.map(({ name, description, icon: Icon, badge }) => (
              <div key={name} className="rounded-2xl border border-border/60 bg-card/40 p-5 opacity-80">
                <div className="flex items-center justify-between"><Icon className="w-5 h-5" /><span className="text-[10px] rounded-full border border-border px-2 py-1 text-muted-foreground">{badge}</span></div>
                <h2 className="font-medium mt-5">{name}</h2>
                <p className="text-sm text-muted-foreground mt-2">{description}</p>
                <div className="text-xs text-muted-foreground mt-5 flex items-center gap-1"><Lock className="w-3 h-3" /> Sign in required</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Seo title="StreamVista App Hub & AI Assistants" description="Launch StreamVista apps and connect AI assistants." path={location.pathname} />
      <header className="border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link to="/my-workspace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-3.5 h-3.5" /> Workspace</Link>
          <div className="text-right"><div className="text-xs font-medium">{user?.email}</div><div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1"><CheckCircle2 className="w-3 h-3" /> Signed in</div></div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">StreamVista Control Centre</p>
          <h1 className="font-display text-3xl md:text-5xl mt-2">Apps & AI Assistants</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">All StreamVista applications are organised here. Open any app directly without searching through separate dashboards.</p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4"><WandSparkles className="w-4 h-4 text-primary" /><h2 className="font-medium">Launch an app</h2></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {APPS.map(({ name, description, href, icon: Icon, badge, external }) => {
              const content = (
                <div className="h-full rounded-2xl border border-border/60 bg-card/40 p-5 hover:border-primary/50 hover:bg-card/70 transition-all group">
                  <div className="flex items-center justify-between"><div className="rounded-xl bg-primary/10 p-2.5"><Icon className="w-5 h-5 text-primary" /></div><span className="text-[10px] rounded-full border border-border px-2 py-1 text-muted-foreground">{badge}</span></div>
                  <h3 className="font-medium mt-5 flex items-center gap-2">{name}{external && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
                  <div className="mt-5 text-xs text-primary group-hover:translate-x-1 transition-transform">Open app →</div>
                </div>
              );
              return external ? <a key={name} href={href} target="_blank" rel="noreferrer">{content}</a> : <Link key={name} to={href}>{content}</Link>;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/60 to-card/30 p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Bot className="w-4 h-4" /> AI Assistant Connection</div><p className="text-sm text-muted-foreground mt-2">Use this endpoint in ChatGPT, Claude or another MCP-compatible assistant.</p></div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-3 py-1 text-xs">Ready</span>
          </div>
          <div className="mt-5 flex flex-col md:flex-row gap-2"><code className="flex-1 rounded-xl border border-border/50 bg-background/70 px-4 py-3 text-sm break-all">{MCP_URL || "MCP endpoint not configured"}</code><Button onClick={copyEndpoint} className="gap-2"><Copy className="w-4 h-4" /> Copy</Button>{MCP_URL && <Button asChild variant="outline"><a href={MCP_URL} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-2" /> Open</a></Button>}</div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /><h2 className="font-medium">Security</h2></div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc pl-5"><li>Workspace-scoped access through row-level security.</li><li>Read-only assistant capabilities by default.</li><li>Secrets and service credentials are never shown to assistants.</li><li>Financial, destructive and publishing actions require separate approval.</li></ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center gap-2"><Boxes className="w-4 h-4 text-primary" /><h2 className="font-medium">Available capabilities</h2></div>
            <div className="grid grid-cols-2 gap-2 mt-4">{toolGroups.map((group) => <div key={group.label} className="rounded-xl border border-border/40 bg-background/40 p-3"><div className="text-xs text-muted-foreground">{group.label}</div><div className="text-xl font-semibold mt-1">{group.count}</div></div>)}</div>
            <p className="text-xs text-muted-foreground mt-4">Total detected tools: {tools.length}</p>
          </div>
        </section>
      </section>
    </main>
  );
}
