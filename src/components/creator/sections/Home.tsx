import { useEffect, useState } from "react";
import {
  Plus, ArrowRight, Bell, Film, Inbox, Crown, Play, HardDrive,
  Briefcase, LifeBuoy, CheckCircle2, Clock, Sparkles,
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
 * Creator Home — creator-first, business language only.
 *
 *  1. Continue Working
 *  2. My Titles
 *  3. What's Next
 *  4. Activity
 *  5. Business
 *  6. Messages
 *  7. Storage
 *  8. Support
 *
 * Reuses existing queries and components — no new backend logic.
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
            .limit(5),
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

  // Single "next action" logic — one clear step at a time.
  const nextAction = deriveNextAction(titles);

  return (
    <div className="space-y-8">
      <LegacyRecoveryBanner onNavigate={onNavigate} />

      <WorkspaceWelcome />

      {/* 1 · Continue Working */}
      <Section title="Continue Working" hint="Jump back into your latest title.">
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

      {/* 2 · My Titles */}
      <Section title="My Titles" hint="Everything you've created, at a glance.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CountTile label="Drafts"    value={loading ? "…" : String(drafts.length)}    onClick={() => onNavigate("titles")} />
          <CountTile label="In Review" value={loading ? "…" : String(inReview.length)}  onClick={() => onNavigate(isFree ? "titles" : "submissions")} />
          <CountTile label="Approved"  value={loading ? "…" : String(approved.length)}  onClick={() => onNavigate("titles")} />
          <CountTile label="Published" value={loading ? "…" : String(published.length)} onClick={() => onNavigate("titles")} />
          <CountTile label="Archived"  value={loading ? "…" : String(archived.length)}  onClick={() => onNavigate("titles")} />
        </div>
      </Section>

      {/* 3 · What's Next */}
      <Section title="What's Next" hint="One clear next step.">
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

      {/* 4 · Activity */}
      <Section title="Activity" hint="Recent progress on your work.">
        <ActivityList items={activityFrom(titles, updates)} loading={loading} />
      </Section>

      {/* 5 · Business */}
      {!isFree && (
        <Section title="Business" hint="Requests, offers and revenue.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LinkTile icon={Briefcase} title="Requests & Offers" hint="Interest from buyers." onClick={() => onNavigate("submissions")} />
            <LinkTile icon={CheckCircle2} title="Deals & Contracts" hint="Signed and active agreements." onClick={() => onNavigate("submissions")} />
            <LinkTile icon={Crown} title="Revenue & Payments" hint="Statements and payouts." onClick={() => onNavigate("billing")} />
          </div>
        </Section>
      )}

      {/* 6 · Messages */}
      {!isFree && (
        <Section title="Messages" hint="Updates from our team and buyers.">
          <MessagesPreview items={updates} loading={loading} onOpen={() => onNavigate("updates")} />
        </Section>
      )}

      {/* 7 · Storage */}
      <Section title="Storage" hint="Your plan and how much you've used.">
        <StorageLive />
      </Section>

      {/* 8 · Support */}
      <Section title="Support" hint="We're here to help.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LinkTile icon={LifeBuoy} title="Contact Support" hint="Reach our team for any question." onClick={() => onNavigate("help")} />
          <LinkTile icon={Inbox} title="Help & FAQs" hint="Answers to common questions." onClick={() => onNavigate("help")} />
        </div>
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
      className="text-left rounded-xl border border-border/40 bg-secondary/5 p-4 hover:bg-secondary/15 transition-colors flex items-start gap-3 min-w-0"
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

function ActivityList({ items, loading }: { items: ActivityItem[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 h-[96px] animate-pulse" />;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-sm text-muted-foreground">
        No activity yet. As you work, your latest progress will appear here.
      </div>
    );
  }
  return (
    <ul className="rounded-xl border border-border/40 bg-secondary/5 divide-y divide-border/40">
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
  );
}

function MessagesPreview({
  items, loading, onOpen,
}: { items: UpdateRow[]; loading: boolean; onOpen: () => void }) {
  if (loading) {
    return <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 h-[96px] animate-pulse" />;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/5 p-4 text-sm text-muted-foreground">
        No messages yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5">
      <ul className="divide-y divide-border/40">
        {items.slice(0, 3).map((u) => (
          <li key={u.id} className="p-3.5 flex items-start gap-3 min-w-0">
            <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{u.title}</p>
              {u.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{u.message}</p>}
            </div>
            <time className="text-[11px] text-muted-foreground shrink-0">{relative(u.created_at)}</time>
          </li>
        ))}
      </ul>
      <button
        onClick={onOpen}
        className="w-full text-xs text-accent hover:underline py-2.5 border-t border-border/40"
      >
        View all messages →
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

type ActivityItem = { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; when: string };

function activityFrom(titles: TitleRow[], updates: UpdateRow[]): ActivityItem[] {
  const t: ActivityItem[] = titles.slice(0, 4).map((row) => ({
    icon: Film,
    label: `${row.title || "Untitled"} — ${friendlyStatus(row.status)}`,
    hint: undefined,
    when: relative(row.updated_at),
  }));
  const n: ActivityItem[] = updates.slice(0, 3).map((u) => ({
    icon: Bell,
    label: u.title,
    hint: u.message || undefined,
    when: relative(u.created_at),
  }));
  return [...t, ...n]
    .sort((a, b) => (a.when > b.when ? -1 : 1))
    .slice(0, 6);
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
