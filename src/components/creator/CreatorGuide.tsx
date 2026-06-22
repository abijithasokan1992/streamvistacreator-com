import { useState } from "react";
import { HelpCircle, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight contextual guidance — NOT an AI agent.
 * Curated, static answers covering creator workflow, metadata, storage,
 * submission and upgrade questions. Zero API/AI cost.
 */
const TOPICS: { q: string; a: string }[] = [
  {
    q: "How do I add a new title?",
    a: "Open My Titles, click Add Title, pick a content type and give it a name. Your draft auto-saves so you can return to it anytime. On Creator Basic you can keep 1 active draft and 1 submission.",
  },
  {
    q: "What metadata do I need before submitting?",
    a: "Title name, language, genre, synopsis, runtime and at least one primary asset (master or preview). Censor certificates are required for theatrical formats. The Title Editor highlights anything missing before you submit.",
  },
  {
    q: "How does the review workflow work?",
    a: "Submit → Admin review → QC review → Legal review → Approved. You'll get review notes if anything needs changes. Live status shows on the title card and in Updates.",
  },
  {
    q: "What storage is included?",
    a: "Creator Basic includes 50 GB. Larger allowances are sized to your catalog on Creator Pro / Studio. Heavy masters and archival belong in Studio Vault — request from the Upgrade tab.",
  },
  {
    q: "When do I need to upgrade?",
    a: "Upgrade when you need more than 1 active title, more storage, faster review, named workflow support, or studio-scale archival. Submit a request from the Upgrade tab and we'll follow up by email.",
  },
  {
    q: "How do I get support?",
    a: "Use the Help tab to submit a ticket with the right category. We reply by email — typically within one business day.",
  },
];

export default function CreatorGuide() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full border border-border/40 px-3 py-1.5 hover:bg-secondary/30"
        title="Ask StreamVista Guide"
      >
        <HelpCircle className="w-3.5 h-3.5" /> Guide
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-background border-l border-border/50 flex flex-col"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">StreamVista Guide</p>
                <h3 className="font-display text-lg mt-0.5">How can we help?</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-secondary/30" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Quick answers to common creator questions. For anything else, use the Help tab to file a ticket.
              </p>
              {TOPICS.map((t, i) => {
                const isOpen = expanded === i;
                return (
                  <div key={i} className="rounded-lg border border-border/40 bg-secondary/5">
                    <button
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left text-sm"
                    >
                      <span className="font-medium">{t.q}</span>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <p className="px-3.5 pb-3.5 text-xs text-muted-foreground leading-relaxed">{t.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
