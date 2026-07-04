import { useEffect, useState } from "react";
import { Plus, ArrowRight, Bell, Film, Inbox, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, fetchFreeTierStatus, type TitleRow, type FreeTierStatus } from "@/lib/creator/titleApi";
import WorkspaceWelcome from "@/components/creator/WorkspaceWelcome";
import ReviewNotesInbox from "@/components/creator/ReviewNotesInbox";
import { UploadDiagnostics } from "@/components/creator/UploadDiagnostics";

import OnboardingChecklist from "@/components/creator/OnboardingChecklist";
import CreatorQuickActions from "@/components/creator/CreatorQuickActions";
import type { SectionId } from "@/components/creator/CreatorSidebar";

type UpdateRow = { id: string; title: string; message: string | null; created_at: string };

const DRAFT_STATES = new Set(["draft", "incomplete", "changes_requested"]);
const SUBMITTED_STATES = new Set(["submitted", "in_review", "qc_review", "legal_review", "hold"]);

/**
 * Creator Home — compact workspace control room.
 * Each section has a single purpose:
 *  1. WorkspaceWelcome — identity + plan + storage + title usage (single source)
 *  2. Primary action     — start a new title (or upgrade if capped)
 *  3. OnboardingChecklist — first-run guidance
 *  4. CreatorQuickActions — tool shortcuts
 *  5. Operational cards   — drafts / review queue / inbox
 *  6. Diagnostics + Review notes
 */
export default function HomeSection({ onNavigate, isFree }: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
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
            .limit(3),
          fetchFreeTierStatus().catch(() => null),
        ]);
        setTitles(t);
        setUpdates((n.data ?? []) as UpdateRow[]);
        setTier(fs);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const drafts = titles.filter((t) => DRAFT_STATES.has(t.status)).length;
  const inReview = titles.filter((t) => SUBMITTED_STATES.has(t.status)).length;
  const approved = titles.filter((t) => t.status === "approved" || t.status === "ready_for_distribution").length;

  const capped = isFree && tier && !tier.can_create_draft && tier.lifecycle_count >= 1;

  return (
    <div className="space-y-8">
      {/* 1. Identity + plan + storage + titles — the single at-a-glance block */}
      <WorkspaceWelcome />

      {/* 2. Primary action */}
      {capped ? (
        <button
          onClick={() => onNavigate("billing")}
          className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
        >
          <Crown className="w-5 h-5 text-amber-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base">Upgrade to add more titles</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Free plan includes 1 title. Upgrade for 5 TB storage and multiple submissions.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      ) : (
        <button
          onClick={() => onNavigate("titles")}
          className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-4 sm:p-5 text-left flex items-center gap-3 transition-colors"
        >
          <Plus className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base">Start a new title</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create a draft, add files, and submit when ready.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      )}

      {/* 3. First-run checklist (self-hides once complete) */}
      <OnboardingChecklist hasTitles={titles.length > 0} onNavigate={onNavigate} />

      {/* 4. Quick actions */}
      <CreatorQuickActions
        onNavigate={onNavigate}
        isFree={isFree}
        tier={tier}
        titles={titles}
      />

      {/* 5. Operational status — one card per real signal, no duplicates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <OpCard
          icon={Film}
          label="Drafts"
          value={loading ? "…" : `${drafts} draft${drafts === 1 ? "" : "s"}`}
          hint="Titles still in progress."
          cta="Open Titles"
          onClick={() => onNavigate("titles")}
        />
        {!isFree && (
          <OpCard
            icon={Inbox}
            label="Review Queue"
            value={loading ? "…" : `${inReview} in review · ${approved} approved`}
            hint="Submission status."
            cta="Open Queue"
            onClick={() => onNavigate("submissions")}
          />
        )}
        {!isFree && (
          <OpCard
            icon={Bell}
            label="Inbox"
            value={loading ? "…" : `${updates.length} recent`}
            hint="Messages from our team."
            cta="Open Inbox"
            onClick={() => onNavigate("updates")}
          />
        )}
      </div>

      {/* Storage add-on lives on the Library section, not Home — one entry point only. */}

      {/* 7. Operational signals */}
      <UploadDiagnostics />
      {!isFree && <ReviewNotesInbox />}
    </div>
  );
}

function OpCard({
  icon: Icon, label, value, hint, cta, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint: string; cta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border/40 bg-secondary/5 p-4 hover:bg-secondary/15 transition-colors flex flex-col gap-2 min-w-0"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-base font-semibold font-display truncate">{value}</div>
      <div className="text-[11px] text-muted-foreground line-clamp-2">{hint}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-accent">
        {cta} <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}
