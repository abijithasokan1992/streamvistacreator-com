import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";

/**
 * PUBLIC marketing overview for AI Assistant integrations.
 *
 * Deliberately does NOT expose:
 *  - the raw MCP endpoint URL
 *  - Developer Mode instructions
 *  - detailed ChatGPT / Claude setup steps
 *
 * The full setup experience lives behind auth at
 * /settings/integrations/ai-assistants.
 */
export default function Connect() {
  const { session } = useAuth();
  const ctaHref = session
    ? "/settings/integrations/ai-assistants"
    : "/auth?next=%2Fsettings%2Fintegrations%2Fai-assistants";

  return (
    <main className="min-h-dvh bg-background">
      <Seo
        title="AI Assistant Integrations — StreamVista"
        description="Let ChatGPT or Claude read your StreamVista workspace on your behalf. Read-only, permission-scoped, and available only after you sign in."
        path="/connect"
      />
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" /> AI Integrations
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Bring StreamVista into your AI assistant
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Connect ChatGPT, Claude, or any MCP-compatible assistant to your own StreamVista
            workspace. Your assistant can look up titles, projects and ingest jobs — always as you,
            never across workspaces.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm mt-2">Read-only by default</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Assistants can look things up. They cannot delete, publish, or spend on your behalf.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Lock className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm mt-2">Permission-scoped</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Every call runs under your account and your workspace's row-level security. Other
              workspaces stay invisible.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm mt-2">Revocable anytime</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Disconnect from your workspace settings to invalidate the assistant's access
              immediately.
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ready to connect?</CardTitle>
            <CardDescription>
              Setup steps, the connection endpoint and audit history are available inside your
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={ctaHref}>
                {session ? "Open integration settings" : "Sign in to configure"}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/contact">Talk to us</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Integrations are read-only unless explicitly widened by a workspace admin. StreamVista
          never shares service credentials or secrets with your assistant.
        </p>
      </div>
    </main>
  );
}
