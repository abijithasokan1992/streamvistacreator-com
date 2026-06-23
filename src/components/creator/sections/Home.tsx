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
      {/* Hero / welcome — plan + storage + titles summary already lives here */}
      <WorkspaceWelcome />

      {/* Direct storage actions — make billing + Delivery Vault one-click reachable */}
      <div className="rounded-2xl border border-border/40 bg-secondary/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Storage & Delivery Vault</p>
          <p className="text-[11px] text-muted-foreground">
            Workspace storage = title prep, posters, trailers. Delivery Vault = masters, delivery files and archive copies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate("billing")}>
            <Wallet className="w-3.5 h-3.5 mr-1.5" /> Open Storage & Billing
          </Button>
          <Button size="sm" onClick={() => onNavigate("delivery_vault")} className="bg-gradient-primary text-primary-foreground">
            <Database className="w-3.5 h-3.5 mr-1.5" /> Open Delivery Vault
          </Button>
        </div>
      </div>

      {/* Direct one-click 1 TB purchase — reuses existing Razorpay flow */}
      <Buy1TBCard
        variant="compact"
        headline="Need more space? Add 1 TB Delivery Vault Storage"
      />

      {/* Primary action */}
      <button
        onClick={() => onNavigate("titles")}
        className="w-full rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/15 p-5 text-left flex items-center gap-3"
      >
        <Plus className="w-5 h-5 text-accent" />
        <div className="flex-1">
          <p className="font-semibold">Create or continue a title</p>
          <p className="text-xs text-muted-foreground mt-0.5">Draft, upload assets and submit for admin review.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Four operational cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <OpCard
          icon={HardDrive}
          label="Storage"
          value="Workspace usage"
          hint="View allowance, add 1 TB blocks, manage recurring billing."
          cta="Open Storage & Billing"
          onClick={() => onNavigate("billing")}
        />
        <OpCard
          icon={Film}
          label="Draft titles"
          value={loading ? "…" : `${drafts} draft${drafts === 1 ? "" : "s"}`}
          hint="Titles still missing metadata or assets."
          cta="Continue titles"
          onClick={() => onNavigate("titles")}
        />
        <OpCard
          icon={Inbox}
          label="Submissions"
          value={loading ? "…" : `${inReview} in review · ${approved} approved`}
          hint="Cross-title view of submission state."
          cta="Open Submissions"
          onClick={() => onNavigate("submissions")}
        />
        <OpCard
          icon={Bell}
          label="Updates"
          value={loading ? "…" : `${updates.length} recent`}
          hint="Admin messages and review notes."
          cta="View Updates"
          onClick={() => onNavigate("updates")}
        />
      </div>

      {/* Inline operational signals — kept compact */}
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
