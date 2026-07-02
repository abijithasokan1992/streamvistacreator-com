import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Send, ShieldCheck, Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type IssueRow = {
  id: string;
  stage: string;
  category_group: string;
  category_label: string;
  severity: string;
  status: string;
  creator_note: string | null;
  raised_at: string;
  resolved_at: string | null;
};

type TitleBucket = {
  title_id: string;
  title: string;
  status: string;
  requested_from_stage: string | null;
  issues: IssueRow[];
};

const STAGE_META: Record<string, { label: string; icon: any }> = {
  qc:      { label: "QC Review",    icon: ShieldCheck },
  legal:   { label: "Legal Review", icon: Scale },
  general: { label: "General",      icon: AlertOctagon },
};

const STAGE_ORDER = ["qc", "legal", "general"];

/**
 * Creator-facing structured change requests / review feedback.
 * - Groups issues by stage (QC / Legal / General) per title.
 * - Surfaces severity + blocking + creator-facing note (never internal notes).
 * - When status = changes_requested, offers a one-click Resubmit that returns
 *   the title to the originating review stage (creator_resubmit_title RPC).
 */
export default function CreatorReviewFeedback() {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<TitleBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: titles } = await (supabase as any)
      .from("content_titles")
      .select("id, title, status, requested_from_stage")
      .eq("owner_user_id", user.id)
      .in("status", ["changes_requested", "submitted", "in_review", "qc_review", "legal_review", "hold"]);

    const out: TitleBucket[] = [];
    for (const t of (titles ?? [])) {
      const { data } = await (supabase as any).rpc("creator_review_feedback", { _title_id: t.id });
      const issues = (data ?? []) as IssueRow[];
      if (issues.length === 0 && t.status !== "changes_requested") continue;
      out.push({
        title_id: t.id,
        title: t.title,
        status: t.status,
        requested_from_stage: t.requested_from_stage,
        issues,
      });
    }
    // Most recent activity first
    out.sort((a, b) => {
      const aT = a.issues[0]?.raised_at ?? "";
      const bT = b.issues[0]?.raised_at ?? "";
      return bT.localeCompare(aT);
    });
    setBuckets(out);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const resubmit = async (titleId: string) => {
    setResubmitting(titleId);
    const { data, error } = await (supabase as any).rpc("creator_resubmit_title", {
      _title_id: titleId,
      _note: "Creator resubmitted after addressing requested changes",
    });
    setResubmitting(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Resubmitted — back to ${(data as any)?.returned_to_stage ?? "review"}`);
    await load();
  };

  if (loading || buckets.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <AlertOctagon className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-semibold">Review feedback</h2>
        <span className="text-[11px] text-muted-foreground ml-auto">From the review team</span>
      </div>
      <ul className="divide-y divide-border/30">
        {buckets.map((b) => (
          <TitleCard
            key={b.title_id}
            bucket={b}
            busy={resubmitting === b.title_id}
            onResubmit={() => resubmit(b.title_id)}
          />
        ))}
      </ul>
    </div>
  );
}

function TitleCard({
  bucket, busy, onResubmit,
}: { bucket: TitleBucket; busy: boolean; onResubmit: () => void }) {
  const grouped = useMemo(() => {
    const m: Record<string, IssueRow[]> = {};
    for (const i of bucket.issues) {
      const k = STAGE_META[i.stage] ? i.stage : "general";
      (m[k] ||= []).push(i);
    }
    return m;
  }, [bucket.issues]);

  const openIssues  = bucket.issues.filter(i => i.status === "open");
  const blockingOpen = openIssues.filter(i => i.severity === "blocking").length;
  const canResubmit = bucket.status === "changes_requested";
  const returnStageLabel = bucket.requested_from_stage
    ? bucket.requested_from_stage.replace("_", " ")
    : "in review";

  return (
    <li className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{bucket.title}</span>
        <Badge variant="outline" className="text-[10px]">{bucket.status.replace("_", " ")}</Badge>
        {blockingOpen > 0 && (
          <Badge variant="destructive" className="text-[10px]">{blockingOpen} blocking</Badge>
        )}
        {openIssues.length > 0 && (
          <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-[10px]">
            {openIssues.length} open
          </Badge>
        )}
        {canResubmit && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={onResubmit}
          >
            {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
            Resubmit to {returnStageLabel}
          </Button>
        )}
      </div>

      {STAGE_ORDER.filter((s) => grouped[s]?.length).map((stageKey) => {
        const meta = STAGE_META[stageKey];
        const Icon = meta.icon;
        return (
          <div key={stageKey} className="rounded-md border border-border/30">
            <div className="px-3 py-1.5 text-[11px] font-semibold bg-muted/20 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              {meta.label}
              <span className="text-muted-foreground/70">· {grouped[stageKey].length}</span>
            </div>
            <ul className="divide-y divide-border/20">
              {grouped[stageKey].map((i) => (
                <li key={i.id} className="px-3 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {i.status === "resolved"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <AlertOctagon className="w-3.5 h-3.5 text-orange-400" />}
                    <span className="font-medium">{i.category_label}</span>
                    <Badge
                      variant={i.severity === "blocking" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {i.severity.replace("_", " ")}
                    </Badge>
                    {i.severity === "blocking" && i.status === "open" && (
                      <Badge variant="outline" className="border-red-500/40 text-red-300 text-[10px]">
                        blocks approval
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                    <span className="text-muted-foreground/70 ml-auto">
                      {new Date(i.raised_at).toLocaleDateString()}
                    </span>
                  </div>
                  {i.creator_note && (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{i.creator_note}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {bucket.issues.length === 0 && canResubmit && (
        <p className="text-xs text-muted-foreground">
          The review team asked for changes. Address them in your title editor, then resubmit.
        </p>
      )}
    </li>
  );
}
