import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { runAgent } from "@/lib/agent-platform/client";

export type AgentSurface = "home" | "creator" | "studio" | "buyer" | "chief";

type Msg = { role: "user" | "assistant"; content: string };

const GREETINGS: Record<AgentSurface, { name: string; tagline: string; opener: string; agentId: string }> = {
  home: { name: "Vista", tagline: "Concierge · StreamVista", opener: "Welcome to StreamVista. Tell me what you need.", agentId: "vista-concierge-agent" },
  creator: { name: "Aria", tagline: "Creator workspace AI", opener: "Need help with title intake, rights, storage, or review links?", agentId: "creator-success-agent" },
  studio: { name: "Orion", tagline: "Studio operations AI", opener: "Ingest, mastering, QC, and delivery support.", agentId: "studio-operations-agent" },
  buyer: { name: "Atlas", tagline: "Licensing AI", opener: "Tell me the title, territory, term, and rights window you need.", agentId: "buyer-success-agent" },
  chief: { name: "Sovereign", tagline: "Founder operations AI", opener: "Founder briefing and decision support.", agentId: "executive-briefing-agent" },
};

export function AgentChat({ surface, className }: { surface: AgentSurface; className?: string }) {
  const profile = GREETINGS[surface];
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: profile.opener }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const result = await runAgent<{ content?: string }>({
        agentId: profile.agentId,
        input: { surface, messages: next },
        context: { pathname: window.location.pathname },
      });

      if (result.status === "failed") {
        throw new Error(result.error?.message ?? "Agent Platform request failed.");
      }

      const content = result.output?.content ??
        (result.status === "approval_required"
          ? "This action is waiting for human approval."
          : "No response returned.");
      setMessages([...next, { role: "assistant", content }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setMessages([...next, { role: "assistant", content: `⚠️ ${message}` }]);
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
            <div className="text-sm font-black tracking-tight">{profile.name}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{profile.tagline}</div>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={cn("max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-muted text-foreground")}>{message.content}</div>
          ))}
          {loading && <div className="mr-auto bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> working…</div>}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border bg-background flex gap-2">
        <Input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && (event.preventDefault(), send())} placeholder={`Ask ${profile.name}…`} disabled={loading} />
        <Button onClick={send} disabled={loading || !input.trim()} size="icon"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
