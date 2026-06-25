import { useEffect, useLayoutEffect, useState } from "react";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * First-time guided tour over the Creator sidebar.
 * Reads sidebar buttons via `[data-tour="<sectionId>"]` and floats a
 * tooltip next to each one. Persisted with localStorage.
 */

const TOUR_KEY = "sv_creator_tour_v1";

type Step = { id: string; title: string; body: string };

const STEPS: Step[] = [
  { id: "titles",         title: "Titles",       body: "Add a new title here. Drafts, posters, trailers — all in one place." },
  { id: "submissions",    title: "Review Queue", body: "Track which titles are submitted and where they are in review." },
  { id: "updates",        title: "Inbox",        body: "Messages and review notes from our team land here." },
  { id: "delivery_vault", title: "Vault",        body: "Secure storage for your master files and final deliveries." },
  { id: "billing",        title: "Billing",      body: "Your plan, storage usage and invoices." },
  { id: "help",           title: "Help",         body: "Find guides or contact us when you're stuck." },
];

export function hasSeenCreatorTour(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; }
}

export function markCreatorTourSeen() {
  try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* noop */ }
}

export default function CreatorTour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.id}"]`) as HTMLElement | null;
      setRect(el?.getBoundingClientRect() ?? null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const t = setTimeout(measure, 60); // sidebar render settle
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearTimeout(t);
    };
  }, [step.id]);

  const finish = () => { markCreatorTourSeen(); onClose(); };

  // Tooltip position — to the right of the sidebar item on desktop, fallback to centered.
  const tooltipStyle = (() => {
    if (!rect) return { left: "50%", top: "20%", transform: "translateX(-50%)" } as const;
    const top = Math.max(16, rect.top - 4);
    const left = Math.min(window.innerWidth - 340, rect.right + 12);
    return { left, top } as const;
  })();

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Soft dim — keeps sidebar clickable visually but blocks input */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] pointer-events-auto" onClick={finish} />

      {/* Spotlight ring around current target */}
      {rect && (
        <div
          className="absolute rounded-lg ring-2 ring-accent shadow-[0_0_0_4px_hsl(var(--accent)/0.25)] transition-all"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-[300px] max-w-[92vw] rounded-xl border border-border/60 bg-background shadow-xl p-4 pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3 h-3 text-accent" />
            Quick tour · {i + 1}/{STEPS.length}
          </div>
          <button onClick={finish} aria-label="Skip tour" className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="font-semibold mt-2">{step.title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setI((v) => v - 1)} className="h-7 px-2 text-xs">
                Back
              </Button>
            )}
            {i < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setI((v) => v + 1)} className="h-7 px-2 text-xs">
                Next <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={finish} className="h-7 px-2 text-xs bg-accent text-accent-foreground">
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
