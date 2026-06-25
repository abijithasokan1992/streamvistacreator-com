import { useEffect, useState } from "react";
import { Plus, ArrowRight, Bell, Film, Inbox, HardDrive, Database, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listTitles, type TitleRow } from "@/lib/creator/titleApi";
import WorkspaceWelcome from "@/components/creator/WorkspaceWelcome";
import ReviewNotesInbox from "@/components/creator/ReviewNotesInbox";
import { UploadDiagnostics } from "@/components/creator/UploadDiagnostics";
import Buy1TBCard from "@/components/shared/Buy1TBCard";
import { Button } from "@/components/ui/button";
import OnboardingChecklist from "@/components/creator/OnboardingChecklist";
import type { SectionId } from "@/components/creator/CreatorSidebar";

type UpdateRow = { id: string; title: string; message: string | null; created_at: string };

const DRAFT_STATES = new Set(["draft", "incomplete", "changes_requested"]);
const SUBMITTED_STATES = new Set(["submitted", "in_review", "qc_review", "legal_review", "hold"]);

/**
 * Creator Home — compact workspace control room.
 * Answers: what plan, what storage, which titles need work, what is submitted,
 * any admin updates to act on. Not a marketing page.
 */
export default function HomeSection({ onNavigate }: { onNavigate: (s: SectionId) => void; isFree: boolean }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [t, n] = await Promise.all([
          listTitles(user.id),
          (supabase as any).from("notifications")
            .select("id, title, message, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);
        setTitles(t);
        setUpdates((n.data ?? []) as UpdateRow[]);
      } finally { setLoading(false); }
    })();
  }, [user]);

  const drafts = titles.filter((t) => DRAFT_STATES.has(t.status)).length;
  const inReview = titles.filter((t) => SUBMITTED_STATES.has(t.status)).length;
  const approved = titles.filter((t) => t.status === "approved" || t.status === "ready_for_distribution").length;

  return (
    <div className="space-y-6">
      {/* Single welcome block — name + plan + storage live inside WorkspaceWelcome */}
      <WorkspaceWelcome />

      {/* One-time onboarding checklist */}
      <OnboardingChecklist hasTitles={titles.length > 0} onNavigate={onNavigate} />

      {/* Primary action */}
      <button
        onClick={() => onNavigate("titles")}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-5 text-left flex items-center gap-3"
      >
        <Plus className="w-5 h-5 text-accent" />
        <div className="flex-1">
          <p className="font-semibold">New Title</p>
          <p className="text-xs text-muted-foreground mt-0.5">Start a draft. Add files. Submit.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Storage row — compact */}
      <div className="rounded-2xl border border-border/40 bg-secondary/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Storage</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate("billing")}>
            <Wallet className="w-3.5 h-3.5 mr-1.5" /> Billing
          </Button>
          <Button size="sm" onClick={() => onNavigate("delivery_vault")} className="bg-gradient-primary text-primary-foreground">
            <Database className="w-3.5 h-3.5 mr-1.5" /> Open My Library
          </Button>
        </div>
      </div>

      {/* 1 TB add-on — short headline */}
      <Buy1TBCard variant="compact" headline="Add 1 TB to My Library" />

      {/* Four operational cards — short copy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <OpCard
          icon={HardDrive}
          label="Storage"
          value="Usage"
          hint="View and add storage."
          cta="Open Billing"
          onClick={() => onNavigate("billing")}
        />
        <OpCard
          icon={Film}
          label="Drafts"
          value={loading ? "…" : `${drafts} draft${drafts === 1 ? "" : "s"}`}
          hint="Titles still in progress."
          cta="Open Titles"
          onClick={() => onNavigate("titles")}
        />
        <OpCard
          icon={Inbox}
          label="Review Queue"
          value={loading ? "…" : `${inReview} in review · ${approved} approved`}
          hint="Submission status."
          cta="Open Queue"
          onClick={() => onNavigate("submissions")}
        />
        <OpCard
          icon={Bell}
          label="Inbox"
          value={loading ? "…" : `${updates.length} recent`}
          hint="Messages from our team."
          cta="Open Inbox"
          onClick={() => onNavigate("updates")}
        />
      </div>

      {/* Operational signals */}
      <UploadDiagnostics />
      <ReviewNotesInbox />
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
