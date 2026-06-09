import { useEffect, useState } from "react";
import { Upload, Link2, Send, Sparkles, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  icon: typeof Upload;
  title: string;
  body: string;
  cta: string;
  onClick?: () => void;
};

/**
 * Cinematic "first 60 seconds" guided card.
 * Persists dismissal per-user in localStorage. Self-contained — no backend writes.
 */
export default function FirstStepsCard({
  userId,
  variant = "creator",
  onUpload,
  onShare,
  onInvite,
  onPasteLink,
}: {
  userId: string;
  variant?: "creator" | "client";
  onUpload?: () => void;
  onShare?: () => void;
  onInvite?: () => void;
  onPasteLink?: () => void;
}) {
  const storageKey = `sv_first_steps_dismissed_${userId}_${variant}`;
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) setOpen(false);
      const d = localStorage.getItem(`${storageKey}_done`);
      if (d) setDone(JSON.parse(d));
    } catch {}
  }, [storageKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setOpen(false);
  };
  const markDone = (i: number) => {
    const next = { ...done, [i]: true };
    setDone(next);
    try { localStorage.setItem(`${storageKey}_done`, JSON.stringify(next)); } catch {}
  };

  const creatorSteps: Step[] = [
    { icon: Upload, title: "Upload your first clip", body: "Drag any video or RAW file. Encryption + virus scan are automatic.", cta: "Upload now", onClick: () => { onUpload?.(); markDone(0); } },
    { icon: Link2, title: "Generate a share link", body: "Branded, password-protected, with download limits and expiry.", cta: "Create link", onClick: () => { onShare?.(); markDone(1); } },
    { icon: Send, title: "Send to your client", body: "Email or WhatsApp the link. Watch views, downloads, and comments live.", cta: "Send invite", onClick: () => { onInvite?.(); markDone(2); } },
  ];

  const clientSteps: Step[] = [
    { icon: Link2, title: "Wait for your studio's link", body: "Your studio shares a /s/... link via WhatsApp, email, or SMS. No link is sent automatically from here.", cta: "I have a link — paste it", onClick: () => { onPasteLink?.(); markDone(0); } },
    { icon: Sparkles, title: "Review with timecode", body: "Open the link, scrub the cut, and drop frame-accurate notes. Your studio sees them live.", cta: "Got it", onClick: () => markDone(1) },
    { icon: Check, title: "Approve the cut", body: "One-click approval — your studio is notified the moment you sign off.", cta: "Understood", onClick: () => markDone(2) },
  ];

  const steps = variant === "creator" ? creatorSteps : clientSteps;
  const allDone = steps.every((_, i) => done[i]);

  if (!open) return null;

  return (
    <div className="relative glass-strong rounded-3xl p-6 md:p-7 border border-accent/30 mb-6 overflow-hidden animate-fade-in">
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {allDone && (
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-accent flex items-center gap-1">
            <Check className="w-3 h-3" /> Complete
          </span>
        )}
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
            First 60 seconds on StreamVista
          </span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-1">
          {variant === "creator" ? "Ship your first review link in 3 steps." : "Review like a pro in 3 steps."}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Knock these out and you'll see why filmmakers switch.
        </p>

        <ol className="grid md:grid-cols-3 gap-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isDone = done[i];
            return (
              <li
                key={s.title}
                className={cn(
                  "relative rounded-2xl border p-5 transition-all bg-background/40",
                  isDone ? "border-accent/60 bg-accent/5" : "border-border/60 hover:border-accent/40"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl grid place-items-center",
                    isDone ? "bg-accent text-accent-foreground" : "bg-gradient-primary text-primary-foreground"
                  )}>
                    {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Step {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="font-display font-bold text-base mb-1">{s.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{s.body}</p>
                <button
                  onClick={s.onClick}
                  disabled={isDone}
                  className={cn(
                    "w-full h-9 rounded-lg text-[11px] uppercase tracking-[0.2em] font-semibold transition-all",
                    isDone
                      ? "bg-accent/10 text-accent cursor-default"
                      : "bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary"
                  )}
                >
                  {isDone ? "Done" : s.cta}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
