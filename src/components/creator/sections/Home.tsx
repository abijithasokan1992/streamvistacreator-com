import { useEffect, useState } from "react";
import {
  Plus, ArrowRight, Film, Crown, Play, Sparkles, HardDrive,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listTitles, fetchFreeTierStatus,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import WorkspaceWelcome from "@/components/creator/WorkspaceWelcome";
import LegacyRecoveryBanner from "@/components/creator/LegacyRecoveryBanner";
import StorageLive from "@/components/creator/StorageLive";
import type { SectionId } from "@/components/creator/CreatorSidebar";

const DRAFT_STATES  = new Set(["draft", "incomplete", "changes_requested"]);
const REVIEW_STATES = new Set(["submitted", "in_review", "qc_review", "legal_review", "hold"]);

/**
 * Creator Home — creator-first, business-language dashboard.
 *
 * Only four sections, each answering one question:
 *   1. Continue Working      — pick up where you left off
 *   2. Today's Next Step     — one clear next action
 *   3. Recent Titles         — your work by simple business status
 *   4. Quick Workspace Overview — plan + storage at a glance
 *
 * Activity, Messages, Business and Storage have dedicated pages in the sidebar.
 * Nothing here duplicates them.
 */
export default function HomeSection({
  onNavigate, isFree,
}: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [t, fs] = await Promise.all([
          listTitles(user.id),
          fetchFreeTierStatus().catch(() => null),
        ]);
        setTitles(t);
        setTier(fs);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const recent = titles[0];
  const capped = isFree && tier && !tier.can_create_draft && tier.lifecycle_count >= 1;
  const nextAction = deriveNextAction(titles);

  return (
    <div className="space-y-8">
      <LegacyRecoveryBanner onNavigate={onNavigate} />
      <WorkspaceWelcome />

      {/* 1 · Continue Working */}
      <Section title="Continue Working" hint="Pick up where you left off.">
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-5 h-[92px] animate-pulse" />
        ) : recent ? (
          <button
            onClick={() => onNavigate("titles")}
            className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
          >
            <Play className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">{recent.title || "Untitled"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {friendlyStatus(recent.status)} · Continue editing
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ) : capped ? (
          <UpgradeCta onClick={() => onNavigate("billing")} />
        ) : (
          <button
            onClick={() => onNavigate("titles")}
            className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
          >
            <Plus className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base">Start a new title</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add details, upload files, and submit when ready.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}
      </Section>

      {/* 2 · Today's Next Step */}
      <Section title="Today's Next Step" hint="One clear action to move forward.">
        <button
          onClick={() => onNavigate(nextAction.section)}
          className="w-full rounded-xl border border-border/50 bg-secondary/10 hover:bg-secondary/20 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base">{nextAction.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{nextAction.hint}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </Section>

      {/* 3 · Recent Titles */}
      <Section title="Recent Titles" hint="Your latest work and its status.">
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 h-[120px] animate-pulse" />
        ) : titles.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-sm text-muted-foreground">
            You haven't added any titles yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 bg-secondary/5">
            <ul className="divide-y divide-border/40">
              {titles.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onNavigate("titles")}
                    className="w-full p-3.5 flex items-center gap-3 hover:bg-secondary/20 text-left min-w-0"
                  >
                    <Film className="w-4 h-4 text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{friendlyStatus(t.status)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => onNavigate("titles")}
              className="w-full text-xs text-accent hover:underline py-2.5 border-t border-border/40"
            >
              View all titles →
            </button>
          </div>
        )}
      </Section>

      {/* 4 · Quick Workspace Overview */}
      <Section title="Quick Workspace Overview" hint="Your plan and storage at a glance.">
        <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {isFree ? "Free plan" : "Active plan"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFree
                  ? "1 title included. Upgrade for more submissions and storage."
                  : "Manage your plan and storage below."}
              </p>
            </div>
            <button
              onClick={() => onNavigate("billing")}
              className="text-xs text-accent hover:underline shrink-0"
            >
              Manage →
            </button>
          </div>
          <StorageLive />
        </div>
      </Section>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function Section({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg md:text-xl">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function UpgradeCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
    >
      <Crown className="w-5 h-5 text-amber-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm sm:text-base">Upgrade to add more titles</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Free plan includes 1 title. Upgrade for more storage and multiple submissions.
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

type NextAction = { label: string; hint: string; section: SectionId };

function deriveNextAction(titles: TitleRow[]): NextAction {
  if (titles.length === 0) {
    return { label: "Create your first title", hint: "Start a draft to begin.", section: "titles" };
  }
  const changes = titles.find((t) => t.status === "changes_requested");
  if (changes) return { label: `Respond to review — ${changes.title || "Untitled"}`, hint: "The reviewer requested changes.", section: "titles" };

  const draft = titles.find((t) => DRAFT_STATES.has(t.status));
  if (draft) {
    const m = draft.metadata || ({} as any);
    const missingDetails = !m.synopsis || !m.language || !m.genre;
    if (missingDetails) return { label: `Complete details — ${draft.title || "Untitled"}`, hint: "Add synopsis, language and genre.", section: "titles" };
    return { label: `Upload files — ${draft.title || "Untitled"}`, hint: "Add your poster, trailer and master file.", section: "titles" };
  }

  const review = titles.find((t) => REVIEW_STATES.has(t.status));
  if (review) return { label: "Track your submission", hint: `${review.title || "Untitled"} is under review.`, section: "activity" };

  return { label: "Start a new title", hint: "Ready for your next project?", section: "titles" };
}

function friendlyStatus(s: string): string {
  switch (s) {
    case "draft":
    case "incomplete": return "Draft";
    case "submitted": return "Submitted";
    case "in_review":
    case "qc_review":
    case "legal_review": return "Under Review";
    case "hold": return "Under Review";
    case "changes_requested": return "Changes Requested";
    case "approved":
    case "ready_for_distribution": return "Approved";
    case "rejected": return "Not Accepted";
    case "published": return "Published";
    case "archived": return "Archived";
    default: return s;
  }
}
