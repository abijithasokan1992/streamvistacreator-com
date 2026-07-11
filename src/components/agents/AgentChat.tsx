import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type AgentSurface = "home" | "creator" | "studio" | "buyer" | "chief";

const GREETINGS: Record<AgentSurface, { name: string; tagline: string; opener: string }> = {
  home: {
    name: "Vista",
    tagline: "Concierge · StreamVista",
    opener: "Welcome to **StreamVista Cloud X**. I'm Vista — tell me whether you're here as a **Creator**, **Studio**, or **Buyer** and I'll route you in seconds.",
  },
  creator: {
    name: "Aria",
    tagline: "Your Creator workspace AI",
    opener: "Hi — I'm **Aria**. Need help with **title intake**, **storage upgrades**, or **review links**? Ask away.",
  },
  studio: {
    name: "Orion",
    tagline: "Studio operations AI",
    opener: "**Orion** online. Ingest, mastering, QC, delivery — tell me where you're stuck.",
  },
  buyer: {
    name: "Atlas",
    tagline: "Licensing AI · NDA-gated",
    opener: "I'm **Atlas**. All conversations are NDA-gated. Tell me which **title or rights window** you're interested in.",
  },
  chief: {
    name: "Sovereign",
    tagline: "Chief AI · Founder access only",
    opener: "Reporting to **Abijith Asokan**. Ask for a briefing, drill into a surface, or request a voice report.",
  },
};

type Msg = { role: "user" | "assistant"; content: string };

function renderInline(text: string) {
  // tiny markdown: **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-black text-foreground">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function AgentChat({ surface, className }: { surface: AgentSurface; className?: string }) {
  const g = GREETINGS[surface];
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: g.opener }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // Session preflight — protected surfaces require an authenticated user.
      if (surface !== "home") {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          setMessages([
            ...next,
            {
              role: "assistant",
              content: `⚠️ Please sign in again to use **${g.name}**. Your session has expired.`,
            },
          ]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { surface, messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) {
        // Parse the structured backend error { error: { code, message } } from the edge function.
        let detail = error?.message ?? "Request failed";
        let code: string | undefined;
        try {
          const ctx: any = (error as any).context;
          const resp: Response | undefined = ctx instanceof Response ? ctx : undefined;
          let raw = "";
          if (resp) {
            raw = await resp.clone().text();
          } else if (ctx?.body) {
            raw = typeof ctx.body === "string"
              ? ctx.body
              : await new Response(ctx.body).text();
          } else if (typeof ctx?.text === "function") {
            raw = await ctx.text();
          }
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const err = parsed?.error;
              if (err && typeof err === "object") {
                code = err.code;
                detail = err.message ?? detail;
              } else if (typeof err === "string") {
                detail = err;
              } else if (parsed?.message) {
                detail = parsed.message;
              } else {
                detail = raw;
              }
            } catch {
              detail = raw;
            }
          }
        } catch {
          /* keep generic detail */
        }
        if (code === "expired_authentication") {
          detail = `Please sign in again to use ${g.name}.`;
        }
        setMessages([...next, { role: "assistant", content: `⚠️ ${detail}` }]);
        return;
      }
      setMessages([...next, { role: "assistant", content: data?.content ?? "(no response)" }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e?.message ?? "Request failed"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden", className)}>
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <div>
            <div className="text-sm font-black tracking-tight">{g.name}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{g.tagline}</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground",
              )}
            >
              {renderInline(m.content)}
            </div>
          ))}
          {loading && (
            <div className="mr-auto bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-background flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={`Ask ${g.name}…`}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
