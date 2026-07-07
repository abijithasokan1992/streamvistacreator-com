import { useEffect, useState } from "react";
import {
  Plus, ArrowRight, Bell, Film, Crown, Play,
  Briefcase, LifeBuoy, Sparkles, HardDrive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listTitles, fetchFreeTierStatus,
  type TitleRow, type FreeTierStatus,
} from "@/lib/creator/titleApi";
import WorkspaceWelcome from "@/components/creator/WorkspaceWelcome";
import LegacyRecoveryBanner from "@/components/creator/LegacyRecoveryBanner";
import StorageLive from "@/components/creator/StorageLive";
import type { SectionId } from "@/components/creator/CreatorSidebar";

type UpdateRow = { id: string; title: string; message: string | null; created_at: string };

const DRAFT_STATES = new Set(["draft", "incomplete", "changes_requested"]);
const REVIEW_STATES = new Set(["submitted", "in_review", "qc_review", "legal_review", "hold"]);
const APPROVED_STATES = new Set(["approved", "ready_for_distribution"]);

/**
 * Creator Home — organised around the daily workflow.
 *
 *  1. Continue Working   — primary hero, jump back into latest title
 *  2. Today's Focus      — one clear next action
 *  3. My Titles          — recent work with status counts
 *  4. Updates            — merged activity + messages timeline
 *  5. Business           — buyer interest, offers, deals, revenue
 *  6. Workspace          — plan, storage, usage in one compact card
 *  7. Help
 *
 * Storage and Messages appear in exactly one place each.
 * Reuses existing queries/components — no new backend logic.
 */
export default function HomeSection({
  onNavigate, isFree,
}: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [tier, setTier] = useState<FreeTierStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [t, n, fs] = await Promise.all([
          listTitles(user.id),
          (supabase as any).from("notifications")
            .select("id, title, message, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(8),
          fetchFreeTierStatus().catch(() => null),
        ]);
        setTitles(t);
        setUpdates((n.data ?? []) as UpdateRow[]);
        setTier(fs);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const drafts    = titles.filter((t) => DRAFT_STATES.has(t.status));
  const inReview  = titles.filter((t) => REVIEW_STATES.has(t.status));
  const approved  = titles.filter((t) => APPROVED_STATES.has(t.status));
  const published = titles.filter((t) => t.status === "published");
  const archived  = titles.filter((t) => t.status === "archived");
  const recent    = titles[0];

  const capped = isFree && tier && !tier.can_create_draft && tier.lifecycle_count >= 1;
  const nextAction = deriveNextAction(titles);
  const timeline = buildTimeline(titles, updates);

  return (
    <div className="space-y-8">
      <LegacyRecoveryBanner onNavigate={onNavigate} />

      <WorkspaceWelcome />

      {/* 1 · Continue Working — Where did I leave off? */}
      <Section title="Continue Working" hint="Pick up right where you left off.">
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

      {/* 2 · Today's Focus — What should I do next? */}
      <Section title="Today's Focus" hint="One clear step to move forward.">
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

      {/* 3 · My Titles — Where does my work stand? */}
      <Section title="My Titles" hint="Your work, by stage.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CountTile label="Drafts"    value={loading ? "…" : String(drafts.length)}    onClick={() => onNavigate("titles")} />
          <CountTile label="In Review" value={loading ? "…" : String(inReview.length)}  onClick={() => onNavigate(isFree ? "titles" : "submissions")} />
          <CountTile label="Approved"  value={loading ? "…" : String(approved.length)}  onClick={() => onNavigate("titles")} />
          <CountTile label="Published" value={loading ? "…" : String(published.length)} onClick={() => onNavigate("titles")} />
          <CountTile label="Archived"  value={loading ? "…" : String(archived.length)}  onClick={() => onNavigate("titles")} />
        </div>
      </Section>

      {/* 4 · Updates — What's new? (merged activity + messages) */}
      <Section title="Updates" hint="Progress on your titles and messages from our team.">
        <TimelineList
          items={timeline}
          loading={loading}
          onOpenAll={() => onNavigate("updates")}
        />
      </Section>

      {/* 5 · Business — Where's the commercial activity? */}
      {!isFree && (
        <Section title="Business" hint="Buyer interest, offers, deals and revenue.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LinkTile icon={Briefcase} title="Requests & Offers" hint="Interest from buyers." onClick={() => onNavigate("submissions")} />
            <LinkTile icon={Sparkles}  title="Deals & Contracts" hint="Signed and active agreements." onClick={() => onNavigate("submissions")} />
            <LinkTile icon={Crown}     title="Revenue & Payments" hint="Statements and payouts." onClick={() => onNavigate("billing")} />
          </div>
        </Section>
      )}

      {/* 6 · Workspace — Plan + storage in one compact card */}
      <Section title="Workspace" hint="Your plan and storage in one place.">
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

      {/* 7 · Help */}
      <Section title="Help" hint="We're here when you need us.">
        <LinkTile
          icon={LifeBuoy}
          title="Get help"
          hint="Contact support or browse answers to common questions."
          onClick={() => onNavigate("help")}
        />
      </Section>
    </div>
  );
}

/* ─────────────── helpers & subcomponents ─────────────── */

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

function CountTile({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border/40 bg-secondary/5 p-4 hover:bg-secondary/15 transition-colors min-w-0"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold font-display mt-1">{value}</div>
    </button>
  );
}

function LinkTile({
  icon: Icon, title, hint, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; hint: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/40 bg-secondary/5 p-4 hover:bg-secondary/15 transition-colors flex items-start gap-3 min-w-0"
    >
      <Icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{hint}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
    </button>
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

function TimelineList({
  items, loading, onOpenAll,
}: { items: TimelineItem[]; loading: boolean; onOpenAll: () => void }) {
  if (loading) {
    return <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 h-[120px] animate-pulse" />;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-sm text-muted-foreground">
        Nothing new yet. Progress on your titles and messages will show up here.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5">
      <ul className="divide-y divide-border/40">
        {items.slice(0, 6).map((it, i) => (
          <li key={i} className="p-3.5 flex items-start gap-3 min-w-0">
            <it.icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{it.label}</p>
              {it.hint && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.hint}</p>}
            </div>
            <time className="text-[11px] text-muted-foreground shrink-0">{it.when}</time>
          </li>
        ))}
      </ul>
      <button
        onClick={onOpenAll}
        className="w-full text-xs text-accent hover:underline py-2.5 border-t border-border/40"
      >
        View all updates →
      </button>
    </div>
  );
}

/* ─────────────── logic ─────────────── */

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
  if (review) return { label: "Track your submission", hint: `${review.title || "Untitled"} is under review.`, section: "submissions" };

  return { label: "Start a new title", hint: "Ready for your next project?", section: "titles" };
}

type TimelineItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string; hint?: string; when: string; at: number;
};

function buildTimeline(titles: TitleRow[], updates: UpdateRow[]): TimelineItem[] {
  const t: TimelineItem[] = titles.slice(0, 6).map((row) => ({
    icon: Film,
    label: `${row.title || "Untitled"} — ${friendlyStatus(row.status)}`,
    when: relative(row.updated_at),
    at: +new Date(row.updated_at),
  }));
  const n: TimelineItem[] = updates.slice(0, 6).map((u) => ({
    icon: Bell,
    label: u.title,
    hint: u.message || undefined,
    when: relative(u.created_at),
    at: +new Date(u.created_at),
  }));
  return [...t, ...n].sort((a, b) => b.at - a.at).slice(0, 6);
}

function friendlyStatus(s: string): string {
  switch (s) {
    case "draft":
    case "incomplete": return "Draft";
    case "submitted":
    case "in_review":
    case "qc_review":
    case "legal_review": return "In review";
    case "hold": return "On hold";
    case "changes_requested": return "Changes requested";
    case "approved":
    case "ready_for_distribution": return "Approved";
    case "rejected": return "Not accepted";
    case "published": return "Published";
    case "archived": return "Archived";
    default: return s;
  }
}

function relative(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  const w = Math.floor(day / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
