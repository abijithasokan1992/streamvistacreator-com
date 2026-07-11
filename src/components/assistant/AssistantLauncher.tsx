import { useEffect, useRef, useState } from "react";

import { Sparkles, Send, Loader2, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * StreamVista AI Assistant — global command-palette launcher.
 * Read-only orchestration of existing modules; RBAC enforced server-side by RLS
 * (the edge function calls Supabase with the caller's bearer token).
 */

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Open my active production",
  "Show today's uploads",
  "Find Camera Card A003",
  "Show proxy jobs",
  "Show failed uploads",
  "Show storage usage",
  "Show my invoices",
  "Research Netflix acquisitions team",
];

const RECENT_KEY = "sv.assistant.recent.v1";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 6) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const prev = loadRecent().filter((x) => x !== q);
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, 6)));
  } catch {
    /* ignore */
  }
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="mb-2 last:mb-0 leading-relaxed">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{p}</span>
          ),
        )}
      </p>
    );
  });
}

export function AssistantLauncher() {
  const { user } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  if (!user) return null;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setLoading(true);
    pushRecent(text);

    // Pass minimal active production context if the app stored one.
    const activeProductionId =
      typeof window !== "undefined"
        ? localStorage.getItem("sv.activeProjectId") ?? undefined
        : undefined;

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: activeProductionId ? { activeProductionId } : {},
        },
      });
      if (error) {
        // Try to surface the structured error the function returned
        // (provider_not_configured, exhausted_credits, rate_limited, etc.).
        let friendly = error.message ?? "Assistant is unavailable right now.";
        try {
          const ctx: any = (error as any).context;
          const body = typeof ctx?.text === "function" ? await ctx.text() : ctx?.body;
          if (body) {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            if (parsed?.error?.message) friendly = parsed.error.message;
          }
        } catch { /* leave the default */ }
        setTurns([
          ...next,
          { role: "assistant", content: `⚠️ ${friendly}` },
        ]);
      } else {
        setTurns([...next, { role: "assistant", content: data?.content ?? "(no response)" }]);
      }

    } catch (e: any) {
      setTurns([...next, { role: "assistant", content: `⚠️ ${e?.message ?? "Request failed"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const reset = () => {
    setTurns([]);
    setInput("");
  };

  return (
    <>
      {/* Floating global button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open StreamVista AI Assistant"
        className="fixed bottom-5 right-5 z-40 group inline-flex items-center gap-2 h-11 px-4 rounded-full bg-gradient-primary text-primary-foreground shadow-lg glow-primary hover:scale-[1.02] transition"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-semibold tracking-tight">Ask StreamVista</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 h-5 rounded bg-black/25 text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-semibold leading-tight">StreamVista AI</div>
              <div className="text-[10px] text-muted-foreground">
                Read-only assistant · orchestrates existing modules
              </div>
            </div>
            {turns.length > 0 && (
              <button
                onClick={reset}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-4">
            {turns.length === 0 && !loading && (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Suggested
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/50 text-foreground/80 hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {recent.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Recent
                    </div>
                    <div className="space-y-1">
                      {recent.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground flex items-center justify-between group"
                        >
                          <span className="truncate">{q}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                  Tip: try "show today's uploads", "find drone clips", or "research a company".
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={cn("text-sm", t.role === "user" ? "flex justify-end" : "")}>
                {t.role === "user" ? (
                  <div className="max-w-[85%] rounded-xl px-3 py-2 bg-primary text-primary-foreground text-sm">
                    {t.content}
                  </div>
                ) : (
                  <div className="max-w-full text-foreground/90">{renderMarkdown(t.content)}</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border/50 px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask StreamVista…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
