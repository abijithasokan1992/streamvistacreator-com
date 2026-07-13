import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Sparkles, Send, Loader2, ArrowRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/hooks/useLocale";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Ask StreamVista — global AI assistant.
 *
 * - Persistent launcher on every authenticated route.
 * - Desktop: right-side expandable panel. Mobile: full-screen drawer.
 * - Conversation state lives above the router, so switching dashboard
 *   sections preserves context. "New conversation" clears it.
 * - Locale-aware (en / ml / Manglish handled server-side by prompt).
 * - Read-only: talks only to the existing `assistant-chat` Edge Function,
 *   which runs every tool query with the caller's bearer token so RLS
 *   enforces scope. No service-role, no writes.
 */

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS_EN = [
  "Explain this page.",
  "How do I upload my film?",
  "Why did my upload fail?",
  "How much storage is remaining?",
  "Explain my available rights.",
  "What is my title status?",
  "What should I do next?",
];

const SUGGESTIONS_ML = [
  "ഈ പേജിൽ ഞാൻ എന്ത് ചെയ്യണം?",
  "എന്റെ സിനിമ എങ്ങനെ അപ്‌ലോഡ് ചെയ്യാം?",
  "എന്റെ അപ്‌ലോഡ് എന്തുകൊണ്ട് പരാജയപ്പെട്ടു?",
  "എത്ര സ്റ്റോറേജ് ബാക്കിയുണ്ട്?",
  "ഡിജിറ്റൽ അവകാശം എന്താണ്?",
  "എന്റെ സിനിമയുടെ നിലവിലെ സ്റ്റാറ്റസ് എന്താണ്?",
  "അടുത്തതായി ഞാൻ എന്ത് ചെയ്യണം?",
];

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap">
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
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isMl = locale === "ml";
  const askLabel = isMl ? "സ്ട്രീംവിസ്റ്റയോട് ചോദിക്കൂ" : "Ask StreamVista";
  const placeholder = isMl ? "ചോദിക്കൂ…" : "Ask anything…";
  const newLabel = isMl ? "പുതിയ സംഭാഷണം" : "New conversation";
  const suggestedLabel = isMl ? "നിർദ്ദേശങ്ങൾ" : "Suggested";
  const thinking = isMl ? "ചിന്തിക്കുന്നു…" : "Thinking…";
  const suggestions = isMl ? SUGGESTIONS_ML : SUGGESTIONS_EN;

  useEffect(() => {
    if ((pathname.startsWith("/auth") || pathname.startsWith("/admin")) && open) setOpen(false);
  }, [pathname, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

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

  const pageContext = useMemo(() => {
    const section = params.get("section") ?? undefined;
    const activeProductionId =
      typeof window !== "undefined"
        ? localStorage.getItem("sv.activeProjectId") ?? undefined
        : undefined;
    return { path: pathname, section, activeProductionId, locale };
  }, [pathname, params, locale]);

  if (!user) return null;
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) return null;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: pageContext,
        },
      });
      if (error) {
        let friendly = error.message ?? (isMl ? "സഹായി ഇപ്പോൾ ലഭ്യമല്ല." : "Assistant is unavailable right now.");
        try {
          const ctx: any = (error as any).context;
          const body = typeof ctx?.text === "function" ? await ctx.text() : ctx?.body;
          if (body) {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            if (parsed?.error?.message) friendly = parsed.error.message;
          }
        } catch { /* keep default */ }
        setTurns([...next, { role: "assistant", content: `⚠️ ${friendly}` }]);
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
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <>
      {/* Persistent launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={askLabel}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-gradient-primary text-primary-foreground shadow-lg glow-primary hover:scale-[1.02] transition"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-semibold tracking-tight">{askLabel}</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 h-5 rounded bg-black/25 text-[10px] font-mono">⌘K</kbd>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cn(
            "p-0 gap-0 flex flex-col",
            "w-full sm:max-w-[440px] md:max-w-[480px]",
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">{askLabel}</div>
              <div className="text-[10px] text-muted-foreground">
                {isMl
                  ? "വായന-മാത്രം സഹായി · നിങ്ങളുടെ വർക്ക്‌സ്‌പേസിന് മാത്രം"
                  : "Read-only · scoped to your workspace"}
              </div>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            >
              <Plus className="w-3 h-3" /> {newLabel}
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {turns.length === 0 && !loading && (
              <div className="space-y-4">
                <div className="text-sm text-foreground/90 leading-relaxed">
                  {isMl
                    ? "സ്വാഗതം! ഈ പേജിനെ കുറിച്ചോ, നിങ്ങളുടെ സിനിമ, അപ്‌ലോഡ്, സ്റ്റോറേജ്, അവകാശം, ബില്ലിംഗ് അല്ലെങ്കിൽ അടുത്ത നടപടിയെക്കുറിച്ചോ ചോദിക്കാം."
                    : "Hi — ask about this page, your titles, uploads, storage, rights, billing, notifications, or the next action to take."}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    {suggestedLabel}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-xs px-2.5 py-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground/85 hover:text-foreground flex items-center justify-between group"
                      >
                        <span className="truncate">{s}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={cn("text-sm", t.role === "user" ? "flex justify-end" : "")}>
                {t.role === "user" ? (
                  <div className="max-w-[85%] rounded-xl px-3 py-2 bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                    {t.content}
                  </div>
                ) : (
                  <div className="max-w-full text-foreground/90">{renderMarkdown(t.content)}</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {thinking}
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
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              disabled={loading}
              lang={isMl ? "ml" : "en"}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
