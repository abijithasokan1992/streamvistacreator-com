import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  BriefcaseBusiness,
  Film,
  Home,
  Loader2,
  LogIn,
  MessageSquarePlus,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  content: string;
};

const STARTERS = [
  "I have a film and want to license it globally.",
  "I am a buyer looking for films and series.",
  "What rights documents should I prepare?",
  "How does StreamVista work from submission to deal?",
];

const ERROR_FALLBACK =
  "StreamVista AI is temporarily unavailable. You can still submit creator content, request buyer access, or sign in using the shortcuts below.";

function isMalayalam(text: string) {
  return /[\u0D00-\u0D7F]/.test(text);
}

function cleanTurns(turns: Turn[]) {
  return turns.slice(-10).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 4000),
  }));
}

export function PublicAiHome() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasConversation = turns.length > 0;
  const language = useMemo(() => {
    if (isMalayalam(input) || turns.some((turn) => isMalayalam(turn.content))) return "ml";
    if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ml")) return "ml";
    return "en";
  }, [input, turns]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, loading]);

  const reset = () => {
    setTurns([]);
    setInput("");
    setLoading(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;

    const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("public-assistant", {
        body: {
          messages: cleanTurns(nextTurns),
          locale: language,
          page: "public-home",
        },
      });

      if (error) throw error;
      const content = typeof data?.content === "string" ? data.content.trim() : "";
      if (!content) throw new Error("empty_response");

      setTurns([...nextTurns, { role: "assistant", content }]);
    } catch {
      setTurns([...nextTurns, { role: "assistant", content: ERROR_FALLBACK }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <div className="min-h-dvh bg-[#f7f6f2] text-[#171717]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center border-r border-black/10 bg-[#efeee9] py-4 md:flex">
        <Link
          to="/"
          aria-label="StreamVista home"
          className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-black text-white"
        >
          S
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-2" aria-label="StreamVista quick navigation">
          <Link to="/" aria-label="Home" className="rounded-xl p-2.5 text-black/60 transition hover:bg-black/5 hover:text-black">
            <Home className="h-5 w-5" />
          </Link>
          <a
            href="https://www.crayonsloop.com/login"
            aria-label="Submit content"
            className="rounded-xl p-2.5 text-black/60 transition hover:bg-black/5 hover:text-black"
          >
            <Film className="h-5 w-5" />
          </a>
          <Link
            to="/contact?topic=buyer-access"
            aria-label="Buyer access"
            className="rounded-xl p-2.5 text-black/60 transition hover:bg-black/5 hover:text-black"
          >
            <BriefcaseBusiness className="h-5 w-5" />
          </Link>
          <Link
            to="/auth"
            aria-label="Sign in"
            className="rounded-xl p-2.5 text-black/60 transition hover:bg-black/5 hover:text-black"
          >
            <LogIn className="h-5 w-5" />
          </Link>
        </nav>

        <div className="mb-2 rounded-full border border-black/10 p-2 text-black/50" title="Public AI · no account data access">
          <ShieldCheck className="h-4 w-4" />
        </div>
      </aside>

      <div className="md:pl-16">
        <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-black/5 bg-[#f7f6f2]/90 px-4 backdrop-blur md:left-16 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black text-xs font-black text-white md:hidden">S</div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition hover:bg-black/5"
            >
              StreamVista AI
              <span className="text-black/35">/</span>
              <span className="font-normal text-black/55">New conversation</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-black/65 hover:bg-black/5 sm:inline-flex">
              Sign in
            </Link>
            <a
              href="https://www.crayonsloop.com/login"
              className="inline-flex items-center rounded-lg bg-black px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              Submit content
            </a>
          </div>
        </header>

        <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col pt-14">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-7 md:px-10">
            {!hasConversation ? (
              <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center py-14">
                <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-black/45">Film rights · licensing · distribution</p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  Ask StreamVista what to do next.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-black/55 sm:text-lg">
                  An AI media consultant for creators, rights holders and buyers. Ask about content submission, rights readiness, buyer access, licensing workflow or delivery preparation.
                </p>

                <div className="mt-9 grid gap-2 sm:grid-cols-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => void send(starter)}
                      className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3.5 text-left text-sm leading-6 text-black/70 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white hover:text-black"
                    >
                      {starter}
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-2 text-xs text-black/50">
                  <span className="rounded-full border border-black/10 px-3 py-1.5">No account required</span>
                  <span className="rounded-full border border-black/10 px-3 py-1.5">English + Malayalam</span>
                  <span className="rounded-full border border-black/10 px-3 py-1.5">No private dashboard access</span>
                </div>
              </section>
            ) : (
              <section className="mx-auto w-full max-w-3xl py-7" aria-label="Conversation">
                <div className="space-y-7">
                  {turns.map((turn, index) => (
                    <div key={`${turn.role}-${index}`} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                      {turn.role === "user" ? (
                        <div className="max-w-[86%] rounded-[18px] bg-[#e7e5df] px-4 py-3 text-sm leading-6 text-black/80 sm:max-w-[78%]">
                          {turn.content}
                        </div>
                      ) : (
                        <div className="flex max-w-[92%] gap-3 sm:max-w-[86%]">
                          <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="pt-1 text-[15px] leading-7 text-black/80 whitespace-pre-wrap" aria-live="polite">
                            {turn.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-center gap-3 text-sm text-black/45" role="status" aria-live="polite">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </div>
                      StreamVista is thinking…
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 md:left-16 sm:px-5 sm:pb-5">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={onSubmit}
              className="rounded-[22px] border border-black/15 bg-[#fbfaf7] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.10)]"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Ask about your film, rights, licensing, buyers or distribution…"
                className="max-h-36 min-h-[58px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-black/35"
                aria-label="Message StreamVista AI"
                disabled={loading}
              />
              <div className="flex items-center justify-between px-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled
                    aria-label="Attachments coming soon"
                    title="Attachments coming soon"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-black/35"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <span className="hidden text-[11px] text-black/35 sm:inline">Public consultant · no private account data</span>
                </div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-center gap-2 text-center text-[10px] text-black/35">
              <span>AI can make mistakes. Licensing and commercial terms require review.</span>
              {hasConversation && <ArrowDown className="h-3 w-3" aria-hidden />}
            </div>

            <div className="mt-2 flex items-center justify-center gap-3 md:hidden">
              <a href="https://www.crayonsloop.com/login" className="text-xs font-medium text-black/55">Submit</a>
              <span className="text-black/20">·</span>
              <Link to="/contact?topic=buyer-access" className="text-xs font-medium text-black/55">Buyer access</Link>
              <span className="text-black/20">·</span>
              <Link to="/auth" className="text-xs font-medium text-black/55">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
