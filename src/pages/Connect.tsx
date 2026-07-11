import { useState } from "react";
import { Copy, Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Seo } from "@/components/Seo";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
const MCP_URL = `https://${projectRef}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-dvh bg-background">
      <Seo
        title="Connect StreamVista to ChatGPT & Claude — MCP Integration"
        description="Link StreamVista to your AI assistant via MCP. Let ChatGPT or Claude securely read your titles, projects, and ingest jobs on your behalf — no new account needed."
        path="/connect"
      />
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <LinkIcon className="w-3.5 h-3.5" /> Agent integrations
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Connect StreamVista to your AI assistant
          </h1>
          <p className="text-muted-foreground">
            Let ChatGPT or Claude read your titles, projects, and ingest jobs on your behalf.
            You'll sign in with your StreamVista account when you connect — nothing changes for other users.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your MCP server URL</CardTitle>
            <CardDescription>Paste this into your AI assistant's connector setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="flex-1 text-sm font-mono break-all">{MCP_URL}</code>
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect ChatGPT</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              <li>
                Open{" "}
                <a
                  className="underline"
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noreferrer"
                >
                  ChatGPT Settings → Connectors → Advanced
                </a>{" "}
                and turn on Developer mode. Read the risk notice shown there.
              </li>
              <li>In the chat composer, open the “+” menu and enable Developer mode.</li>
              <li>Click <strong>Add sources</strong>, then <strong>Connect more</strong>.</li>
              <li>Give the connector a name (e.g. “StreamVista”) and paste the URL above.</li>
              <li>Sign in with your StreamVista account when prompted, then ask ChatGPT to use it.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect Claude</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              <li>
                Open{" "}
                <a
                  className="underline"
                  href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                  target="_blank"
                  rel="noreferrer"
                >
                  Claude → Add custom connector
                </a>
                .
              </li>
              <li>Give the connector a name (e.g. “StreamVista”) and paste the URL above.</li>
              <li>Sign in with your StreamVista account when prompted.</li>
              <li>Enable the connector from the chat composer, then ask Claude to use it.</li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Your assistant will discover what it can do automatically. It can look up your titles,
          fetch title details, and check the status of your studio ingest jobs.
        </p>
      </div>
    </main>
  );
}
